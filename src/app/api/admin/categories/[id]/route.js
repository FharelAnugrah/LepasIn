import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, getClient } from '@/lib/db';
import { validateCategoryName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const categoryId = Number(id);

    const body = await request.json();
    const name = body.name?.trim();

    const nameErr = validateCategoryName(name);
    if (nameErr) {
      return NextResponse.json({ error: nameErr }, { status: 400 });
    }

    // Cek kategori yang akan diedit
    const catCheck = await query(`SELECT id, name FROM categories WHERE id = $1`, [categoryId]);
    if (catCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    const currentName = catCheck.rows[0].name?.trim().toLowerCase();
    if (currentName === 'lainnya' || currentName === 'lain-lain') {
      return NextResponse.json(
        { error: 'Nama kategori "Lainnya" adalah kategori sistem dan tidak dapat diubah.' },
        { status: 400 }
      );
    }

    const existing = await query(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2`,
      [name, categoryId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Kategori dengan nama tersebut sudah ada' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name, categoryId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    // Ambil daftar seluruh kategori terbaru
    const allCatsRes = await query(`
      SELECT c.id, c.name, c.created_at, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_deleted = FALSE
      GROUP BY c.id
      ORDER BY 
        CASE 
          WHEN LOWER(c.name) = 'lainnya' OR LOWER(c.name) = 'lain-lain' THEN 1 
          ELSE 0 
        END ASC, 
        c.id ASC
    `);

    return NextResponse.json({
      success: true,
      category: result.rows[0],
      categories: allCatsRes.rows,
      message: 'Nama kategori berhasil diperbarui',
    });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui kategori' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const categoryId = Number(id);

    if (!categoryId) {
      return NextResponse.json({ error: 'ID kategori tidak valid' }, { status: 400 });
    }

    // Cek keberadaan kategori
    const catCheck = await query(`SELECT id, name FROM categories WHERE id = $1`, [categoryId]);
    if (catCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    const catName = catCheck.rows[0].name?.trim().toLowerCase();
    if (catName === 'lainnya' || catName === 'lain-lain') {
      return NextResponse.json(
        { error: 'Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.' },
        { status: 400 }
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Ambil ID kategori fallback "Lainnya" (sistem)
      const lainnyaRes = await client.query(
        `SELECT id, name FROM categories WHERE LOWER(name) IN ('lainnya', 'lain-lain') FOR UPDATE`
      );

      if (lainnyaRes.rows.length === 0) {
        throw new Error('Kategori sistem "Lainnya" tidak ditemukan untuk menampung relokasi produk.');
      }

      const fallbackCategoryId = Number(lainnyaRes.rows[0].id);

      // 2. Cek jumlah produk aktif (tidak terhapus) yang saat ini berada di kategori yang akan dihapus
      const productCheck = await client.query(
        `SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1 AND is_deleted = FALSE`,
        [categoryId]
      );
      const reallocatedCount = productCheck.rows[0]?.count || 0;

      // 3. Pindahkan seluruh produk (termasuk arsip terhapus) ke kategori "Lainnya" agar foreign key tetap aman
      await client.query(
        `UPDATE products SET category_id = $1 WHERE category_id = $2`,
        [fallbackCategoryId, categoryId]
      );

      // 4. Hapus kategori sasaran
      const result = await client.query(
        `DELETE FROM categories WHERE id = $1 RETURNING id, name`,
        [categoryId]
      );

      // 5. Cek kategori Lainnya: pastikan ID-nya tetap nomor terakhir (dirapatkan jika ada gap)
      const maxOtherRes = await client.query(
        `SELECT COALESCE(MAX(id), 0) AS max_id FROM categories WHERE LOWER(name) NOT IN ('lainnya', 'lain-lain')`
      );
      const maxOtherId = Number(maxOtherRes.rows[0].max_id);
      const targetLainnyaId = maxOtherId + 1;

      // Ambil data Lainnya saat ini
      const currentLainnyaRes = await client.query(
        `SELECT id, name FROM categories WHERE LOWER(name) IN ('lainnya', 'lain-lain') FOR UPDATE`
      );

      if (currentLainnyaRes.rows.length > 0) {
        const currentLainnyaId = Number(currentLainnyaRes.rows[0].id);
        if (currentLainnyaId !== targetLainnyaId) {
          // Pindahkan Lainnya sementara ke 999999 lalu ke targetLainnyaId (ON UPDATE CASCADE akan memperbarui products.category_id secara otomatis)
          await client.query(`UPDATE categories SET id = 999999 WHERE id = $1`, [currentLainnyaId]);
          await client.query(`UPDATE categories SET id = $1 WHERE id = 999999`, [targetLainnyaId]);
        }

        // Sinkronisasi PostgreSQL sequence
        await client.query(
          `SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories))`
        );
      }

      // 6. Ambil daftar seluruh kategori terbaru beserta jumlah produk
      const allCatsRes = await client.query(`
        SELECT c.id, c.name, c.created_at, COUNT(p.id)::int AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_deleted = FALSE
        GROUP BY c.id
        ORDER BY 
          CASE 
            WHEN LOWER(c.name) = 'lainnya' OR LOWER(c.name) = 'lain-lain' THEN 1 
            ELSE 0 
          END ASC, 
          c.id ASC
      `);

      await client.query('COMMIT');

      const message =
        reallocatedCount > 0
          ? `Kategori "${result.rows[0].name}" berhasil dihapus, dan ${reallocatedCount} produk dipindahkan ke kategori "Lainnya".`
          : `Kategori "${result.rows[0].name}" berhasil dihapus.`;

      return NextResponse.json({
        success: true,
        category: result.rows[0],
        categories: allCatsRes.rows,
        reallocatedCount,
        message,
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus kategori' },
      { status: 500 }
    );
  }
}
