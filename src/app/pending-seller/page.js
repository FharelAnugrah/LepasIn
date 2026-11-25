import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import PendingSellerClient from './PendingSellerClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Status Verifikasi Penjual | LepasIn',
  description: 'Status verifikasi akun penjual LepasIn.',
};

export default async function PendingSellerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role === 'admin') {
    redirect('/admin');
  }

  if (user.role !== 'seller') {
    redirect('/');
  }

  if (user.seller_status === 'approved') {
    redirect('/seller');
  }

  let csWhatsapp = process.env.NEXT_PUBLIC_CS_WHATSAPP?.trim() || '';
  if (!csWhatsapp) {
    try {
      const adminRes = await query(
        `SELECT phone
         FROM users
         WHERE role = 'admin' AND phone IS NOT NULL AND BTRIM(phone) <> ''
         ORDER BY id ASC
         LIMIT 1`
      );
      csWhatsapp = adminRes.rows[0]?.phone || '';
    } catch (err) {
      console.error('Error fetching CS admin phone:', err);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-canvas py-10 px-4 sm:px-6 lg:px-8 outline-none"
    >
      <PendingSellerClient user={user} csWhatsapp={csWhatsapp} />
    </main>
  );
}
