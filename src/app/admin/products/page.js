import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import ProductsModerationManager from './ProductsModerationManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Moderasi Produk | Admin LepasIn',
};

export default async function AdminProductsPage() {
  await requireAdmin();

  const res = await query(`
    SELECT p.id, p.name, p.description, p.price, p.stock, p.condition, p.created_at,
           c.name AS category_name,
           s.id AS store_id, s.name AS store_name,
           u.seller_status,
           cp.name AS campus_name, cp.short_name AS campus_short_name, cp.city AS campus_city,
           (SELECT pi.url FROM product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.position ASC, pi.id ASC LIMIT 1) AS image_url,
           COALESCE(
             (SELECT json_agg(pi.url ORDER BY pi.position ASC, pi.id ASC)
              FROM product_images pi
              WHERE pi.product_id = p.id),
             '[]'::json
           ) AS images
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN stores s ON s.id = p.store_id
    JOIN users u ON u.id = s.user_id
    JOIN campuses cp ON cp.id = s.campus_id
    ORDER BY p.created_at DESC
  `);

  return <ProductsModerationManager initialProducts={res.rows} />;
}
