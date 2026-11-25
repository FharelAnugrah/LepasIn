import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { createSession } from '@/lib/session';
import {
  validateFullName,
  validatePhone,
  validateEmail,
  normalizePhoneNumber,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }
    if (user.role !== 'seller' || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Format payload JSON tidak valid' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Format payload tidak valid' }, { status: 400 });
    }

    const { name, phone, email } = body;

    const fieldErrors = {};
    const nameErr = validateFullName(name);
    if (nameErr) fieldErrors.name = nameErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) fieldErrors.phone = phoneErr;

    const emailErr = validateEmail(email);
    if (emailErr) fieldErrors.email = emailErr;

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          error: Object.values(fieldErrors)[0],
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const cleanPhone = normalizePhoneNumber(phone);
    const normalizedEmail = String(email).trim().toLowerCase();

    const txResult = await withTransaction(async (client) => {
      const duplicateCheck = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2`,
        [normalizedEmail, user.id]
      );

      if (duplicateCheck.rows.length > 0) {
        return { conflict: true };
      }

      const updateRes = await client.query(
        `UPDATE users
         SET name = $1,
             phone = $2,
             email = $3,
             updated_at = NOW()
         WHERE id = $4 AND role = 'seller'
         RETURNING id, name, email, phone, role, seller_status, campus_id`,
        [trimmedName, cleanPhone, normalizedEmail, user.id]
      );

      return { conflict: false, updatedUser: updateRes.rows[0] };
    });

    if (txResult.conflict) {
      const msg = 'Alamat email ini sudah digunakan oleh akun lain.';
      return NextResponse.json(
        { error: msg, errors: { email: msg } },
        { status: 409 }
      );
    }

    const updatedUser = txResult.updatedUser;
    if (!updatedUser) {
      return NextResponse.json({ error: 'Akun penjual tidak ditemukan' }, { status: 404 });
    }

    await createSession({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      sellerStatus: updatedUser.seller_status,
      campusId: updatedUser.campus_id,
      storeId: user.store_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Identitas pribadi penjual berhasil diperbarui.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    if (error?.code === '23505') {
      const msg = 'Alamat email ini sudah digunakan oleh akun lain.';
      return NextResponse.json(
        { error: msg, errors: { email: msg } },
        { status: 409 }
      );
    }
    console.error('Update seller profile error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui identitas pribadi' }, { status: 500 });
  }
}
