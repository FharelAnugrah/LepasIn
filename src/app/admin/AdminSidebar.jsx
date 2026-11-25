'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Users,
  Tags,
  GraduationCap,
  Package,
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

  return (
    <DashboardShell
      user={user}
      navAriaLabel="Navigasi admin"
      mobileNavAriaLabel="Menu admin"
      sectionTitle="Manajemen Platform"
      navItems={navItems}
      logoutLabel="Keluar Akun"
    >
      {children}
    </DashboardShell>
  );
}
