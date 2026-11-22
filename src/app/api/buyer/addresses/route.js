import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizePhoneNumber } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Label alamat wajib diisi (contoh: Kost Putri Melati, Asrama Kampus).').max(50),
  recipient_name: z.string().trim().min(1, 'Nama penerima paket/COD wajib diisi.').max(100),
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor WhatsApp wajib diisi untuk koordinasi transaksi/COD.')
    .refine((val) => {
      const norm = normalizePhoneNumber(val);
      return /^08\d{8,12}$/.test(norm);
    }, 'Nomor WhatsApp harus diawali 08 atau 62 dan terdiri dari 10-14 digit angka.'),
  address_line: z.string().trim().min(1, 'Detail alamat wajib diisi selengkap mungkin (nama jalan/gedung/nomor kamar).'),
  city: z.string().trim().min(1, 'Kota / Kabupaten wajib diisi.').max(100),
  postal_code: z.string().trim().max(10).optional().nullable(),
  is_default: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'buyer') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const res = await query(
      `SELECT id, label, recipient_name, phone, address_line, city, postal_code, is_default, created_at
       FROM addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [user.id]
    );

    return NextResponse.json({ addresses: res.rows });
  } catch (err) {
    console.error('Get addresses error:', err);
    return NextResponse.json({ error: 'Gagal memuat alamat' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'buyer') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const validated = addressSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = validated.data;

    const newAddress = await withTransaction(async (client) => {
      // Cek apakah ini alamat pertama user
      const countRes = await client.query('SELECT COUNT(*)::int AS count FROM addresses WHERE user_id = $1', [user.id]);
      const isFirst = countRes.rows[0].count === 0;
      const shouldBeDefault = data.is_default || isFirst;

      if (shouldBeDefault) {
        await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
      }

      const insRes = await client.query(
        `INSERT INTO addresses (
          user_id, label, recipient_name, phone, address_line, city, postal_code, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, label, recipient_name, phone, address_line, city, postal_code, is_default`,
        [
          user.id,
          data.label,
          data.recipient_name,
          data.phone,
          data.address_line,
          data.city,
          data.postal_code || null,
          shouldBeDefault,
        ]
      );

      return insRes.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil disimpan',
      address: newAddress,
    }, { status: 201 });
  } catch (err) {
    console.error('Create address error:', err);
    return NextResponse.json({ error: 'Gagal menyimpan alamat' }, { status: 500 });
  }
}
