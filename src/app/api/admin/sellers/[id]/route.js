import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import {
  GuardError,
  findActiveOrdersBySellerUserId,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

const MAX_PG_INT = 2147483647;
const VALID_ACTIONS = ['approve', 'reject', 'suspend', 'reactivate'];

function parsePositivePgInt(value) {
  const trimmed = String(value ?? '').trim();
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
    const sellerId = parsePositivePgInt(id);

    if (!sellerId) {
      return NextResponse.json({ error: 'ID penjual tidak valid' }, { status: 400 });
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

    const { action, reason } = body;

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'Aksi tidak valid. Harus berupa approve, reject, suspend, atau reactivate.' },
        { status: 400 }
      );
    }

    let trimmedReason = null;
    if (action === 'reject') {
      if (typeof reason !== 'string' || !reason.trim()) {
        return NextResponse.json(
          { error: 'Alasan penolakan wajib diisi.' },
          { status: 400 }
        );
      }
      trimmedReason = reason.trim();
      if (trimmedReason.length < 10) {
        return NextResponse.json(
          { error: 'Alasan penolakan minimal 10 karakter agar jelas bagi penjual.' },
          { status: 400 }
        );
      }
      if (trimmedReason.length > 500) {
        return NextResponse.json(
          { error: 'Alasan penolakan maksimal 500 karakter.' },
          { status: 400 }
        );
      }
      if ((trimmedReason.match(/[a-zA-Z]/g) || []).length < 3) {
        return NextResponse.json(
          { error: 'Alasan penolakan harus berupa keterangan yang jelas.' },
          { status: 400 }
        );
      }
    }

    const updatedSeller = await withTransaction(async (client) => {
      const targetRes = await client.query(
        `SELECT id, name, email, seller_status,
                COALESCE(was_approved, FALSE) AS was_approved,
                rejection_reason
         FROM users
         WHERE id = $1 AND role = 'seller'
         FOR UPDATE`,
        [sellerId]
      );

      if (targetRes.rows.length === 0) {
        throw new GuardError('Penjual tidak ditemukan atau bukan role seller', 404);
      }

      const target = targetRes.rows[0];

      if (action === 'approve') {
        if (target.seller_status !== 'pending') {
          throw new GuardError(
            target.seller_status === 'approved'
              ? 'Penjual ini sudah disetujui.'
              : 'Pengajuan penjual yang sudah ditolak bersifat final dan tidak dapat disetujui kembali.',
            400
          );
        }

        const updateRes = await client.query(
          `UPDATE users
           SET seller_status = 'approved', was_approved = TRUE, rejection_reason = NULL, updated_at = NOW()
           WHERE id = $1 AND role = 'seller'
           RETURNING id, name, email, seller_status, was_approved, rejection_reason`,
          [sellerId]
        );

        return updateRes.rows[0];
      }

      if (action === 'reject') {
        if (target.seller_status !== 'pending') {
          throw new GuardError(
            target.seller_status === 'approved'
              ? 'Toko yang sudah aktif tidak dapat ditolak sebagai pengajuan baru. Gunakan aksi Tangguhkan Toko.'
              : 'Pengajuan penjual ini sudah ditolak sebelumnya.',
            400
          );
        }

        const updateRes = await client.query(
          `UPDATE users
           SET seller_status = 'rejected', was_approved = FALSE, rejection_reason = $2, updated_at = NOW()
           WHERE id = $1 AND role = 'seller'
           RETURNING id, name, email, seller_status, was_approved, rejection_reason`,
          [sellerId, trimmedReason]
        );

        return updateRes.rows[0];
      }

      if (action === 'suspend') {
        if (target.seller_status !== 'approved') {
          throw new GuardError('Hanya toko yang sudah disetujui yang dapat ditangguhkan.', 400);
        }

        const activeOrders = await findActiveOrdersBySellerUserId(client, sellerId);
        if (activeOrders.length > 0) {
          throw new GuardError(
            'Toko masih memiliki pesanan aktif. Selesaikan dulu sebelum ditangguhkan.',
            400
          );
        }

        const updateRes = await client.query(
          `UPDATE users
           SET seller_status = 'rejected', updated_at = NOW()
           WHERE id = $1 AND role = 'seller'
           RETURNING id, name, email, seller_status, was_approved, rejection_reason`,
          [sellerId]
        );
        return updateRes.rows[0];
      }

      // action === 'reactivate'
      if (target.seller_status !== 'rejected' || !target.was_approved) {
        throw new GuardError(
          'Hanya toko yang sebelumnya pernah disetujui (ditangguhkan) yang dapat diaktifkan kembali.',
          400
        );
      }

      const updateRes = await client.query(
        `UPDATE users
         SET seller_status = 'approved', updated_at = NOW()
         WHERE id = $1 AND role = 'seller'
         RETURNING id, name, email, seller_status, was_approved, rejection_reason`,
        [sellerId]
      );
      return updateRes.rows[0];
    });

    const messages = {
      approve: 'Pengajuan penjual berhasil disetujui.',
      reject: 'Pengajuan penjual berhasil ditolak.',
      suspend: 'Toko penjual berhasil ditangguhkan sementara.',
      reactivate: 'Toko penjual berhasil diaktifkan kembali.',
    };

    return NextResponse.json({
      success: true,
      message: messages[action],
      seller: updatedSeller,
    });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin update seller error:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui status verifikasi penjual' },
      { status: 500 }
    );
  }
}
