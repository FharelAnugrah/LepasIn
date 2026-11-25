'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Clock,
  AlertCircle,
  Store,
  GraduationCap,
  RefreshCw,
  LogOut,
  Trash2,
  Eye,
  CreditCard,
  X,
  MessageCircle,
  AlertTriangle,
  Phone,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { normalizePhoneNumber } from '@/lib/validation';

function buildWhatsAppUrl(phone, user) {
  const cleaned = normalizePhoneNumber(phone);
  if (!cleaned) return null;
  const intl = cleaned.startsWith('0') ? `62${cleaned.slice(1)}` : cleaned;
  const message = `Halo CS Admin LepasIn, saya ${user.name} (${user.email}) pemilik toko "${
    user.store_name || '-'
  }" ingin mengklarifikasi status penangguhan akun toko saya.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export default function PendingSellerClient({ user, csWhatsapp = '' }) {
  const router = useRouter();
  const toast = useToast();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);

  const isRejected = user.seller_status === 'rejected';
  const wasPreviouslyApproved = Boolean(
    user.was_approved || (user.products_count && user.products_count > 0)
  );
  const isSuspended = isRejected && wasPreviouslyApproved;
  const isInitialRejected = isRejected && !wasPreviouslyApproved;

  const [showSuspendedModal, setShowSuspendedModal] = useState(isSuspended);
  const [prevIsSuspended, setPrevIsSuspended] = useState(isSuspended);
  if (isSuspended !== prevIsSuspended) {
    setPrevIsSuspended(isSuspended);
    setShowSuspendedModal(isSuspended);
  }

  const csPhoneDisplay = normalizePhoneNumber(csWhatsapp) || csWhatsapp || '';
  const csWhatsappUrl = buildWhatsAppUrl(csWhatsapp, user);

  useEffect(() => {
    if (!viewingPhoto) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setViewingPhoto(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewingPhoto]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/auth/refresh-session', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Gagal memeriksa status akun terbaru');
        setRefreshing(false);
        return;
      }
      if (data?.user?.sellerStatus === 'approved') {
        toast.success('Selamat, toko Anda telah disetujui admin.');
        router.push('/seller');
        router.refresh();
        return;
      }
      router.refresh();
      toast.info('Status akun telah diperbarui.');
    } catch (err) {
      console.error('Refresh session error:', err);
      toast.error('Gagal menghubungi server. Silakan coba lagi.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        toast.error('Gagal keluar dari akun');
        setIsLoggingOut(false);
        return;
      }
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan saat keluar');
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(
          isSuspended
            ? 'Akun dan toko Anda telah berhasil dihapus'
            : 'Data pengajuan telah dihapus. Silakan mendaftar kembali.'
        );
        router.push(data.redirectTo || '/register');
        router.refresh();
      } else {
        toast.error(data.error || 'Gagal menghapus akun');
        setIsDeleting(false);
        setShowConfirmDelete(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan');
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-2 sm:mt-4">
      <div className="surface-3d rounded-3xl p-5 sm:p-8 text-center">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label="Keluar dari akun"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-secondary hover:text-danger-text hover:bg-danger-bg transition-colors disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-blue focus-visible:outline-offset-2"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Keluar</span>
          </button>

          <span className="inline-flex items-baseline font-extrabold text-lg sm:text-xl text-navy-900 tracking-tight whitespace-nowrap">
            <span>LepasIn</span>
            <span
              className="w-2 h-2 rounded-[4px] bg-campus-gold inline-block ml-0.5 mb-0.5 shadow-[0_2px_0_#B87D04]"
              aria-hidden="true"
            />
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label="Refresh status verifikasi"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-blue hover:bg-brand-blue-soft transition-colors disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-blue focus-visible:outline-offset-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* Ikon Status 3D */}
        <div
          className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_0_rgba(15,41,74,0.12)] ${
            isRejected
              ? 'bg-danger-bg text-danger-text border border-red-200'
              : 'bg-warning-bg text-warning-text border border-amber-200'
          }`}
        >
          {isRejected ? (
            <AlertCircle className="w-8 h-8" aria-hidden="true" />
          ) : (
            <Clock className="w-8 h-8" aria-hidden="true" />
          )}
        </div>

        {/* Judul Status (design2.md 5.8) */}
        <h1 className="text-2xl font-bold text-ink tracking-tight mb-2">
          {isSuspended
            ? 'Akses Toko Ditangguhkan'
            : isInitialRejected
            ? 'Pendaftaran Toko Ditolak'
            : 'Akun Anda sedang ditinjau.'}
        </h1>

        <p className="text-sm text-ink-secondary leading-relaxed mb-6">
          {isSuspended
            ? ''
            : isInitialRejected
            ? 'Pengajuan pendaftaran tokomu belum memenuhi syarat verifikasi penjual LepasIn. Kamu dapat menghapus pengajuan ini untuk mendaftar ulang dengan data KTM yang valid.'
            : 'Admin LepasIn sedang memeriksa identitas dan data tokomu agar jual beli antarMahasiswa sekampus tetap aman dan terpercaya.'}
        </p>

        {isRejected && (
          <div className="p-4 mb-6 rounded-xl bg-danger-bg border border-red-200 text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger-text shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed min-w-0">
              <p className="font-bold text-danger-text">
                {isSuspended ? 'Penangguhan Aktif' : 'Alasan Penolakan dari Admin'}
              </p>
              <p className="text-ink mt-1 break-words font-medium">
                {isSuspended
                  ? 'Toko kamu sedang dibekukan sementara. Silakan hubungi Customer Service (WhatsApp Admin) untuk klarifikasi dan aktivasi kembali.'
                  : user.rejection_reason ||
                    'Pastikan foto selfie bersama KTM terlihat jelas dan data kampus sesuai saat mendaftar ulang.'}
              </p>
              {isInitialRejected && (
                <p className="text-ink-muted mt-1.5">
                  Keputusan pengajuan ini bersifat final. Kamu dapat menghapus akun ini terlebih dahulu
                  lalu mendaftar ulang dengan data yang telah diperbaiki.
                </p>
              )}
              {isSuspended && csPhoneDisplay && (
                <p className="text-ink-secondary mt-1.5 tabular-nums">
                  WhatsApp CS Admin: <strong className="text-ink">{csPhoneDisplay}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Ringkasan Nama Toko & Kampus Terdaftar (design2.md 5.8) */}
        <div
          className={`p-4 rounded-xl bg-canvas border border-border-subtle text-left flex flex-col gap-2.5 text-xs ${
            user.id_card_url ? 'mb-4' : isRejected ? 'mb-6' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
            <span className="text-ink-muted">Nama Penjual</span>
            <span className="font-semibold text-ink">{user.name}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
            <span className="text-ink-muted">Nama Toko</span>
            <span className="font-semibold text-ink inline-flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-brand-blue" aria-hidden="true" />
              <span>{user.store_name || '-'}</span>
            </span>
          </div>
          <div
            className={`flex items-center justify-between gap-2 ${
              isSuspended && user.products_count !== undefined
                ? 'border-b border-border-subtle pb-2'
                : ''
            }`}
          >
            <span className="text-ink-muted">Kampus Terdaftar</span>
            <span className="font-semibold text-brand-blue inline-flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{user.campus_name || user.campus_short_name || '-'}</span>
            </span>
          </div>
          {isSuspended && user.products_count !== undefined && (
            <div className="flex items-center justify-between gap-2 tabular-nums">
              <span className="text-ink-muted">Produk Terdaftar</span>
              <span className="font-semibold text-ink">{user.products_count} produk (dibekukan)</span>
            </div>
          )}
        </div>

        {/* Lampiran Foto Verifikasi */}
       

        {/* Tombol Aksi Utama (Saat Ditolak / Ditangguhkan) */}
        {isRejected && (
          <div
            className={
              isSuspended
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                : 'flex flex-col'
            }
          >
            {isSuspended && (
              <Button
                variant="primary"
                onClick={() => setShowSuspendedModal(true)}
                icon={MessageCircle}
                className="w-full"
              >
                Hubungi CS Admin
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => setShowConfirmDelete(true)}
              icon={Trash2}
              className="w-full"
            >
              Hapus Akun
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={handleDeleteAccount}
        loading={isDeleting}
        title={
          isSuspended
            ? 'Hapus Akun dan Toko yang Ditangguhkan?'
            : 'Hapus Akun dan Pengajuan Pendaftaran?'
        }
        message={
          isSuspended
            ? 'Tindakan ini permanen. Seluruh data akun, toko, produk, dan riwayat tokomu akan dihapus dari LepasIn.'
            : 'Tindakan ini permanen. Data akun dan pengajuan toko yang ditolak akan dihapus agar kamu dapat mendaftar ulang.'
        }
        confirmText="Ya, Hapus Akun"
        cancelText="Batal"
        confirmVariant="danger"
        type="danger"
      />

      {viewingPhoto && user.id_card_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto verifikasi KTM"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl max-w-lg w-full p-5 shadow-lg flex flex-col gap-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="min-w-0">
                <h2 className="font-bold text-ink text-sm md:text-base flex items-center gap-2 truncate">
                  <CreditCard className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                  <span>Foto Verifikasi Identitas (Selfie + KTM)</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Foto yang dikirimkan saat pendaftaran toko
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPhoto(false)}
                className="w-10 h-10 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted flex items-center justify-center"
                aria-label="Tutup foto"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative w-full h-80 sm:h-96 rounded-xl overflow-hidden bg-surface-muted border border-border-subtle">
              <Image
                src={user.id_card_url}
                alt="Foto Selfie dengan KTM"
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 640px) 90vw, 500px"
              />
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <p className="text-ink-muted">
                Pastikan kartu identitas terbaca jelas agar verifikasi dapat disetujui.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setViewingPhoto(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
