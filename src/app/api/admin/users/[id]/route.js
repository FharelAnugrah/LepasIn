import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { createSession } from '@/lib/session';
import {
  normalizePhoneNumber,
  validateEmail,
  validateFullName,
  validatePhone,
} from '@/lib/validation';
import {
  GuardError,
  findActiveOrdersByUserId,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

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

export async function PATCH(request, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const targetUserId = parsePositivePgInt(id);

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
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

    const { name, email, phone, campus_id, role, seller_status } = body;

    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Nama lengkap wajib diisi.' }, { status: 400 });
    }

    const nameErr = validateFullName(name);
    if (nameErr) {
      return NextResponse.json(
        { error: nameErr, errors: { name: nameErr } },
        { status: 400 }
      );
    }

    const isEmailOmitted = email === undefined;
    let normalizedEmail = null;
    if (!isEmailOmitted) {
      if (typeof email !== 'string') {
        return NextResponse.json(
          {
            error: 'Alamat email aktif wajib diisi.',
            errors: { email: 'Alamat email aktif wajib diisi.' },
          },
          { status: 400 }
        );
      }
      const emailErr = validateEmail(email);
      if (emailErr) {
        return NextResponse.json(
          { error: emailErr, errors: { email: emailErr } },
          { status: 400 }
        );
      }
      normalizedEmail = email.trim().toLowerCase();
    }

    let cleanPhone = null;
    if (phone !== undefined && phone !== null && phone !== '') {
      if (typeof phone !== 'string') {
        return NextResponse.json({ error: 'Nomor WhatsApp tidak valid.' }, { status: 400 });
      }
      if (phone.trim() !== '') {
        const phoneErr = validatePhone(phone);
        if (phoneErr) {
          return NextResponse.json(
            { error: phoneErr, errors: { phone: phoneErr } },
            { status: 400 }
          );
        }
        cleanPhone = normalizePhoneNumber(phone);
      }
    }

    const isCampusOmitted = campus_id === undefined;
    let parsedCampusId = null;
    if (!isCampusOmitted && campus_id !== null && campus_id !== '') {
      parsedCampusId = parsePositivePgInt(campus_id);
      if (!parsedCampusId) {
        return NextResponse.json({ error: 'ID kampus tidak valid' }, { status: 400 });
      }
    }

    const updatedUser = await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, email, role, seller_status, was_approved, campus_id FROM users WHERE id = $1 FOR UPDATE`,
        [targetUserId]
      );

      if (existingRes.rows.length === 0) {
        throw new GuardError('User tidak ditemukan', 404);
      }

      const existing = existingRes.rows[0];

      // Admin tidak diperbolehkan mengganti role akun user
      if (role !== undefined && role !== null && role !== existing.role) {
        throw new GuardError('Peran akun (role) tidak dapat diubah.', 400);
      }

      const nextEmail = isEmailOmitted ? existing.email : normalizedEmail;
      if (nextEmail.toLowerCase() !== String(existing.email || '').toLowerCase()) {
        const duplicateEmail = await client.query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
          [nextEmail, targetUserId]
        );
        if (duplicateEmail.rows.length > 0) {
          const msg = 'Alamat email ini sudah digunakan oleh akun lain.';
          const err = new GuardError(msg, 409);
          err.details = { errors: { email: msg } };
          throw err;
        }
      }

      const nextRole = existing.role;

      if (nextRole === 'seller') {
        if (
          seller_status !== undefined &&
          seller_status !== null &&
          seller_status !== '' &&
          seller_status !== existing.seller_status
        ) {
          throw new GuardError(
            'Status verifikasi dan penangguhan penjual hanya dapat diubah melalui menu Verifikasi Penjual.',
            400
          );
        }
      } else if (seller_status !== undefined && seller_status !== null && seller_status !== '') {
        throw new GuardError('Status penjual hanya berlaku untuk akun penjual.', 400);
      }

      const nextCampusId = isCampusOmitted ? existing.campus_id : parsedCampusId;
      if (nextRole === 'seller' && !nextCampusId) {
        throw new GuardError('Akun penjual wajib terikat ke salah satu kampus.', 400);
      }

      if (nextCampusId !== null && nextCampusId !== existing.campus_id) {
        const campusCheck = await client.query(`SELECT id FROM campuses WHERE id = $1`, [
          nextCampusId,
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
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, name, email, role, seller_status, campus_id, phone`,
        [
          name.trim(),
          nextEmail,
          cleanPhone,
          nextCampusId,
          targetUserId,
        ]
      );

      if (nextRole === 'seller' && nextCampusId !== existing.campus_id) {
        await client.query(
          `UPDATE stores SET campus_id = $1, updated_at = NOW() WHERE user_id = $2`,
          [nextCampusId, targetUserId]
        );
      }

      return result.rows[0];
    });

    if (updatedUser.id === admin.id) {
      await createSession({
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        sellerStatus: updatedUser.seller_status,
        campusId: updatedUser.campus_id,
        storeId: admin.store_id,
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Data pengguna berhasil diperbarui',
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
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui pengguna' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const targetUserId = parsePositivePgInt(id);

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
    }

    // Cek: Dilarang menghapus akun sendiri! (ADM-2..4)
    if (targetUserId === admin.id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menghapus akun Anda sendiri' },
        { status: 400 }
      );
    }

    const deletedUser = await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, name FROM users WHERE id = $1 FOR UPDATE`,
        [targetUserId]
      );

      if (existingRes.rows.length === 0) {
        throw new GuardError('User tidak ditemukan', 404);
      }

      const activeOrders = await findActiveOrdersByUserId(client, targetUserId);
      if (activeOrders.length > 0) {
        const activeBuyerCount = activeOrders.filter((o) => o.involvement === 'buyer').length;
        const activeSellerCount = activeOrders.filter((o) => o.involvement === 'seller').length;
        const err = new GuardError(
          `Akun tidak dapat dihapus karena masih ada ${formatActiveOrderSummary(activeOrders)}.`,
          400
        );
        err.details = {
          code: 'ACTIVE_ORDERS',
          active_buyer_orders_count: activeBuyerCount,
          active_seller_orders_count: activeSellerCount,
        };
        throw err;
      }

      const result = await client.query(
        `DELETE FROM users WHERE id = $1 RETURNING id, name`,
        [targetUserId]
      );
      return result.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: `Pengguna ${deletedUser.name} berhasil dihapus`,
    });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json(
        { error: error.message, ...(error.details || {}) },
        { status: error.statusCode }
      );
    }
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Gagal menghapus pengguna' }, { status: 500 });
  }
}
