import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import AdminSidebar from './AdminSidebar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard Admin | LepasIn',
  description: 'Panel moderasi dan manajemen nasional LepasIn.',
};

export default async function AdminLayout({ children }) {
  const admin = await requireAdmin();

  let pendingCount = 0;
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = 'seller' AND seller_status = 'pending'`
    );
    pendingCount = res.rows[0]?.count || 0;
  } catch (err) {
    console.error('Error fetching pending count for admin layout:', err);
  }

  return (
    <AdminSidebar user={admin} pendingCount={pendingCount}>
      {children}
    </AdminSidebar>
  );
}
