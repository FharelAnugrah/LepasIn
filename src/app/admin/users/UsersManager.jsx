'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  Store,
  ShoppingBag,
  GraduationCap,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

function UserRowActions({ user, isCurrentAdmin, onDelete }) {
  if (isCurrentAdmin) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-muted bg-surface-muted border border-border-subtle select-none">
        <Lock className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
        <span>Akun Terproteksi</span>
      </span>
    );
  }

  return (
    <>
      <Button
        href={`/admin/users/${user.id}/edit`}
        variant="secondary"
        size="sm"
        icon={Edit2}
        title="Edit pengguna"
      >
        Edit
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon={Trash2}
        onClick={() => onDelete(user)}
        title="Hapus pengguna"
      >
        Hapus
      </Button>
    </>
  );
}

export default function UsersManager({ initialUsers, currentAdminId }) {
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState(initialUsers);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    user: null,
    loading: false,
  });

  const [blockedDialog, setBlockedDialog] = useState({
    isOpen: false,
    user: null,
  });

  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilter === 'all' ? true : u.role === roleFilter;
    if (!matchRole) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      (u.campus_name && u.campus_name.toLowerCase().includes(q)) ||
      (u.campus_short_name && u.campus_short_name.toLowerCase().includes(q))
    );
  });

  const handleOpenDelete = (u) => {
    if (u.id === currentAdminId) {
      toast.warning('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    const activeBuyerCount = u.active_buyer_orders_count || 0;
    const activeSellerCount = u.active_seller_orders_count || 0;
    if (activeBuyerCount + activeSellerCount > 0) {
      setBlockedDialog({
        isOpen: true,
        user: u,
      });
      return;
    }

    setDeleteDialog({
      isOpen: true,
      user: u,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { user: target } = deleteDialog;
    if (!target) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'ACTIVE_ORDERS') {
          const updatedUser = {
            ...target,
            active_buyer_orders_count:
              data.active_buyer_orders_count ?? target.active_buyer_orders_count ?? 0,
            active_seller_orders_count:
              data.active_seller_orders_count ?? target.active_seller_orders_count ?? 0,
          };
          setUsers((prev) => prev.map((item) => (item.id === target.id ? updatedUser : item)));
          setDeleteDialog({ isOpen: false, user: null, loading: false });
          setBlockedDialog({ isOpen: true, user: updatedUser });
          return;
        }
        toast.error(data.error || 'Gagal menghapus pengguna');
        setDeleteDialog({ isOpen: false, user: null, loading: false });
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== target.id));
      toast.success(`Pengguna ${target.name} berhasil dihapus`);
      setDeleteDialog({ isOpen: false, user: null, loading: false });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus pengguna');
      setDeleteDialog({ isOpen: false, user: null, loading: false });
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <Badge variant="navy" size="xs" icon={ShieldCheck}>
          Admin
        </Badge>
      );
    }
    if (role === 'seller') {
      return (
        <Badge variant="mint" size="xs" icon={Store}>
          Penjual
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" size="xs" icon={ShoppingBag}>
        Pembeli
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
          Kelola Pengguna
        </h1>
        <p className="text-xs md:text-sm text-ink-muted mt-1">
          Daftar seluruh akun terdaftar (Admin, Penjual, dan Pembeli) di seluruh Indonesia.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter peran pengguna"
          className="inline-flex p-1 bg-surface-muted rounded-xl border border-border-subtle overflow-x-auto no-scrollbar"
        >
          {[
            { id: 'all', label: 'Semua Peran' },
            { id: 'buyer', label: 'Pembeli' },
            { id: 'seller', label: 'Penjual' },
          ].map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoleFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-surface text-brand-blue font-bold shadow-xs'
                    : 'text-ink-subtle font-semibold hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <label htmlFor="admin-users-search" className="sr-only">
            Cari pengguna berdasarkan nama, email, atau kampus
          </label>
          <Search
            className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="admin-users-search"
            type="search"
            placeholder="Cari nama, email, kampus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] md:min-h-[40px] pl-10 pr-4 text-base md:text-sm bg-surface border border-border-subtle rounded-lg text-ink placeholder:text-ink-muted focus:border-brand-blue transition-colors"
          />
        </div>
      </div>

      <div className="surface-3d rounded-2xl overflow-hidden">
        <div className="md:hidden divide-y divide-border-subtle">
          {filteredUsers.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-ink-muted">
              Tidak ada pengguna yang cocok.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isCurrentAdmin = u.id === currentAdminId;
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-blue-soft text-brand-blue font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                      {u.name ? u.name.charAt(0) : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-ink flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{u.name}</span>
                          {isCurrentAdmin && (
                            <span className="text-[11px] bg-navy-900 text-white font-semibold px-2 py-0.5 rounded-full shrink-0">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">{getRoleBadge(u.role)}</div>
                      </div>
                      <p className="text-xs text-ink-muted break-all mt-0.5">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary pl-12">
                    {u.campus_short_name && (
                      <span className="font-semibold text-navy-900 inline-flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0 text-brand-blue" aria-hidden="true" />
                        <span>{u.campus_short_name}</span>
                      </span>
                    )}
                    {u.phone && <span className="text-ink tabular-nums">{u.phone}</span>}
                    {u.role === 'seller' && u.seller_status && (
                      <span className="capitalize text-ink-muted">Status: {u.seller_status}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <UserRowActions
                      user={u}
                      isCurrentAdmin={isCurrentAdmin}
                      onDelete={handleOpenDelete}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-surface-muted text-ink-subtle font-semibold border-b border-border-subtle">
              <tr>
                <th className="py-3 px-3 xl:px-4">Pengguna</th>
                <th className="py-3 px-3 xl:px-4">Peran</th>
                <th className="py-3 px-3 xl:px-4">Kampus</th>
                <th className="hidden xl:table-cell py-3 px-4">Kontak</th>
                <th className="py-3 px-3 xl:px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-ink-muted">
                    Tidak ada pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.id === currentAdminId;
                  return (
                    <tr key={u.id} className="hover:bg-canvas transition-colors">
                      <td className="py-3.5 px-3 xl:px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-blue-soft text-brand-blue font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                            {u.name ? u.name.charAt(0) : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-ink flex items-center gap-1.5 flex-wrap">
                              <span>{u.name}</span>
                              {isCurrentAdmin && (
                                <span className="text-[11px] bg-navy-900 text-white font-semibold px-2 py-0.5 rounded-full">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted break-all">{u.email}</div>
                            {u.phone && (
                              <div className="xl:hidden text-xs text-ink-secondary tabular-nums mt-0.5">
                                {u.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 xl:px-4">
                        {getRoleBadge(u.role)}
                        {u.role === 'seller' && u.seller_status && (
                          <div className="text-[11px] text-ink-muted capitalize mt-1">
                            Status: {u.seller_status}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 xl:px-4">
                        {u.campus_short_name ? (
                          <div>
                            <span className="font-semibold text-navy-900 flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5 shrink-0 text-brand-blue" aria-hidden="true" />
                              <span>{u.campus_short_name}</span>
                            </span>
                            <span className="text-xs text-ink-muted">{u.campus_city}</span>
                          </div>
                        ) : (
                          <span className="text-ink-muted">-</span>
                        )}
                      </td>
                      <td className="hidden xl:table-cell py-3.5 px-4">
                        <span className="text-ink-secondary tabular-nums">{u.phone || '-'}</span>
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <UserRowActions
                            user={u}
                            isCurrentAdmin={isCurrentAdmin}
                            onDelete={handleOpenDelete}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, user: null, loading: false })}
        onConfirm={handleConfirmDelete}
        loading={deleteDialog.loading}
        title="Hapus Pengguna?"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteDialog.user?.name}" (${deleteDialog.user?.email})? Seluruh data yang terkait dengan akun ini akan ikut terhapus.`}
        confirmText="Ya, Hapus Pengguna"
        confirmVariant="danger"
        type="danger"
      />

      {/* Modal Peringatan: Akun Masih Memiliki Pesanan Aktif */}
      <Modal
        isOpen={blockedDialog.isOpen}
        onClose={() => setBlockedDialog({ isOpen: false, user: null })}
        maxWidth="max-w-md"
      >
        {blockedDialog.user &&
          (() => {
            const target = blockedDialog.user;
            const buyerOrders = target.active_buyer_orders_count || 0;
            const sellerOrders = target.active_seller_orders_count || 0;
            const totalActive = buyerOrders + sellerOrders;
            const hasBothOrderTypes = buyerOrders > 0 && sellerOrders > 0;
            const showBuyerCard = hasBothOrderTypes || (target.role !== 'seller' && sellerOrders === 0);
            const showSellerCard = hasBothOrderTypes || target.role === 'seller' || sellerOrders > 0;

            return (
              <div className="flex flex-col items-center text-center p-1 sm:p-2">
                <div className="w-13 h-13 rounded-2xl flex items-center justify-center mb-4 bg-warning-bg border border-amber-200 text-warning-text shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_3px_0_rgba(15,41,74,0.12)]">
                  <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                </div>

                <h3 className="text-lg font-bold text-ink mb-2">
                  Akun Pengguna Tidak Dapat Dihapus
                </h3>

                <p className="text-sm text-ink-secondary mb-4 leading-relaxed">
                  Akun <strong className="text-ink">&quot;{target.name}&quot;</strong> ({target.email}) saat ini masih memiliki{' '}
                  <strong className="text-warning-text">
                    {totalActive} pesanan aktif
                  </strong>
                  :
                </p>

                <div
                  className={`grid ${hasBothOrderTypes ? 'grid-cols-2' : 'grid-cols-1'} gap-3 w-full mb-4`}
                >
                  {showBuyerCard && (
                    <div className="surface-3d rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-xs text-ink-muted flex items-center gap-1.5 mb-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-brand-blue" aria-hidden="true" />
                        <span>Pesanan Pembelian</span>
                      </span>
                      <span className="text-base font-extrabold text-ink tabular-nums">
                        {buyerOrders} Pesanan
                      </span>
                    </div>
                  )}
                  {showSellerCard && (
                    <div className="surface-3d rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-xs text-ink-muted flex items-center gap-1.5 mb-1">
                        <Store className="w-3.5 h-3.5 text-navy-900" aria-hidden="true" />
                        <span>Pesanan Lapak</span>
                      </span>
                      <span className="text-base font-extrabold text-ink tabular-nums">
                        {sellerOrders} Pesanan
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-ink-muted bg-surface-muted border border-border-subtle rounded-xl p-3 mb-6 text-left leading-relaxed">
                  Demi melindungi hak transaksi pembeli dan penjual serta kejelasan proses pengiriman atau COD, akun baru dapat dihapus setelah seluruh pesanan aktif berstatus selesai atau dibatalkan.
                </p>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setBlockedDialog({ isOpen: false, user: null })}
                >
                  Saya Mengerti
                </Button>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
