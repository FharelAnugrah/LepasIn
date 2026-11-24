import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import UsersManager from './UsersManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kelola Pengguna | Admin LepasIn',
};

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const res = await query(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.seller_status, u.created_at,
           c.id AS campus_id, c.name AS campus_name, c.short_name AS campus_short_name, c.city AS campus_city,
           (SELECT COUNT(*)::int FROM orders o
            WHERE o.buyer_id = u.id
              AND o.status IN ('pending_payment', 'processing', 'shipped')) AS active_buyer_orders_count,
           (SELECT COUNT(*)::int FROM orders o
            JOIN stores s ON s.id = o.store_id
            WHERE s.user_id = u.id
              AND o.status IN ('pending_payment', 'processing', 'shipped')) AS active_seller_orders_count
    FROM users u
    LEFT JOIN campuses c ON c.id = u.campus_id
    ORDER BY u.created_at DESC
  `);

  return <UsersManager initialUsers={res.rows} currentAdminId={admin.id} />;
}
