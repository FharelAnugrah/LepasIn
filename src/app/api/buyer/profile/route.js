import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { createSession } from '@/lib/session';
import { GuardError } from '@/lib/order-guards';
import {
  normalizePhoneNumber,
  validateEmail,
  validateFullName,
  validatePhone,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const MAX_PG_INT = 2147483647;

function parsePositivePgInt(value) {
  if (value === undefined || value === null || typeof value === 'boolean') return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= MAX_PG_INT ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isInteger(num) && num >= 1 && num <= MAX_PG_INT ? num : null;
}

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
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

    const { name, email, phone, campus_id, avatar_url } = body;

    const fieldErrors = {};
    const nameErr = validateFullName(name);
    if (nameErr) fieldErrors.name = nameErr;

    const emailErr = validateEmail(email);
    if (emailErr) fieldErrors.email = emailErr;

    let cleanPhone = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      if (typeof phone !== 'string') {
        fieldErrors.phone = 'Nomor WhatsApp tidak valid.';
      } else {
        const phoneErr = validatePhone(phone);
        if (phoneErr) {
          fieldErrors.phone = phoneErr;
        } else {
          cleanPhone = normalizePhoneNumber(phone);
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          error: Object.values(fieldErrors)[0],
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    let parsedCampusId = null;
    if (campus_id !== undefined && campus_id !== null && campus_id !== '') {
      parsedCampusId = parsePositivePgInt(campus_id);
      if (!parsedCampusId) {
        return NextResponse.json({ error: 'ID kampus tidak valid' }, { status: 400 });
      }
    }

    const cleanAvatarUrl =
      typeof avatar_url === 'string' && avatar_url.trim() ? avatar_url.trim() : null;

    if (
      cleanAvatarUrl &&
      (cleanAvatarUrl.startsWith('data:image/') ||
        (!cleanAvatarUrl.startsWith('/uploads/avatars/') &&
          !cleanAvatarUrl.startsWith('/uploads/') &&
          !/^https:\/\/[^\s]+$/i.test(cleanAvatarUrl)))
    ) {
      return NextResponse.json(
        { error: 'Format URL gambar tidak valid. Gambar harus diunggah melalui endpoint berkas.' },
        { status: 400 }
      );
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    const updatedUser = await withTransaction(async (client) => {
      if (cleanEmail !== String(user.email || '').toLowerCase()) {
        const existing = await client.query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
          [cleanEmail, user.id]
        );
        if (existing.rows.length > 0) {
          const msg = 'Alamat email ini sudah digunakan oleh akun lain.';
          const err = new GuardError(msg, 409);
          err.details = { errors: { email: msg } };
          throw err;
        }
      }

      if (parsedCampusId !== null) {
        const campusCheck = await client.query(`SELECT id FROM campuses WHERE id = $1`, [
          parsedCampusId,
        ]);
        if (campusCheck.rows.length === 0) {
          throw new GuardError('Kampus tidak ditemukan', 400);
        }
      }

      const result = await client.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             phone = $3,
             campus_id = $4,
             avatar_url = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, email, phone, role, seller_status, campus_id, avatar_url`,
        [cleanName, cleanEmail, cleanPhone, parsedCampusId, cleanAvatarUrl, user.id]
      );

      if (result.rows.length === 0) {
        throw new GuardError('Akun pengguna tidak ditemukan', 404);
      }

      return result.rows[0];
    });

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
      message: 'Profil berhasil diperbarui',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        campus_id: updatedUser.campus_id,
        avatar_url: updatedUser.avatar_url,
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
    if (error?.statusCode) {
      return NextResponse.json(
        { error: error.message, ...(error.details || {}) },
        { status: error.statusCode }
      );
    }
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui profil' }, { status: 500 });
  }
}
