'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  GraduationCap,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function SellerSidebar({ user, store, newOrdersCount = 0, children }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Ringkasan Lapak',
      href: '/seller',
      icon: LayoutDashboard,
      isActive: pathname === '/seller',
    },
    {
      label: 'Kelola Produk',
      href: '/seller/products',
      icon: Package,
      isActive: pathname.startsWith('/seller/products'),
    },
    {
      label: 'Pesanan Masuk',
      href: '/seller/orders',
      icon: ShoppingBag,
      badge: newOrdersCount > 0 ? newOrdersCount : null,
      isActive: pathname.startsWith('/seller/orders'),
    },
    {
      label: 'Pengaturan Toko',
      href: '/seller/store',
      icon: Store,
      isActive: pathname === '/seller/store',
    },
  ];

  const identitySlot = (
    <div className="p-3 rounded-2xl surface-3d flex items-center gap-3">
      {store?.image_url ? (
        <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border-subtle bg-surface-muted shadow-inner">
          <Image
            src={store.image_url}
            alt={store.name || 'Lapak'}
            fill
            unoptimized
            className="object-cover"
            sizes="40px"
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl icon-plinth-navy text-white font-bold text-sm flex items-center justify-center uppercase shrink-0">
          {store?.name ? store.name.charAt(0) : 'T'}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink truncate">
          {store?.name || 'Lapak Saya'}
        </p>
        <p className="text-[11px] text-brand-blue font-semibold truncate flex items-center gap-1 mt-0.5">
          <GraduationCap className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{user.campus_short_name || 'Kampus Terdaftar'}</span>
        </p>
      </div>
    </div>
  );

  return (
    <DashboardShell
      user={user}
      navAriaLabel="Navigasi penjual"
      mobileNavAriaLabel="Menu penjual"
      sectionTitle="Menu Penjual"
      navItems={navItems}
      identitySlot={identitySlot}
      logoutLabel="Keluar Akun"
    >
      {children}
    </DashboardShell>
  );
}
