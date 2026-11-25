'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

/**
 * Shell layout seragam untuk Dashboard Pembeli, Penjual, dan Admin:
 * Top Navbar + container max-w-7xl + floating sticky 3D sidebar + tab horizontal mobile + Footer & BottomNav.
 */
export default function DashboardShell({
  user,
  cartCount = 0,
  cartTotal = 0,
  navAriaLabel,
  mobileNavAriaLabel,
  sectionTitle,
  navItems = [],
  catalogHref = null,
  catalogLabel = null,
  catalogIcon: CatalogIcon = ShoppingBag,
  logoutLabel = 'Keluar',
  children,
}) {
  const router = useRouter();
  const isRestrictedRole = user?.role === 'admin' || user?.role === 'seller';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <Navbar
        user={user}
        cartCount={cartCount}
        showSearchBar={false}
        showCampusSelector={false}
        showUserMenu={false}
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 md:py-7 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Desktop Floating Sticky 3D Left Sidebar */}
        <aside
          aria-label={navAriaLabel}
          className="hidden lg:flex lg:flex-col w-64 shrink-0 surface-3d rounded-2xl p-4 justify-between gap-6 sticky-sidebar-dashboard"
        >
          <nav className="flex flex-col gap-1.5">
            <p className="px-3 pb-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              {sectionTitle}
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm transition-all ${
                    item.isActive
                      ? 'nav-pill-3d-active font-semibold'
                      : 'text-ink-secondary hover:bg-canvas hover:text-ink font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-campus-gold text-ink tabular-nums shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-border-subtle flex flex-col gap-1">
            {catalogHref && catalogLabel && (
              <Link
                href={catalogHref}
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-secondary hover:bg-canvas hover:text-ink transition-colors"
              >
                <CatalogIcon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span>{catalogLabel}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-danger-text hover:bg-danger-bg transition-colors text-left"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
              <span>{logoutLabel}</span>
            </button>
          </div>
        </aside>

        {/* Konten Utama */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile Horizontal Scrollable Tab Navigation */}
          <nav
            aria-label={mobileNavAriaLabel}
            className="lg:hidden bg-surface border border-border-subtle rounded-2xl p-1.5 mb-5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] rounded-xl px-3.5 py-2 text-xs whitespace-nowrap transition-colors shrink-0 ${
                    item.isActive
                      ? 'bg-brand-blue-soft text-brand-blue font-semibold'
                      : 'bg-canvas border border-border-subtle text-ink-secondary font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-campus-gold text-ink text-[10px] font-bold tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl px-3.5 py-2 text-xs whitespace-nowrap transition-colors shrink-0 bg-danger-bg/70 border border-red-200 text-danger-text font-semibold hover:bg-danger-bg ml-auto"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{logoutLabel}</span>
            </button>
          </nav>

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 outline-none"
          >
            {children}
          </main>
        </div>
      </div>

      <Footer minimal={isRestrictedRole} />
      <BottomNav user={user} cartCount={cartCount} cartTotal={cartTotal} />
    </div>
  );
}
