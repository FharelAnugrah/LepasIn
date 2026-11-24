import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { validateFullName, validatePhone } from '@/lib/validation';
import {
  GuardError,
  findActiveOrdersBySellerUserId,
  findActiveOrdersByUserId,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const targetUserId = Number(id);

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { name, phone, campus_id, role, seller_status } = body;

    const nameErr = validateFullName(name);
    if (nameErr) {
      return NextResponse.json({ error: nameErr }, { status: 400 });
    }

    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) {
        return NextResponse.json({ error: phoneErr }, { status: 400 });
      }
    }

    const parsedCampusId = campus_id ? Number(campus_id) : null;

    const updatedUser = await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, role, seller_status, was_approved FROM users WHERE id = $1 FOR UPDATE`,
        [targetUserId]
      );

      if (existingRes.rows.length === 0) {
        throw new GuardError('User tidak ditemukan', 404);
      }

      const existing = existingRes.rows[0];
      const nextRole = role || existing.role;
      const nextSellerStatus = nextRole === 'seller' ? seller_status || 'approved' : null;

      if (targetUserId === admin.id && nextRole !== 'admin') {
        throw new GuardError('Anda tidak dapat menurunkan peran akun admin Anda sendiri', 400);
      }

      // Cegah penonaktifan penjual/toko bila masih ada pesanan aktif pada tokonya
      const isDeactivatingSeller =
        existing.role === 'seller' &&
        existing.seller_status === 'approved' &&
        (nextRole !== 'seller' || nextSellerStatus !== 'approved');

      if (isDeactivatingSeller) {
        const activeSellerOrders = await findActiveOrdersBySellerUserId(client, targetUserId);
        if (activeSellerOrders.length > 0) {
          throw new GuardError(
            `Status penjual tidak dapat diubah karena masih ada ${formatActiveOrderSummary(activeSellerOrders)}.`,
            400
          );
        }
      }

      // Cegah perubahan peran pembeli jika masih memiliki pesanan aktif sebagai pembeli
      if (existing.role === 'buyer' && nextRole !== 'buyer') {
        const activeUserOrders = await findActiveOrdersByUserId(client, targetUserId);
        const buyerOrders = activeUserOrders.filter((o) => o.involvement === 'buyer');
        if (buyerOrders.length > 0) {
          throw new GuardError(
            `Peran pembeli tidak dapat diubah karena masih ada ${formatActiveOrderSummary(buyerOrders)}.`,
            400
          );
        }
      }

      const nextWasApproved =
        existing.was_approved || (nextRole === 'seller' && nextSellerStatus === 'approved');

      const result = await client.query(
        `UPDATE users
         SET name = $1,
             phone = $2,
             campus_id = $3,
             role = $4,
             seller_status = $5,
             was_approved = $6
         WHERE id = $7
         RETURNING id, name, email, role, seller_status, campus_id, phone`,
        [
          name.trim(),
          phone ? phone.trim() : null,
          parsedCampusId,
          nextRole,
          nextSellerStatus,
          nextWasApproved,
          targetUserId,
        ]
      );

      return result.rows[0];
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Data pengguna berhasil diperbarui',
    });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
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
    const targetUserId = Number(id);

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
