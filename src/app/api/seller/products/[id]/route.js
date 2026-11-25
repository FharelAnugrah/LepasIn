import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { extractAndProcessImages } from '@/lib/image-util';
import {
  PRODUCT_MIN_PRICE,
  PRODUCT_MAX_PRICE,
  PRODUCT_MAX_ORIGINAL_PRICE,
  createProductNameSchema,
  createProductImageUrlSchema,
} from '@/lib/product-validation';
import {
  GuardError,
  findActiveOrdersByProduct,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

const updatePriceValidator = z
  .union([z.string(), z.number()])
  .optional()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      const str = String(val).trim();
      return !/^0\d+/.test(str);
    },
    {
      message: 'Harga lepas tidak boleh diawali dengan angka 0 (contoh: 050000). Masukkan nominal yang valid tanpa awalan 0.',
    }
  )
  .transform((val) => (val === undefined || val === null || val === '' ? undefined : Number(val)))
  .pipe(
    z
      .number({ invalid_type_error: 'Harga barang harus berupa angka positif minimal Rp1.000.' })
      .int('Harga barang harus berupa angka positif minimal Rp1.000.')
      .min(PRODUCT_MIN_PRICE, 'Harga barang harus berupa angka positif minimal Rp1.000.')
      .max(PRODUCT_MAX_PRICE, 'Harga lepas maksimal Rp 100.000.000.')
      .optional()
  );

const updateOriginalPriceValidator = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      const str = String(val).trim();
      return !/^0\d+/.test(str);
    },
    {
      message: 'Harga coret tidak boleh diawali dengan angka 0 (contoh: 050000). Masukkan nominal yang valid tanpa awalan 0.',
    }
  )
  .transform((val) => (val === undefined || val === null || val === '' ? null : Number(val)))
  .pipe(
    z
      .number({ invalid_type_error: 'Harga coret harus berupa angka.' })
      .int('Harga coret harus berupa angka bulat.')
      .min(PRODUCT_MIN_PRICE, 'Harga coret minimal Rp 1.000 dan tidak boleh bernilai Rp 0.')
      .max(PRODUCT_MAX_ORIGINAL_PRICE, 'Harga coret maksimal Rp 200.000.000.')
      .optional()
      .nullable()
  );

const updateStockValidator = z
  .union([z.string(), z.number()])
  .optional()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      const str = String(val).trim();
      return !/^0\d+/.test(str);
    },
    {
      message: 'Jumlah stok tidak boleh diawali dengan angka 0 (contoh: 05).',
    }
  )
  .refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      const str = String(val).trim();
      return /^-?\d+$/.test(str);
    },
    {
      message: 'Jumlah stok harus berupa angka bulat tanpa titik atau koma.',
    }
  )
  .transform((val) => (val === undefined || val === null || val === '' ? undefined : Number(val)))
  .pipe(
    z
      .number({ invalid_type_error: 'Jumlah stok harus berupa angka bulat tanpa titik atau koma.' })
      .int('Jumlah stok harus berupa angka bulat tanpa titik atau koma.')
      .min(0, 'Jumlah stok minimal 0 buah (angka bulat non-negatif).')
      .max(10000, 'Jumlah stok maksimal 10.000.')
      .optional()
  );

const productNameValidator = createProductNameSchema(z);
const productImageUrlValidator = createProductImageUrlSchema(z);

const updateProductSchema = z
  .object({
    name: productNameValidator.optional(),
    description: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').optional(),
    price: updatePriceValidator,
    original_price: updateOriginalPriceValidator,
    stock: updateStockValidator,
    condition: z.enum(['like_new', 'good', 'fair', 'minor_defect']).optional(),
    category_id: z.coerce.number().int().positive('Silakan pilih salah satu kategori barang.').optional(),
    image_urls: z
      .array(productImageUrlValidator)
      .min(1, 'Wajib mengunggah minimal 1 foto produk yang jelas.')
      .max(5, 'Maksimal 5 foto produk.')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.original_price !== undefined && data.original_price !== null && data.price !== undefined) {
        return data.original_price > data.price;
      }
      return true;
    },
    {
      message: 'Harga coret harus lebih besar dari harga lepas (contoh: harga asli Rp 120.000, harga lepas Rp 50.000).',
      path: ['original_price'],
    }
  );

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'seller' || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const productId = Number(id);

    const storeRes = await query('SELECT id FROM stores WHERE user_id = $1', [user.id]);
    const store = storeRes.rows[0];
    if (!store) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });

    const prodRes = await query(
      `SELECT p.id, p.name, p.description, p.price, p.original_price, p.stock, p.condition, p.category_id,
              c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.store_id = $2 AND p.is_deleted = FALSE`,
      [productId, store.id]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan atau bukan milik Anda' }, { status: 404 });
    }

    const imagesRes = await query(
      `SELECT id, url, position FROM product_images WHERE product_id = $1 ORDER BY position ASC`,
      [productId]
    );

    return NextResponse.json({
      product: prodRes.rows[0],
      images: imagesRes.rows,
    });
  } catch (err) {
    console.error('Get product detail error:', err);
    return NextResponse.json({ error: 'Gagal memuat detail produk' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'seller' || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const productId = Number(id);

    const storeRes = await query('SELECT id FROM stores WHERE user_id = $1', [user.id]);
    const store = storeRes.rows[0];
    if (!store) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });

    // Cek produk milik toko
    const checkRes = await query(
      'SELECT id, price, original_price FROM products WHERE id = $1 AND store_id = $2 AND is_deleted = FALSE',
      [productId, store.id]
    );
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan atau bukan milik Anda' }, { status: 404 });
    }

    let dataPayload = {};
    let hasImages = false;
    let imageUrls = [];

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      dataPayload = {};
      if (formData.has('name')) dataPayload.name = formData.get('name');
      if (formData.has('description')) dataPayload.description = formData.get('description');
      if (formData.has('price')) dataPayload.price = formData.get('price');
      if (formData.has('original_price')) dataPayload.original_price = formData.get('original_price');
      if (formData.has('stock')) dataPayload.stock = formData.get('stock');
      if (formData.has('condition')) dataPayload.condition = formData.get('condition');
      if (formData.has('category_id')) dataPayload.category_id = formData.get('category_id');

      const extracted = await extractAndProcessImages(formData);
      if (extracted.length > 0 || formData.has('images') || formData.has('image_urls')) {
        hasImages = true;
        imageUrls = extracted;
      }
    } else {
      dataPayload = await request.json();
      if (dataPayload.image_urls !== undefined) {
        hasImages = true;
        imageUrls = await extractAndProcessImages(dataPayload);
      }
    }

    if (hasImages) {
      dataPayload.image_urls = imageUrls;
    }

    const validated = updateProductSchema.safeParse(dataPayload);

    if (!validated.success) {
      const fieldErrors = validated.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors)[0]?.[0] || 'Validasi gagal';
      return NextResponse.json(
        { error: firstError, details: fieldErrors },
        { status: 400 }
      );
    }

    const data = validated.data;
    const existing = checkRes.rows[0];
    const finalPrice = data.price !== undefined ? data.price : existing.price;
    const finalOrig = data.original_price !== undefined ? data.original_price : existing.original_price;

    if (finalOrig !== null && finalOrig !== undefined && finalOrig <= finalPrice) {
      return NextResponse.json(
        {
          error: 'Harga coret harus lebih besar dari harga lepas (contoh: harga asli Rp 120.000, harga lepas Rp 50.000).',
          details: {
            original_price: ['Harga coret harus lebih besar dari harga lepas (contoh: harga asli Rp 120.000, harga lepas Rp 50.000).'],
          },
        },
        { status: 400 }
      );
    }

    await withTransaction(async (client) => {
      const updates = [];
      const values = [];
      let idx = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.price !== undefined) {
        updates.push(`price = $${idx++}`);
        values.push(data.price);
      }
      if (data.original_price !== undefined) {
        updates.push(`original_price = $${idx++}`);
        values.push(data.original_price);
      }
      if (data.stock !== undefined) {
        updates.push(`stock = $${idx++}`);
        values.push(data.stock);
      }
      if (data.condition !== undefined) {
        updates.push(`condition = $${idx++}`);
        values.push(data.condition);
      }
      if (data.category_id !== undefined) {
        updates.push(`category_id = $${idx++}`);
        values.push(data.category_id);
      }

      if (updates.length > 0) {
        values.push(productId);
        values.push(store.id);
        await client.query(
          `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND store_id = $${idx++} AND is_deleted = FALSE`,
          values
        );
      }

      // Perbarui foto bila ada
      if (data.image_urls !== undefined) {
        await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
        for (let i = 0; i < data.image_urls.length; i++) {
          await client.query(
            `INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)`,
            [productId, data.image_urls[i], i]
          );
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Produk berhasil diperbarui!' });
  } catch (err) {
    console.error('Update product error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'seller' || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const productId = Number(id);

    if (!productId) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 });
    }

    const deletedProduct = await withTransaction(async (client) => {
      const storeRes = await client.query('SELECT id FROM stores WHERE user_id = $1', [user.id]);
      const store = storeRes.rows[0];
      if (!store) throw new GuardError('Toko tidak ditemukan', 404);

      const prodRes = await client.query(
        `SELECT id, name FROM products WHERE id = $1 AND store_id = $2 AND is_deleted = FALSE FOR UPDATE`,
        [productId, store.id]
      );

      if (prodRes.rows.length === 0) {
        throw new GuardError('Produk tidak ditemukan atau bukan milik Anda', 404);
      }

      const product = prodRes.rows[0];

      // Cek apakah barang sedang dalam pesanan aktif (sudah di-checkout oleh pembeli)
      const activeOrders = await findActiveOrdersByProduct(client, productId);
      if (activeOrders.length > 0) {
        throw new GuardError(
          `Barang tidak dapat dihapus karena masih ada di ${formatActiveOrderSummary(activeOrders)}.`,
          400
        );
      }

      // Soft Delete: barang hilang dari etalase & katalog, namun arsip pesanan selesai dan ulasan pembeli tetap aman
      await client.query(
        `UPDATE products SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND store_id = $2`,
        [productId, store.id]
      );
      await client.query(`DELETE FROM cart_items WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM wishlists WHERE product_id = $1`, [productId]);

      return product;
    });

    return NextResponse.json({
      success: true,
      message: `Barang "${deletedProduct.name}" berhasil dihapus dari lapak`,
    });
  } catch (err) {
    if (err?.statusCode) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Delete product error:', err);
    return NextResponse.json({ error: 'Gagal menghapus produk' }, { status: 500 });
  }
}

export { PATCH as PUT };
