'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Mail, Phone, Camera, UploadCloud, Trash2, Loader2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import CampusSelector from '@/components/ui/CampusSelector';
import { useToast } from '@/components/ui/Toast';
import { validateFullName, validatePhone } from '@/lib/validation';

export default function ProfileForm({ user, initialCampus }) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [campus, setCampus] = useState(initialCampus);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleAvatarUpload = async (file) => {
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';

    if (!validMimes.includes(file.type.toLowerCase()) && !validExtensions.includes(ext)) {
      toast.error('Format foto harus berupa JPG, PNG, atau WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto profil maksimal 5 MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah foto profil');
      }

      setAvatarUrl(data.url);
      toast.success('Foto profil berhasil diunggah.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const validateForm = () => {
    const errs = {};
    const nameErr = validateFullName(name);
    if (nameErr) errs.name = nameErr;
    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) errs.phone = phoneErr;
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          campus_id: campus ? campus.id : null,
          avatar_url: avatarUrl ? avatarUrl.trim() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan profil');
        setLoading(false);
        return;
      }

      toast.success('Profil berhasil diperbarui.');
      setLoading(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi gangguan jaringan');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">
          Profil dan Kampus Utama
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Perbarui identitas kontak serta kampus asalmu agar rekomendasi produk lebih relevan.
        </p>
      </div>

      <div className="surface-3d rounded-2xl p-6 md:p-8">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Avatar Profil Bulat */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-5 border-b border-border-subtle">
            <div className="relative group shrink-0">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border-subtle bg-surface-muted shadow-inner flex items-center justify-center">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={name || 'Foto Profil'}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="w-full h-full bg-navy-900 text-campus-gold font-extrabold text-2xl flex items-center justify-center uppercase select-none">
                    {name ? name.charAt(0) : 'U'}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-xs flex items-center justify-center text-white">
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md hover:bg-brand-blue-hover transition-colors"
                title="Unggah Foto Profil"
                aria-label="Unggah Foto Profil"
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1.5 flex-1 min-w-0">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <span className="text-sm font-bold text-ink">Foto Avatar Profil</span>
              <p className="text-xs text-ink-muted leading-relaxed">
                Tampilkan foto terbaikmu untuk identitas akun. Format JPG, PNG, atau WebP (maks. 5 MB).
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  icon={uploadingAvatar ? Loader2 : UploadCloud}
                  loading={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={uploadingAvatar}
                    onClick={() => setAvatarUrl('')}
                    className="text-danger-text hover:bg-danger-bg"
                    icon={Trash2}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-start">
            <Input
              id="profile-name"
              label="Nama Lengkap"
              icon={User}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.name;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validateFullName(name);
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.name = err;
                  else delete n.name;
                  return n;
                });
              }}
              error={fieldErrors.name}
              required
            />

            <Input
              label="Email Mahasiswa"
              type="email"
              icon={Mail}
              value={user.email}
            />

            <Input
              id="profile-phone"
              label="Nomor WhatsApp / HP"
              type="tel"
              icon={Phone}
              placeholder="081234567890"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.phone;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                if (phone) {
                  const err = validatePhone(phone);
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.phone = err;
                    else delete n.phone;
                    return n;
                  });
                }
              }}
              error={fieldErrors.phone}
              helperText="Digunakan penjual untuk koordinasi saat COD ketemuan"
            />

            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-medium text-ink-secondary">
                Kampus Utama
              </span>
              <CampusSelector
                value={campus}
                onChange={setCampus}
                allowAll={true}
                allLabel="Pilih Kampus"
                placeholder="Pilih kampus tempat kuliahmu..."
                fullWidth={true}
                className="w-full"
              />
              <p className="text-xs text-ink-muted mt-0.5">
                Membantu menampilkan rekomendasi barang sekampus secara otomatis di beranda.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              Pastikan nomor WhatsApp aktif untuk mempermudah transaksi COD sekampus.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full sm:w-auto min-w-[180px] rounded-xl shrink-0"
            >
              Simpan Perubahan Profil
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
