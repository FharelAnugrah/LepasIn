import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import {
  GuardError,
  findActiveOrdersByProduct,
  countCompletedOrdersByProduct,
  formatActiveOrderSummary,
} from '@/lib/order-guards';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const productId = Number(id);

    if (!productId) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 });
    }

    const deletedProduct = await withTransaction(async (client) => {
      const prodRes = await client.query(
        `SELECT id, name FROM products WHERE id = $1 FOR UPDATE`,
        [productId]
      );

      if (prodRes.rows.length === 0) {
        throw new GuardError('Produk tidak ditemukan', 404);
      }

      const product = prodRes.rows[0];

      // Opsi A: Tolak penghapusan selama produk masih terlibat dalam pesanan aktif
      const activeOrders = await findActiveOrdersByProduct(client, productId);
      if (activeOrders.length > 0) {
        throw new GuardError(
          `Produk masih dalam proses transaksi. Selesaikan transaski terlebih dahulu.`,
          400
        );
      }

      // Jaga arsip pesanan selesai dan ulasan pembeli (reviews.product_id bersifat NOT NULL + CASCADE)
      const completedCount = await countCompletedOrdersByProduct(client, productId);
      if (completedCount > 0) {
        throw new GuardError(
          `Produk memiliki ${completedCount} riwayat pesanan selesai dan tidak dapat dihapus demi menjaga arsip ulasan.`,
          400
        );
      }

      await client.query(`DELETE FROM products WHERE id = $1`, [productId]);
      return product;
    });

    return NextResponse.json({
      success: true,
      message: `Produk "${deletedProduct.name}" berhasil dimoderasi dan dihapus`,
    });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Moderation delete product error:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus produk' },
      { status: 500 }
    );
  }
}
