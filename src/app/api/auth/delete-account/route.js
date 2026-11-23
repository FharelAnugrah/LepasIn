import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { deleteSession } from '@/lib/session';
import {
  GuardError,
  findActiveOrdersBySellerUserId,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    // Hanya seller berstatus rejected yang boleh menghapus akunnya sendiri dari halaman pending-seller
    if (user.role !== 'seller' || user.seller_status !== 'rejected') {
      return NextResponse.json(
        { error: 'Hanya akun penjual yang ditolak yang dapat menghapus akun sendiri' },
        { status: 403 }
      );
    }

    await withTransaction(async (client) => {
      const targetRes = await client.query(
        `SELECT id, role, seller_status FROM users WHERE id = $1 FOR UPDATE`,
        [user.id]
      );
      if (targetRes.rows.length === 0) {
        throw new GuardError('Akun tidak ditemukan', 404);
      }
      const target = targetRes.rows[0];
      if (target.role !== 'seller' || target.seller_status !== 'rejected') {
        throw new GuardError('Status akun tidak valid untuk penghapusan mandiri', 403);
      }

      const activeOrders = await findActiveOrdersBySellerUserId(client, user.id);
      if (activeOrders.length > 0) {
        throw new GuardError(
          `Akun tidak dapat dihapus karena masih ada pesanan aktif.`,
          400
        );
      }

      await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    });

    // Hapus sesi cookie
    await deleteSession();

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dihapus',
      redirectTo: '/register',
    });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus akun' },
      { status: 500 }
    );
  }
}
