import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import {
  GuardError,
  findActiveOrdersByProduct,
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
        `SELECT id, name FROM products WHERE id = $1 AND is_deleted = FALSE FOR UPDATE`,
        [productId]
      );

      if (prodRes.rows.length === 0) {
        throw new GuardError('Produk tidak ditemukan', 404);
      }

      const product = prodRes.rows[0];

      // Tolak penghapusan selama produk masih terlibat dalam pesanan aktif
      const activeOrders = await findActiveOrdersByProduct(client, productId);
      if (activeOrders.length > 0) {
        throw new GuardError(
          `Produk masih dalam proses transaksi (${formatActiveOrderSummary(activeOrders)}). Selesaikan transaksi terlebih dahulu.`,
          400
        );
      }

      // Soft Delete untuk menjaga riwayat pesanan selesai dan ulasan pembeli tetap aman
      await client.query(
        `UPDATE products SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await client.query(`DELETE FROM cart_items WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM wishlists WHERE product_id = $1`, [productId]);
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
