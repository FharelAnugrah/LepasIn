import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import {
  GuardError,
  findActiveOrdersBySellerUserId,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const sellerId = Number(id);

    if (!sellerId) {
      return NextResponse.json({ error: 'ID seller tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Aksi harus berupa approve atau reject' },
        { status: 400 }
      );
    }

    const updatedSeller = await withTransaction(async (client) => {
      const targetRes = await client.query(
        `SELECT id, name, email, seller_status, was_approved
         FROM users
         WHERE id = $1 AND role = 'seller'
         FOR UPDATE`,
        [sellerId]
      );

      if (targetRes.rows.length === 0) {
        throw new GuardError('Penjual tidak ditemukan atau bukan role seller', 404);
      }

      const target = targetRes.rows[0];

      if (action === 'reject') {
        // Opsi A: Cegah penangguhan/penolakan toko selama masih ada pesanan aktif
        const activeOrders = await findActiveOrdersBySellerUserId(client, sellerId);
        if (activeOrders.length > 0) {
          const actionLabel =
            target.seller_status === 'approved' || target.was_approved
              ? 'ditangguhkan'
              : 'ditolak';
          throw new GuardError(
            `Toko masih memiliki pesanan aktif. Selesaikan dulu sebelum ${actionLabel}.`,
            400
          );
        }

        const updateRes = await client.query(
          `UPDATE users
           SET seller_status = 'rejected', updated_at = NOW()
           WHERE id = $1 AND role = 'seller'
           RETURNING id, name, email, seller_status, was_approved`,
          [sellerId]
        );
        return updateRes.rows[0];
      }

      const updateRes = await client.query(
        `UPDATE users
         SET seller_status = 'approved', was_approved = TRUE, updated_at = NOW()
         WHERE id = $1 AND role = 'seller'
         RETURNING id, name, email, seller_status, was_approved`,
        [sellerId]
      );
      return updateRes.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: `Penjual berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}`,
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
