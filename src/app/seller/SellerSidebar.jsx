'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function SellerSidebar({ user, newOrdersCount = 0, children }) {
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

  return (
    <DashboardShell
      user={user}
      navAriaLabel="Navigasi penjual"
      mobileNavAriaLabel="Menu penjual"
      sectionTitle="Menu Penjual"
      navItems={navItems}
      logoutLabel="Keluar Akun"
    >
      {children}
    </DashboardShell>
  );
}
