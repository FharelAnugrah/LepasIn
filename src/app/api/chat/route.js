import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const sendMessageSchema = z.object({
  order_id: z.coerce.number().positive().optional().nullable(),
  store_id: z.coerce.number().positive().optional().nullable(),
  product_id: z.coerce.number().positive().optional().nullable(),
  recipient_id: z.coerce.number().positive().optional().nullable(),
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(1000, 'Pesan maksimal 1000 karakter'),
});

/**
 * Muat ruang percakapan terpadu (1 room per pasangan Pembeli <-> Toko).
 * Menggabungkan riwayat chat tanya produk & seluruh chat pesanan dalam satu timeline kronologis.
 */
async function loadUnifiedRoom({
  user,
  storeId,
  buyerId: requestedBuyerId = null,
  focusedOrderId = null,
  focusedProductId = null,
}) {
  const storeRes = await query(
    `SELECT s.id, s.name AS store_display_name, s.location AS store_location, s.user_id AS seller_user_id,
            c.name AS campus_name, c.short_name AS campus_short_name,
            u.name AS seller_full_name, u.seller_status
     FROM stores s
     LEFT JOIN campuses c ON c.id = s.campus_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [storeId]
  );

  if (storeRes.rows.length === 0) {
    return { error: 'Toko tidak ditemukan', status: 404 };
  }

  const store = storeRes.rows[0];
  const isSeller = user.id === store.seller_user_id || (user.store_id && user.store_id === store.id);
  const isBuyer = !isSeller;

  let buyerId = isBuyer ? user.id : requestedBuyerId;

  if (isSeller && !buyerId) {
    const lastPartnerRes = await query(
      `SELECT COALESCE(
                o.buyer_id,
                CASE WHEN ch.sender_id = $1 THEN ch.receiver_id ELSE ch.sender_id END
              ) AS buyer_id
       FROM chats ch
       LEFT JOIN orders o ON o.id = ch.order_id
       WHERE COALESCE(ch.store_id, o.store_id) = $2
         AND (ch.sender_id = $1 OR ch.receiver_id = $1)
       ORDER BY ch.created_at DESC, ch.id DESC
       LIMIT 1`,
      [store.seller_user_id, storeId]
    );
    if (lastPartnerRes.rows.length > 0) {
      buyerId = lastPartnerRes.rows[0].buyer_id;
    }
  }

  let partnerName = store.store_display_name || store.seller_full_name || 'Penjual';
  if (isSeller) {
    if (buyerId) {
      const buyerRes = await query(`SELECT name FROM users WHERE id = $1`, [buyerId]);
      partnerName = buyerRes.rows[0]?.name || 'Pembeli';
    } else {
      partnerName = 'Belum ada pembeli';
    }
  }

  // Ambil seluruh pesanan antara pasangan (store_id, buyer_id), utamakan pesanan aktif lalu terbaru
  let orders = [];
  if (buyerId) {
    const ordersRes = await query(
      `SELECT o.id, o.order_code, o.buyer_id, o.store_id, o.store_name, o.buyer_name,
              o.status, o.delivery_method, o.shipping_recipient, o.shipping_phone,
              o.shipping_address, o.note, o.total_amount, o.created_at,
              s.user_id AS seller_user_id,
              s.name AS store_display_name,
              s.location AS store_location,
              c.name AS campus_name,
              c.short_name AS campus_short_name,
              COALESCE(
                (SELECT json_agg(
                   json_build_object(
                     'id', oi.id,
                     'product_id', oi.product_id,
                     'product_name', oi.product_name,
                     'product_image_url', oi.product_image_url,
                     'unit_price', oi.unit_price,
                     'quantity', oi.quantity,
                     'subtotal', oi.subtotal
                   ) ORDER BY oi.id ASC
                 ) FROM order_items oi WHERE oi.order_id = o.id),
                '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN stores s ON s.id = o.store_id
       LEFT JOIN campuses c ON c.id = s.campus_id
       WHERE o.store_id = $1 AND o.buyer_id = $2
       ORDER BY
         CASE WHEN o.status IN ('pending_payment', 'processing', 'shipped') THEN 0 ELSE 1 END ASC,
         o.created_at DESC
       LIMIT 20`,
      [storeId, buyerId]
    );
    orders = ordersRes.rows;
  }

  // Ambil pesan terpadu antara penjual & pembeli pada toko ini (baik order maupun tanya produk)
  let messages = [];
  if (buyerId) {
    const msgRes = await query(
      `SELECT c.id, c.order_id, c.store_id, c.product_id, c.sender_id, c.receiver_id, c.message, c.created_at,
              u.name AS sender_name, u.role AS sender_role,
              o.order_code AS context_order_code,
              p.name AS context_product_name
       FROM chats c
       JOIN users u ON u.id = c.sender_id
       LEFT JOIN orders o ON o.id = c.order_id
       LEFT JOIN products p ON p.id = c.product_id
       WHERE COALESCE(c.store_id, o.store_id) = $1
         AND (
           (c.sender_id = $2 AND c.receiver_id = $3)
           OR (c.sender_id = $3 AND c.receiver_id = $2)
         )
       ORDER BY c.created_at ASC, c.id ASC`,
      [storeId, buyerId, store.seller_user_id]
    );
    messages = msgRes.rows;
  }

  // Ambil pesanan aktif terbaru pasangan ini (jika ada) untuk koordinasi otomatis di room umum
  const latestActiveOrder =
    orders.find((o) => ['pending_payment', 'processing', 'shipped'].includes(o.status)) || null;

  // Resolve konteks produk hanya jika dibuka lewat product_id atau pesan konteks terakhir adalah tanya produk (tanpa order aktif)
  let targetProductId = focusedProductId;
  if (!targetProductId && !focusedOrderId && !latestActiveOrder && messages.length > 0) {
    const lastContextMsg = messages
      .slice()
      .reverse()
      .find((m) => m.order_id || m.product_id);
    if (lastContextMsg && !lastContextMsg.order_id && lastContextMsg.product_id) {
      targetProductId = lastContextMsg.product_id;
    }
  }

  let product = null;
  if (targetProductId) {
    const prodRes = await query(
      `SELECT p.id, p.name, p.price, p.stock, p.condition,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1) AS image_url
       FROM products p
       WHERE p.id = $1 AND p.store_id = $2 AND p.is_deleted = FALSE`,
      [targetProductId, storeId]
    );
    if (prodRes.rows.length > 0) {
      product = prodRes.rows[0];
    }
  }

  // Tentukan konteks banner awal: order spesifik (via URL), pesanan aktif, inquiry produk, atau sesi obrolan umum berkelanjutan
  const activeOrder = focusedOrderId
    ? orders.find((o) => o.id === focusedOrderId) || null
    : !focusedProductId
    ? latestActiveOrder
    : null;

  const contextType = activeOrder ? 'order' : product ? 'inquiry' : 'general';

  return {
    data: {
      type: contextType,
      store,
      order: activeOrder,
      orders,
      items: activeOrder?.items || [],
      product,
      messages,
      currentUser: {
        id: user.id,
        name: user.name,
        role: user.role,
        isBuyer,
      },
      partner: isBuyer
        ? {
            id: store.seller_user_id,
            name: store.store_display_name || store.seller_full_name || 'Penjual',
            role: 'seller',
          }
        : {
            id: buyerId || null,
            name: partnerName,
            role: 'buyer',
          },
    },
  };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (user.role === 'seller' && user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akun penjual belum aktif' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get('order_id');
    const storeIdParam = searchParams.get('store_id');
    const productIdParam = searchParams.get('product_id');
    const buyerIdParam = searchParams.get('buyer_id');

    const focusedOrderId = orderIdParam ? Number(orderIdParam) : null;
    const focusedProductId = productIdParam ? Number(productIdParam) : null;
    const requestedBuyerId = buyerIdParam ? Number(buyerIdParam) : null;

    // 1. Jika dibuka dengan order_id: resolve (store_id, buyer_id) lalu muat room terpadu
    if (orderIdParam) {
      if (!focusedOrderId) {
        return NextResponse.json({ error: 'ID pesanan tidak valid' }, { status: 400 });
      }

      const orderLookup = await query(
        `SELECT o.id, o.buyer_id, o.store_id, s.user_id AS seller_user_id
         FROM orders o
         LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.id = $1`,
        [focusedOrderId]
      );

      if (orderLookup.rows.length === 0) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
      }

      const ord = orderLookup.rows[0];
      const isBuyer = ord.buyer_id === user.id;
      const isSeller = ord.seller_user_id === user.id || (user.store_id && user.store_id === ord.store_id);

      if (!isBuyer && !isSeller) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses ke percakapan pesanan ini' }, { status: 403 });
      }

      if (!ord.store_id) {
        return NextResponse.json({ error: 'Toko untuk pesanan ini sudah tidak tersedia' }, { status: 404 });
      }

      const roomResult = await loadUnifiedRoom({
        user,
        storeId: ord.store_id,
        buyerId: ord.buyer_id,
        focusedOrderId,
        focusedProductId,
      });

      if (roomResult.error) {
        return NextResponse.json({ error: roomResult.error }, { status: roomResult.status || 400 });
      }
      return NextResponse.json(roomResult.data);
    }

    // 2. Jika dibuka dengan store_id: muat room terpadu untuk pasangan (store_id, buyer_id)
    if (storeIdParam) {
      const storeId = Number(storeIdParam);
      if (!storeId) {
        return NextResponse.json({ error: 'ID toko tidak valid' }, { status: 400 });
      }

      const roomResult = await loadUnifiedRoom({
        user,
        storeId,
        buyerId: requestedBuyerId,
        focusedOrderId: null,
        focusedProductId,
      });

      if (roomResult.error) {
        return NextResponse.json({ error: roomResult.error }, { status: roomResult.status || 400 });
      }
      return NextResponse.json(roomResult.data);
    }

    // 3. Daftar percakapan inbox: Opsi 1 (hanya yang sudah memiliki >= 1 pesan) + Opsi 2 (1 room per pasangan buyer-toko)
    const convSql = `
      WITH user_chats AS (
        SELECT
          ch.id AS chat_id,
          ch.message,
          ch.created_at,
          ch.order_id,
          ch.product_id,
          COALESCE(ch.store_id, o.store_id) AS store_id,
          COALESCE(
            o.buyer_id,
            CASE
              WHEN ch.sender_id = s.user_id THEN ch.receiver_id
              ELSE ch.sender_id
            END
          ) AS buyer_id
        FROM chats ch
        LEFT JOIN orders o ON o.id = ch.order_id
        JOIN stores s ON s.id = COALESCE(ch.store_id, o.store_id)
        WHERE ch.sender_id = $1 OR ch.receiver_id = $1
      ),
      pair_agg AS (
        SELECT
          store_id,
          buyer_id,
          COUNT(*)::int AS message_count,
          MAX(created_at) AS last_message_time,
          (ARRAY_AGG(message ORDER BY created_at DESC, chat_id DESC))[1] AS last_message,
          (ARRAY_AGG(order_id ORDER BY created_at DESC, chat_id DESC))[1] AS last_chat_order_id,
          (ARRAY_AGG(product_id ORDER BY created_at DESC, chat_id DESC) FILTER (WHERE product_id IS NOT NULL))[1] AS last_chat_product_id
        FROM user_chats
        GROUP BY store_id, buyer_id
      )
      SELECT
        pa.store_id,
        pa.buyer_id,
        pa.message_count,
        pa.last_message,
        pa.last_message_time,
        pa.last_chat_order_id,
        s.name AS store_name,
        c.short_name AS campus_short_name,
        COALESCE(bu.name, 'Pembeli') AS buyer_name,
        lo.id AS latest_order_id,
        lo.order_code AS latest_order_code,
        lo.status AS latest_order_status,
        lo.delivery_method AS latest_order_delivery_method,
        lp.id AS product_id,
        lp.name AS product_name,
        (
          SELECT COUNT(*)::int
          FROM orders ao
          WHERE ao.store_id = pa.store_id
            AND ao.buyer_id = pa.buyer_id
            AND ao.status IN ('pending_payment', 'processing', 'shipped')
        ) AS active_orders_count,
        (
          SELECT COUNT(*)::int
          FROM orders tot
          WHERE tot.store_id = pa.store_id
            AND tot.buyer_id = pa.buyer_id
        ) AS total_orders_count,
        (
          SELECT STRING_AGG(o_all.order_code, ' ')
          FROM orders o_all
          WHERE o_all.store_id = pa.store_id
            AND o_all.buyer_id = pa.buyer_id
        ) AS searchable_order_codes
      FROM pair_agg pa
      JOIN stores s ON s.id = pa.store_id
      LEFT JOIN campuses c ON c.id = s.campus_id
      LEFT JOIN users bu ON bu.id = pa.buyer_id
      LEFT JOIN LATERAL (
        SELECT o2.id, o2.order_code, o2.status, o2.delivery_method
        FROM orders o2
        WHERE o2.store_id = pa.store_id AND o2.buyer_id = pa.buyer_id
        ORDER BY
          CASE WHEN o2.status IN ('pending_payment', 'processing', 'shipped') THEN 0 ELSE 1 END ASC,
          o2.created_at DESC
        LIMIT 1
      ) lo ON TRUE
      LEFT JOIN products lp ON lp.id = pa.last_chat_product_id
      ORDER BY pa.last_message_time DESC
      LIMIT 30
    `;

    const convRes = await query(convSql, [user.id]);

    return NextResponse.json({
      conversations: convRes.rows,
      currentUser: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat chat' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (user.role === 'seller' && user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Akun penjual belum aktif' }, { status: 403 });
    }

    const body = await request.json();
    const validated = sendMessageSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0]?.message || 'Data pesan tidak valid' }, { status: 400 });
    }

    const { order_id, store_id, product_id, recipient_id, message } = validated.data;

    // 1. Jika pengiriman pesan terkait Pesanan (order_id)
    if (order_id) {
      const orderRes = await query(
        `SELECT o.id, o.order_code, o.buyer_id, o.store_id, s.user_id AS seller_user_id
         FROM orders o
         LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.id = $1`,
        [order_id]
      );

      if (orderRes.rows.length === 0) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
      }

      const order = orderRes.rows[0];
      const isBuyer = order.buyer_id === user.id;
      const isSeller = order.seller_user_id === user.id || (user.store_id && user.store_id === order.store_id);

      if (!isBuyer && !isSeller) {
        return NextResponse.json({ error: 'Anda tidak berhak mengirim pesan pada pesanan ini' }, { status: 403 });
      }

      const receiverId = isBuyer ? order.seller_user_id : order.buyer_id;
      if (!receiverId) {
        return NextResponse.json({ error: 'Penerima pesan tidak ditemukan' }, { status: 400 });
      }

      const insertRes = await query(
        `INSERT INTO chats (order_id, store_id, sender_id, receiver_id, message)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, order_id, store_id, product_id, sender_id, receiver_id, message, created_at`,
        [order_id, order.store_id, user.id, receiverId, message]
      );

      const inserted = insertRes.rows[0];

      return NextResponse.json({
        success: true,
        message: {
          ...inserted,
          sender_name: user.name,
          sender_role: user.role,
          context_order_code: order.order_code,
          context_product_name: null,
        },
      });
    }

    // 2. Jika pengiriman pesan Pra-Order / Tanya Produk (store_id)
    if (store_id) {
      const storeRes = await query(
        `SELECT s.id, s.name AS store_name, s.user_id AS seller_user_id, u.seller_status
         FROM stores s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1`,
        [store_id]
      );

      if (storeRes.rows.length === 0) {
        return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });
      }

      const store = storeRes.rows[0];
      const isSeller = user.id === store.seller_user_id || (user.store_id && user.store_id === store.id);

      if (!isSeller && store.seller_status !== 'approved') {
        return NextResponse.json(
          {
            error: `Toko "${store.store_name}" sedang ditangguhkan atau tidak aktif sehingga tidak dapat menerima pesan tanya produk baru.`,
          },
          { status: 400 }
        );
      }

      let receiverId = null;
      if (isSeller) {
        if (!recipient_id) {
          const lastInquiryRes = await query(
            `SELECT CASE WHEN ch.sender_id = $1 THEN ch.receiver_id ELSE ch.sender_id END AS other_user_id
             FROM chats ch
             LEFT JOIN orders o ON o.id = ch.order_id
             WHERE COALESCE(ch.store_id, o.store_id) = $2
               AND (ch.sender_id = $1 OR ch.receiver_id = $1)
             ORDER BY ch.created_at DESC, ch.id DESC
             LIMIT 1`,
            [user.id, store_id]
          );
          if (lastInquiryRes.rows.length > 0) {
            receiverId = lastInquiryRes.rows[0].other_user_id;
          } else {
            return NextResponse.json({ error: 'Belum ada pembeli yang memulai percakapan di lapak ini' }, { status: 400 });
          }
        } else {
          receiverId = recipient_id;
        }
      } else {
        receiverId = store.seller_user_id;
      }

      if (!receiverId || receiverId === user.id) {
        return NextResponse.json({ error: 'Penerima pesan tidak valid' }, { status: 400 });
      }

      let contextProductName = null;
      if (product_id) {
        const prodNameRes = await query(
          `SELECT name FROM products WHERE id = $1 AND store_id = $2`,
          [product_id, store_id]
        );
        contextProductName = prodNameRes.rows[0]?.name || null;
      }

      const insertRes = await query(
        `INSERT INTO chats (order_id, store_id, product_id, sender_id, receiver_id, message)
         VALUES (NULL, $1, $2, $3, $4, $5)
         RETURNING id, order_id, store_id, product_id, sender_id, receiver_id, message, created_at`,
        [store_id, product_id || null, user.id, receiverId, message]
      );

      const inserted = insertRes.rows[0];

      return NextResponse.json({
        success: true,
        message: {
          ...inserted,
          sender_name: user.name,
          sender_role: user.role,
          context_order_code: null,
          context_product_name: contextProductName,
        },
      });
    }

    return NextResponse.json({ error: 'ID pesanan atau ID toko harus disertakan' }, { status: 400 });
  } catch (error) {
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}
