/**
 * Helper guard transaksi pesanan aktif untuk menjaga integritas pesanan,
 * stok produk, ulasan, serta status toko/akun pengguna.
 */

export class GuardError extends Error {
  /**
   * @param {string} message Pesan error yang aman ditampilkan ke pengguna
   * @param {number} [statusCode=400] HTTP status code
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'GuardError';
    this.statusCode = statusCode;
  }
}

/**
 * Format ringkasan singkat daftar pesanan aktif untuk pesan toast agar tetap ringkas dan terbaca.
 * @param {Array<{order_code: string}>} orders
 * @returns {string}
 */
export function formatActiveOrderSummary(orders) {
  if (!orders || orders.length === 0) return '';
  if (orders.length === 1) {
    return `1 pesanan aktif (#${orders[0].order_code})`;
  }
  return `${orders.length} pesanan aktif (mis. #${orders[0].order_code})`;
}

/**
 * Ambil pesanan aktif yang memuat produk tertentu.
 */
export async function findActiveOrdersByProduct(dbClient, productId) {
  const res = await dbClient.query(
    `SELECT o.id, o.order_code, o.status, o.delivery_method, o.buyer_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = $1
       AND o.status IN ('pending_payment', 'processing', 'shipped')
     ORDER BY o.created_at DESC`,
    [productId]
  );
  return res.rows;
}

/**
 * Ambil seluruh pesanan aktif milik toko yang dikelola user penjual.
 */
export async function findActiveOrdersBySellerUserId(dbClient, sellerUserId) {
  const res = await dbClient.query(
    `SELECT o.id, o.order_code, o.status, o.delivery_method, o.buyer_name
     FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE s.user_id = $1
       AND o.status IN ('pending_payment', 'processing', 'shipped')
     ORDER BY o.created_at DESC`,
    [sellerUserId]
  );
  return res.rows;
}

/**
 * Ambil seluruh pesanan aktif milik user baik sebagai pembeli maupun pemilik toko.
 */
export async function findActiveOrdersByUserId(dbClient, userId) {
  const res = await dbClient.query(
    `SELECT o.id, o.order_code, o.status, o.delivery_method, o.buyer_name,
            CASE WHEN o.buyer_id = $1 THEN 'buyer' ELSE 'seller' END AS involvement
     FROM orders o
     LEFT JOIN stores s ON s.id = o.store_id
     WHERE (o.buyer_id = $1 OR s.user_id = $1)
       AND o.status IN ('pending_payment', 'processing', 'shipped')
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return res.rows;
}
