import { requireApprovedSeller } from '@/lib/auth';
import { query } from '@/lib/db';
import SellerSidebar from './SellerSidebar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard Penjual | LepasIn',
};

export default async function SellerLayout({ children }) {
  const seller = await requireApprovedSeller();

  const storeRes = await query(`SELECT id, name, location, image_url FROM stores WHERE user_id = $1`, [
    seller.id,
  ]);
  const store = storeRes.rows[0];

  let newOrdersCount = 0;
  if (store) {
    const ordersRes = await query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE store_id = $1 AND status IN ('pending_payment', 'processing')`,
      [store.id]
    );
    newOrdersCount = ordersRes.rows[0]?.count || 0;
  }

  return (
    <SellerSidebar user={seller} store={store} newOrdersCount={newOrdersCount}>
      {children}
    </SellerSidebar>
  );
}
