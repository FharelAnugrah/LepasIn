'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  User,
  MapPin,
  ShoppingBag,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function BuyerDashboardShell({
  user,
  cartCount = 0,
  cartTotal = 0,
  children,
}) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Ringkasan Akun',
      href: '/buyer',
      icon: LayoutDashboard,
      isActive: pathname === '/buyer',
    },
    {
      label: 'Pesanan Saya',
      href: '/buyer/orders',
      icon: Package,
      isActive: pathname.startsWith('/buyer/orders'),
    },
    {
      label: 'Profil & Kampus',
      href: '/buyer/profile',
      icon: User,
      isActive: pathname.startsWith('/buyer/profile'),
    },
    {
      label: 'Alamat',
      href: '/buyer/addresses',
      icon: MapPin,
      isActive: pathname.startsWith('/buyer/addresses'),
    },
  ];

  return (
    <DashboardShell
      user={user}
      cartCount={cartCount}
      cartTotal={cartTotal}
      navAriaLabel="Navigasi akun pembeli"
      mobileNavAriaLabel="Menu akun pembeli"
      sectionTitle="Akun Pembeli"
      navItems={navItems}
      catalogHref="/products"
      catalogLabel="Jelajah Katalog"
      catalogIcon={ShoppingBag}
      logoutLabel="Keluar"
    >
      {children}
    </DashboardShell>
  );
}
