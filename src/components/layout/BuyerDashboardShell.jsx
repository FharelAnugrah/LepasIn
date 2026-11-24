'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  User,
  MapPin,
  ShoppingBag,
  GraduationCap,
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

  const identitySlot = (
    <div className="p-3 rounded-2xl surface-3d flex items-center gap-3">
      {user?.avatar_url ? (
        <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border-subtle bg-surface-muted shadow-inner">
          <Image
            src={user.avatar_url}
            alt={user.name || 'Avatar'}
            fill
            unoptimized
            className="object-cover"
            sizes="40px"
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl icon-plinth-navy text-white font-bold text-sm flex items-center justify-center uppercase shrink-0">
          {user.name ? user.name.charAt(0) : 'B'}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink truncate">{user.name}</p>
        <p className="text-[11px] text-brand-blue font-semibold truncate flex items-center gap-1 mt-0.5">
          <GraduationCap className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{user.campus_short_name || 'Akun Pembeli'}</span>
        </p>
      </div>
    </div>
  );

  return (
    <DashboardShell
      user={user}
      cartCount={cartCount}
      cartTotal={cartTotal}
      navAriaLabel="Navigasi akun pembeli"
      mobileNavAriaLabel="Menu akun pembeli"
      sectionTitle="Akun Pembeli"
      navItems={navItems}
      identitySlot={identitySlot}
      catalogHref="/products"
      catalogLabel="Jelajah Katalog"
      catalogIcon={ShoppingBag}
      logoutLabel="Keluar"
    >
      {children}
    </DashboardShell>
  );
}
