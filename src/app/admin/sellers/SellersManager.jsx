'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle,
  XCircle,
  Store,
  GraduationCap,
  Search,
  Phone,
  Mail,
  MapPin,
  Eye,
  CreditCard,
  X,
  AlertCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { SellerStatusBadge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const REJECT_REASON_PRESETS = [
  'Foto selfie bersama KTM buram atau tidak terbaca dengan jelas.',
  'Identitas pada KTM tidak sesuai dengan nama atau data pendaftar.',
  'Kartu identitas bukan KTM mahasiswa aktif atau sudah kedaluwarsa.',
  'Nama atau deskripsi lokasi toko melanggar ketentuan platform.',
];

function validateRejectionReason(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Alasan penolakan wajib diisi.';
  if (trimmed.length < 10) return 'Alasan penolakan minimal 10 karakter agar jelas bagi penjual.';
  if (trimmed.length > 500) return 'Alasan penolakan maksimal 500 karakter.';
  if ((trimmed.match(/[a-zA-Z]/g) || []).length < 3) {
    return 'Alasan penolakan harus berupa keterangan yang jelas.';
  }
  return null;
}

export default function SellersManager({
  initialSellers,
  initialStatus = 'all',
}) {
  const router = useRouter();
  const toast = useToast();

  const [sellers, setSellers] = useState(initialSellers);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [viewingPhoto, setViewingPhoto] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    seller: null,
    action: null,
    loading: false,
  });

  const [rejectDialog, setRejectDialog] = useState({
    isOpen: false,
    seller: null,
    reason: '',
    error: '',
    loading: false,
  });

  useEffect(() => {
    if (!viewingPhoto) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setViewingPhoto(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewingPhoto]);

  const filteredSellers = sellers.filter((s) => {
    const matchStatus =
      statusFilter === 'all' ? true : s.seller_status === statusFilter;

    if (!matchStatus) return false;
    if (!search.trim()) return true;

    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.store_name && s.store_name.toLowerCase().includes(q)) ||
      (s.campus_name && s.campus_name.toLowerCase().includes(q)) ||
      (s.campus_short_name && s.campus_short_name.toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
  });

  const handleActionClick = (seller, action) => {
    setConfirmDialog({
      isOpen: true,
      seller,
      action,
      loading: false,
    });
  };

  const handleOpenRejectDialog = (seller) => {
    setRejectDialog({
      isOpen: true,
      seller,
      reason: '',
      error: '',
      loading: false,
    });
  };

  const submitSellerAction = async (seller, action, reason = null) => {
    const res = await fetch(`/api/admin/sellers/${seller.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { action, reason } : { action }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Gagal mengubah status verifikasi' };
    }

    const updated = data.seller;
    setSellers((prev) =>
      prev.map((item) =>
        item.id === seller.id
          ? {
              ...item,
              seller_status: updated.seller_status,
              was_approved: Boolean(updated.was_approved),
              rejection_reason: updated.rejection_reason ?? null,
            }
          : item
      )
    );

    const successMsg =
      action === 'approve'
        ? `Toko ${seller.store_name} berhasil disetujui.`
        : action === 'reject'
        ? `Pendaftaran toko ${seller.store_name} ditolak.`
        : action === 'suspend'
        ? `Toko ${seller.store_name} berhasil ditangguhkan.`
        : `Toko ${seller.store_name} berhasil diaktifkan kembali.`;

    toast.success(successMsg);
    router.refresh();
    return { ok: true };
  };

  const handleConfirmAction = async () => {
    const { seller, action } = confirmDialog;
    if (!seller || !action) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      const result = await submitSellerAction(seller, action);
      if (!result.ok) {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan koneksi');
    } finally {
      setConfirmDialog({ isOpen: false, seller: null, action: null, loading: false });
    }
  };

  const handleSubmitReject = async (e) => {
    e.preventDefault();
    const { seller, reason, loading } = rejectDialog;
    if (!seller || loading) return;

    const reasonErr = validateRejectionReason(reason);
    if (reasonErr) {
      setRejectDialog((prev) => ({ ...prev, error: reasonErr }));
      return;
    }

    setRejectDialog((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const result = await submitSellerAction(seller, 'reject', reason.trim());
      if (!result.ok) {
        setRejectDialog((prev) => ({
          ...prev,
          loading: false,
          error: result.error,
        }));
        return;
      }
      setRejectDialog({
        isOpen: false,
        seller: null,
        reason: '',
        error: '',
        loading: false,
      });
    } catch (err) {
      console.error(err);
      setRejectDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Terjadi kesalahan koneksi. Silakan coba lagi.',
      }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">
          Verifikasi dan Daftar Penjual
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Tinjau pendaftaran toko Mahasiswa, cek foto KTM, dan kelola status penjual.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter status penjual"
          className="flex p-1 bg-surface rounded-xl border border-border-subtle overflow-x-auto no-scrollbar gap-1"
        >
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'pending', label: 'Menunggu Verifikasi' },
            { id: 'approved', label: 'Terverifikasi' },
            { id: 'rejected', label: 'Ditolak / Tangguh' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-brand-blue-soft text-brand-blue font-semibold'
                  : 'text-ink-secondary hover:text-ink hover:bg-canvas font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64 lg:w-72">
          <label htmlFor="admin-seller-search" className="sr-only">
            Cari penjual, toko, atau kampus
          </label>
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            id="admin-seller-search"
            type="text"
            placeholder="Cari penjual, toko, kampus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 md:h-10 pl-9 pr-4 text-base md:text-sm bg-surface text-ink placeholder:text-ink-muted border border-border-subtle rounded-lg focus:border-brand-blue focus:ring-3 focus:ring-brand-blue-soft outline-none transition-colors"
          />
        </div>
      </div>

      {filteredSellers.length === 0 ? (
        <div className="p-12 text-center surface-3d rounded-2xl">
          <Store className="w-10 h-10 text-ink-muted mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">Tidak ada penjual yang sesuai</h2>
          <p className="text-xs text-ink-muted mt-1">
            Coba ubah filter status atau kata kunci pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSellers.map((seller) => (
            <article
              key={seller.id}
              className="surface-3d rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-ink flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                      <span className="truncate">{seller.store_name || 'Nama Toko Belum Ada'}</span>
                    </h2>
                    <p className="text-xs text-ink-secondary font-medium mt-0.5">
                      Pemilik: <strong className="text-ink">{seller.name}</strong>
                    </p>
                  </div>
                  <SellerStatusBadge
                    status={seller.seller_status}
                    wasApproved={Boolean(seller.was_approved)}
                  />
                </div>

                <div className="p-3 rounded-lg bg-canvas border border-border-subtle flex flex-col gap-1.5 text-xs text-ink-secondary my-2">
                  <div className="flex items-center gap-1.5 text-brand-blue font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {seller.campus_short_name} - {seller.campus_name} ({seller.campus_city})
                    </span>
                  </div>

                  {seller.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span className="line-clamp-1">Area Kost: {seller.location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-border-subtle">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className="truncate">{seller.email}</span>
                  </div>

                  {seller.phone && (
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span>{seller.phone}</span>
                    </div>
                  )}
                </div>

                {/* Foto Verifikasi (Selfie + KTM) */}
                <div className="p-3 rounded-lg bg-canvas border border-border-subtle flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-xs my-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {seller.id_card_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingPhoto({
                            url: seller.id_card_url,
                            title: `KTM / Selfie: ${seller.name} (${seller.store_name})`,
                          })
                        }
                        className="relative w-11 h-11 rounded-lg overflow-hidden border border-border-subtle shrink-0"
                        aria-label={`Perbesar foto KTM ${seller.name}`}
                      >
                        <Image
                          src={seller.id_card_url}
                          alt={`KTM ${seller.name}`}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="44px"
                        />
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-surface-muted border border-border-subtle flex items-center justify-center shrink-0 text-ink-subtle">
                        <CreditCard className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                        <span>Selfie & KTM</span>
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {seller.id_card_url ? 'Foto verifikasi tersedia' : 'Belum ada foto verifikasi'}
                      </p>
                    </div>
                  </div>

                  {seller.id_card_url ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      icon={Eye}
                      onClick={() =>
                        setViewingPhoto({
                          url: seller.id_card_url,
                          title: `KTM / Selfie: ${seller.name} (${seller.store_name})`,
                        })
                      }
                    >
                      Lihat Foto
                    </Button>
                  ) : (
                    <span className="text-[11px] text-ink-muted bg-surface px-2 py-0.5 rounded-md border border-border-subtle font-medium">
                      Tanpa Foto
                    </span>
                  )}
                </div>

                {seller.seller_status === 'rejected' &&
                  !seller.was_approved &&
                  seller.rejection_reason && (
                    <div className="mt-2 p-3 rounded-lg bg-danger-bg border border-red-200 text-xs text-ink-secondary flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-danger-text shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-bold text-danger-text">Alasan Penolakan:</p>
                        <p className="mt-0.5 leading-relaxed break-words">
                          {seller.rejection_reason}
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
                {seller.seller_status === 'pending' && (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      icon={CheckCircle}
                      onClick={() => handleActionClick(seller, 'approve')}
                      className="flex-1"
                    >
                      Setujui
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={XCircle}
                      onClick={() => handleOpenRejectDialog(seller)}
                      className="flex-1"
                    >
                      Tolak
                    </Button>
                  </>
                )}

                {seller.seller_status === 'rejected' && seller.was_approved && (
                  <Button
                    variant="success"
                    size="sm"
                    icon={CheckCircle}
                    onClick={() => handleActionClick(seller, 'reactivate')}
                    className="w-full"
                  >
                    Aktifkan Toko Kembali
                  </Button>
                )}

                {seller.seller_status === 'rejected' && !seller.was_approved && (
                  <p className="w-full text-center text-xs font-medium text-ink-muted py-1.5">
                    Pengajuan ditolak.
                  </p>
                )}

                {seller.seller_status === 'approved' && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={XCircle}
                    onClick={() => handleActionClick(seller, 'suspend')}
                    className="w-full"
                  >
                    Tangguhkan Toko
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog({ isOpen: false, seller: null, action: null, loading: false })
        }
        onConfirm={handleConfirmAction}
        loading={confirmDialog.loading}
        title={
          confirmDialog.action === 'approve'
            ? 'Setujui Pengajuan Penjual?'
            : confirmDialog.action === 'reactivate'
            ? 'Aktifkan Toko Kembali?'
            : 'Tangguhkan Toko Penjual?'
        }
        message={
          confirmDialog.action === 'approve'
            ? `Toko "${confirmDialog.seller?.store_name}" milik ${confirmDialog.seller?.name} akan diaktifkan dan dapat berjualan di kampusnya.`
            : confirmDialog.action === 'reactivate'
            ? `Toko "${confirmDialog.seller?.store_name}" akan diaktifkan kembali dan dapat berjualan di kampusnya.`
            : `Toko "${confirmDialog.seller?.store_name}" akan ditangguhkan sementara. Seller akan melihat pop-up peringatan untuk menghubungi CS Admin.`
        }
        confirmText={
          confirmDialog.action === 'approve'
            ? 'Ya, Setujui'
            : confirmDialog.action === 'reactivate'
            ? 'Ya, Aktifkan Toko'
            : 'Ya, Tangguhkan Toko'
        }
        confirmVariant={confirmDialog.action === 'suspend' ? 'danger' : 'success'}
        type={confirmDialog.action === 'suspend' ? 'danger' : 'success'}
      />

      <Modal
        isOpen={rejectDialog.isOpen}
        onClose={() =>
          !rejectDialog.loading &&
          setRejectDialog({ isOpen: false, seller: null, reason: '', error: '', loading: false })
        }
        title="Tolak Pengajuan Penjual"
        subtitle={
          rejectDialog.seller?.store_name
            ? `Berikan alasan penolakan untuk toko ${rejectDialog.seller.store_name}`
            : 'Berikan alasan penolakan untuk pengajuan toko ini'
        }
        variant="danger"
        maxWidth="max-w-lg"
        showClose={!rejectDialog.loading}
      >
        <form noValidate onSubmit={handleSubmitReject} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-secondary">
              Pilihan Cepat Alasan Umum (Klik untuk mengisi):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASON_PRESETS.map((preset) => {
                const isSelected = rejectDialog.reason.trim() === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setRejectDialog((prev) => ({
                        ...prev,
                        reason: preset,
                        error: '',
                      }))
                    }
                    className={`text-left text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                      isSelected
                        ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                        : 'bg-canvas border-border-subtle text-ink-secondary hover:text-ink hover:border-red-300 hover:bg-red-50/50'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            id="reject-reason-textarea"
            label="Alasan Penolakan (Wajib Diisi)"
            rows={4}
            maxLength={500}
            placeholder="Jelaskan alasan pengajuan ditolak agar calon penjual mengetahui apa yang perlu diperbaiki..."
            value={rejectDialog.reason}
            onChange={(e) => {
              const val = e.target.value;
              setRejectDialog((prev) => ({
                ...prev,
                reason: val,
                error: prev.error ? validateRejectionReason(val) || '' : '',
              }));
            }}
            onBlur={() => {
              const err = validateRejectionReason(rejectDialog.reason);
              if (err) {
                setRejectDialog((prev) => ({ ...prev, error: err }));
              }
            }}
            error={rejectDialog.error}
            helperText={`${rejectDialog.reason.trim().length}/500 karakter — alasan ini akan ditampilkan kepada pendaftar toko.`}
            required
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setRejectDialog({
                  isOpen: false,
                  seller: null,
                  reason: '',
                  error: '',
                  loading: false,
                })
              }
              disabled={rejectDialog.loading}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={rejectDialog.loading}>
              Tolak Pengajuan
            </Button>
          </div>
        </form>
      </Modal>

      {viewingPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto verifikasi KTM penjual"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl max-w-lg w-full p-5 shadow-lg flex flex-col gap-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="min-w-0">
                <h2 className="font-bold text-ink text-sm md:text-base flex items-center gap-2 truncate">
                  <CreditCard className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                  <span className="truncate">{viewingPhoto.title}</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Verifikasi kartu identitas kampus & foto selfie penjual
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="w-10 h-10 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted flex items-center justify-center"
                aria-label="Tutup foto"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative w-full h-80 sm:h-96 rounded-xl overflow-hidden bg-surface-muted border border-border-subtle">
              <Image
                src={viewingPhoto.url}
                alt={viewingPhoto.title}
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 640px) 90vw, 500px"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
              <p className="text-ink-muted">
                Pastikan nama, foto KTM, dan wajah penjual sesuai sebelum menyetujui.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewingPhoto(null)}
                className="w-full sm:w-auto shrink-0"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
