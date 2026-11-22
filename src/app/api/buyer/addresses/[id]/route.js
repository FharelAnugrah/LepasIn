import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizePhoneNumber } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const updateAddressSchema = z.object({
  label: z.string().trim().min(1, 'Label alamat wajib diisi (contoh: Kost Putri Melati, Asrama Kampus).').max(50).optional(),
  recipient_name: z.string().trim().min(1, 'Nama penerima paket/COD wajib diisi.').max(100).optional(),
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor WhatsApp wajib diisi untuk koordinasi transaksi/COD.')
    .refine((val) => {
      const norm = normalizePhoneNumber(val);
      return /^08\d{8,12}$/.test(norm);
    }, 'Nomor WhatsApp harus diawali 08 atau 62 dan terdiri dari 10-14 digit angka.')
    .optional(),
  address_line: z.string().trim().min(1, 'Detail alamat wajib diisi selengkap mungkin (nama jalan/gedung/nomor kamar).').optional(),
  city: z.string().trim().min(1, 'Kota / Kabupaten wajib diisi.').max(100).optional(),
  postal_code: z.string().trim().max(10).optional().nullable(),
  is_default: z.boolean().optional(),
});

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'buyer') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const addressId = Number(id);

    const checkRes = await query(
      'SELECT id, is_default FROM addresses WHERE id = $1 AND user_id = $2',
      [addressId, user.id]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Alamat tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateAddressSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = validated.data;

    await withTransaction(async (client) => {
      if (data.is_default) {
        await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND id != $2', [
          user.id,
          addressId,
        ]);
      }

      const updates = [];
      const values = [];
      let idx = 1;

      if (data.label !== undefined) {
        updates.push(`label = $${idx++}`);
        values.push(data.label);
      }
      if (data.recipient_name !== undefined) {
        updates.push(`recipient_name = $${idx++}`);
        values.push(data.recipient_name);
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${idx++}`);
        values.push(data.phone);
      }
      if (data.address_line !== undefined) {
        updates.push(`address_line = $${idx++}`);
        values.push(data.address_line);
      }
      if (data.city !== undefined) {
        updates.push(`city = $${idx++}`);
        values.push(data.city);
      }
      if (data.postal_code !== undefined) {
        updates.push(`postal_code = $${idx++}`);
        values.push(data.postal_code);
      }
      if (data.is_default !== undefined) {
        updates.push(`is_default = $${idx++}`);
        values.push(data.is_default);
      }

      if (updates.length > 0) {
        values.push(addressId);
        values.push(user.id);
        await client.query(
          `UPDATE addresses SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++}`,
          values
        );
      }
    });

    return NextResponse.json({ success: true, message: 'Alamat berhasil diperbarui' });
  } catch (err) {
    console.error('Update address error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui alamat' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'buyer') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const addressId = Number(id);

    await withTransaction(async (client) => {
      const delRes = await client.query(
        'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default',
        [addressId, user.id]
      );

      if (delRes.rows.length === 0) {
        throw new Error('Alamat tidak ditemukan');
      }

      const wasDefault = delRes.rows[0].is_default;
      if (wasDefault) {
        // Berikan status default pada alamat pertama yang tersisa
        await client.query(
          `UPDATE addresses SET is_default = TRUE
           WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
          [user.id]
        );
      }
    });

    return NextResponse.json({ success: true, message: 'Alamat berhasil dihapus' });
  } catch (err) {
    console.error('Delete address error:', err);
    return NextResponse.json({ error: err.message || 'Gagal menghapus alamat' }, { status: 500 });
  }
}
