'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Users,
  Tags,
  GraduationCap,
  Package,
  ShieldCheck,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function AdminSidebar({ user, pendingCount = 0, children }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Ringkasan Statistik',
      href: '/admin',
      icon: LayoutDashboard,
      isActive: pathname === '/admin',
    },
    {
      label: 'Verifikasi Penjual',
      href: '/admin/sellers',
      icon: Store,
      badge: pendingCount > 0 ? pendingCount : null,
      isActive: pathname === '/admin/sellers',
    },
    {
      label: 'Kelola Pengguna',
      href: '/admin/users',
      icon: Users,
      isActive: pathname.startsWith('/admin/users'),
    },
    {
      label: 'Kategori Produk',
      href: '/admin/categories',
      icon: Tags,
      isActive: pathname === '/admin/categories',
    },
    {
      label: 'Daftar Kampus',
      href: '/admin/campuses',
      icon: GraduationCap,
      isActive: pathname === '/admin/campuses',
    },
    {
      label: 'Moderasi Produk',
      href: '/admin/products',
      icon: Package,
      isActive: pathname === '/admin/products',
    },
  ];

  const identitySlot = (
    <div className="p-3 rounded-2xl surface-3d flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl icon-plinth-navy text-campus-gold flex items-center justify-center shrink-0">
        <ShieldCheck className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink truncate">{user.name}</p>
        <p className="text-[11px] text-brand-blue font-semibold uppercase tracking-wider mt-0.5">
          Super Admin
        </p>
      </div>
    </div>
  );

  return (
    <DashboardShell
      user={user}
      navAriaLabel="Navigasi admin"
      mobileNavAriaLabel="Menu admin"
      sectionTitle="Manajemen Platform"
      navItems={navItems}
      identitySlot={identitySlot}
      logoutLabel="Keluar Akun"
    >
      {children}
    </DashboardShell>
  );
}
