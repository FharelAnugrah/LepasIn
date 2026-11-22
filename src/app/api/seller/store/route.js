import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { validateStoreName, validateStoreDescription, validateLocation } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'seller') {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { name, campus_id, location, description, image_url } = body;

    const nameErr = validateStoreName(name);
    if (nameErr) {
      return NextResponse.json({ error: nameErr }, { status: 400 });
    }

    const parsedCampusId = Number(campus_id);
    if (!parsedCampusId) {
      return NextResponse.json(
        { error: 'Asal kampus wajib dipilih untuk mendaftarkan toko ke direktori kampus.' },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null) {
      const descErr = validateStoreDescription(description);
      if (descErr) {
        return NextResponse.json({ error: descErr }, { status: 400 });
      }
    }

    if (location) {
      const locErr = validateLocation(location);
      if (locErr) {
        return NextResponse.json({ error: locErr }, { status: 400 });
      }
    }

    const cleanImageUrl =
      typeof image_url === 'string' && image_url.trim() ? image_url.trim() : null;

    if (
      cleanImageUrl &&
      (cleanImageUrl.startsWith('data:image/') ||
        (!cleanImageUrl.startsWith('/uploads/stores/') &&
          !cleanImageUrl.startsWith('/uploads/') &&
          !/^https:\/\/[^\s]+$/i.test(cleanImageUrl)))
    ) {
      return NextResponse.json(
        { error: 'Format URL gambar tidak valid. Gambar harus diunggah melalui endpoint berkas.' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE stores
       SET name = $1,
           campus_id = $2,
           location = $3,
           description = $4,
           image_url = $5
       WHERE user_id = $6
       RETURNING id, name, campus_id, location, description, image_url`,
      [name.trim(), parsedCampusId, location?.trim() || null, description?.trim() || '', cleanImageUrl, user.id]
    );

    let store = result.rows[0];
    if (!store) {
      const insertRes = await query(
        `INSERT INTO stores (user_id, campus_id, name, location, description, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, campus_id, location, description, image_url`,
        [user.id, parsedCampusId, name.trim(), location?.trim() || null, description?.trim() || '', cleanImageUrl]
      );
      store = insertRes.rows[0];
    }

    // Update juga campus_id di user agar sinkron
    await query(`UPDATE users SET campus_id = $1 WHERE id = $2`, [parsedCampusId, user.id]);

    return NextResponse.json({
      success: true,
      message: 'Informasi toko berhasil diperbarui',
      store,
    });
  } catch (error) {
    console.error('Update store error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui toko' }, { status: 500 });
  }
}
