import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import Navbar from '@/components/layout/Navbar';
import ChatClient from './ChatClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ruang Chat | LepasIn',
  description: 'Komunikasi langsung antara penjual dan pembeli untuk koordinasi COD kampus dan detail pesanan',
};

export default async function ChatPage({ searchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const initialOrderId = sp?.order_id ? Number(sp.order_id) : null;
  const initialStoreId = sp?.store_id ? Number(sp.store_id) : null;
  const initialProductId = sp?.product_id ? Number(sp.product_id) : null;
  const initialBuyerId = sp?.buyer_id ? Number(sp.buyer_id) : null;

  if (!user) {
    let redirectUrl = '/chat';
    if (initialOrderId) {
      redirectUrl = `/chat?order_id=${initialOrderId}`;
    } else if (initialStoreId) {
      redirectUrl = `/chat?store_id=${initialStoreId}${initialProductId ? `&product_id=${initialProductId}` : ''}`;
    }
    redirect(`/login?next=${encodeURIComponent(redirectUrl)}`);
  }

  if (user.role === 'admin') {
    redirect('/admin');
  }

  if (user.role === 'seller' && user.seller_status !== 'approved') {
    redirect('/pending-seller');
  }

  let cartCount = 0;
  if (user.role === 'buyer') {
    const cartRes = await query(
      `SELECT COALESCE(SUM(ci.quantity), 0)::int AS count FROM cart_items ci WHERE ci.user_id = $1`,
      [user.id]
    );
    cartCount = cartRes.rows[0]?.count || 0;
  }

  return (
    <div className="h-dvh flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar
        user={user}
        cartCount={cartCount}
        showSearchBar={false}
        showCampusSelector={false}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-3 flex flex-col outline-none"
      >
        <ChatClient
          user={user}
          initialOrderId={initialOrderId}
          initialStoreId={initialStoreId}
          initialProductId={initialProductId}
          initialBuyerId={initialBuyerId}
        />
      </main>
    </div>
  );
}
