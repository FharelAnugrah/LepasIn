'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Store,
  MapPin,
  Camera,
  UploadCloud,
  Trash2,
  Loader2,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import Input, { Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import CampusSelector from '@/components/ui/CampusSelector';
import { useToast } from '@/components/ui/Toast';
import {
  validateStoreName,
  validateStoreDescription,
  validateLocation,
  validateFullName,
  validatePhone,
  validateEmail,
  normalizePhoneNumber,
} from '@/lib/validation';
import { focusFirstInvalidField } from '@/lib/form-utils';

export default function StoreSettingsClient({
  store,
  initialCampus,
  campuses,
  seller = { name: '', email: '', phone: '' },
}) {
  const router = useRouter();
  const toast = useToast();

  const [savedSnapshot, setSavedSnapshot] = useState({
    name: store?.name || '',
    location: store?.location || '',
    description: store?.description || '',
    campusId: initialCampus?.id || null,
    imageUrl: store?.image_url || '',
  });

  const [name, setName] = useState(store?.name || '');
  const [location, setLocation] = useState(store?.location || '');
  const [description, setDescription] = useState(store?.description || '');
  const [campus, setCampus] = useState(initialCampus);
  const [imageUrl, setImageUrl] = useState(store?.image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState({
    name: seller?.name || '',
    phone: seller?.phone || '',
    email: seller?.email || '',
  });

  const [profileName, setProfileName] = useState(seller?.name || '');
  const [profilePhone, setProfilePhone] = useState(seller?.phone || '');
  const [profileEmail, setProfileEmail] = useState(seller?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});

  const hasUnsavedImageChange = imageUrl !== savedSnapshot.imageUrl;
  const hasUnsavedChanges =
    name.trim() !== savedSnapshot.name.trim() ||
    location.trim() !== savedSnapshot.location.trim() ||
    description.trim() !== savedSnapshot.description.trim() ||
    (campus?.id || null) !== savedSnapshot.campusId ||
    hasUnsavedImageChange;

  const hasUnsavedProfileChanges =
    profileName.trim() !== savedProfileSnapshot.name.trim() ||
    normalizePhoneNumber(profilePhone) !== normalizePhoneNumber(savedProfileSnapshot.phone) ||
    profileEmail.trim().toLowerCase() !== savedProfileSnapshot.email.trim().toLowerCase();

  const handleImageUpload = async (file) => {
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';

    if (!validMimes.includes(file.type.toLowerCase()) && !validExtensions.includes(ext)) {
      toast.error('Format foto harus berupa JPG, PNG, atau WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto toko maksimal 5 MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'stores');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah foto toko');
      }

      setImageUrl(data.url);
      toast.success('Foto siap dipasang. Klik Simpan Informasi Toko untuk menerapkan.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = () => {
    const errs = {};
    const nameErr = validateStoreName(name);
    if (nameErr) errs.name = nameErr;

    const descErr = validateStoreDescription(description);
    if (descErr) errs.description = descErr;

    if (!campus || !campus.id || Number(campus.id) <= 0) {
      errs.campus = 'Asal kampus wajib dipilih untuk mendaftarkan toko ke direktori kampus.';
    }

    if (location) {
      const locErr = validateLocation(location);
      if (locErr) errs.location = locErr;
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const idMap = {
        name: 'store-name-input',
        campus: 'store-campus-selector',
        location: 'store-location-input',
        description: 'store-description-input',
      };
      focusFirstInvalidField(Object.keys(errs).map((k) => idMap[k]).filter(Boolean));
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const trimmedName = name.trim();
      const trimmedLocation = location.trim();
      const trimmedDescription = description.trim();
      const cleanImage = imageUrl ? imageUrl.trim() : null;

      const res = await fetch('/api/seller/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          campus_id: campus.id,
          location: trimmedLocation,
          description: trimmedDescription,
          image_url: cleanImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan perubahan toko');
        setLoading(false);
        return;
      }

      setSavedSnapshot({
        name: trimmedName,
        location: trimmedLocation,
        description: trimmedDescription,
        campusId: campus.id,
        imageUrl: cleanImage || '',
      });
      toast.success('Informasi toko berhasil diperbarui.');
      setLoading(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi gangguan jaringan');
      setLoading(false);
    }
  };

  const validateProfileForm = () => {
    const errs = {};
    const nameErr = validateFullName(profileName);
    if (nameErr) errs.name = nameErr;

    const phoneErr = validatePhone(profilePhone);
    if (phoneErr) errs.phone = phoneErr;

    const emailErr = validateEmail(profileEmail);
    if (emailErr) errs.email = emailErr;

    return errs;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (profileLoading) return;

    const errs = validateProfileForm();
    if (Object.keys(errs).length > 0) {
      setProfileErrors(errs);
      const idMap = {
        name: 'seller-fullname-input',
        phone: 'seller-phone-input',
        email: 'seller-email-input',
      };
      focusFirstInvalidField(Object.keys(errs).map((k) => idMap[k]).filter(Boolean));
      return;
    }

    setProfileErrors({});
    setProfileLoading(true);

    try {
      const res = await fetch('/api/seller/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim(),
          email: profileEmail.trim().toLowerCase(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.errors && typeof data.errors === 'object') {
          setProfileErrors(data.errors);
          const idMap = {
            name: 'seller-fullname-input',
            phone: 'seller-phone-input',
            email: 'seller-email-input',
          };
          focusFirstInvalidField(Object.keys(data.errors).map((k) => idMap[k]).filter(Boolean));
        }
        toast.error(data.error || 'Gagal menyimpan identitas pribadi');
        setProfileLoading(false);
        return;
      }

      const updated = data.user || {};
      const nextName = updated.name || profileName.trim();
      const nextPhone = updated.phone || normalizePhoneNumber(profilePhone);
      const nextEmail = updated.email || profileEmail.trim().toLowerCase();

      setProfileName(nextName);
      setProfilePhone(nextPhone);
      setProfileEmail(nextEmail);
      setSavedProfileSnapshot({
        name: nextName,
        phone: nextPhone,
        email: nextEmail,
      });

      toast.success(data.message || 'Identitas pribadi berhasil diperbarui.');
      setProfileLoading(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi gangguan jaringan');
      setProfileLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-brand-blue" aria-hidden="true" />
            <span>Pengaturan Lapak dan Identitas Penjual</span>
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Sesuaikan informasi toko, lokasi COD, serta identitas pribadi akun penjual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
        {/* Kolom Kiri (7/12): Formulir Pengaturan Toko */}
        <section
          aria-labelledby="store-settings-heading"
          className="lg:col-span-7 surface-3d rounded-2xl p-5 sm:p-6 md:p-8"
        >
          <div className="flex items-start gap-2.5 pb-4 mb-5 border-b border-border-subtle">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0">
              <Store className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="store-settings-heading" className="text-base font-bold text-ink">
                Informasi Lapak dan Lokasi COD
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Tampil pada halaman toko dan etalase produk di kampus.
              </p>
            </div>
          </div>

          <form aria-labelledby="store-settings-heading" noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Upload Foto / Logo Toko */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-5 border-b border-border-subtle">
              <div className="relative group shrink-0">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-border-subtle bg-surface-muted shadow-inner flex items-center justify-center">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={name || 'Logo Toko'}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <div className="w-full h-full bg-navy-900 text-campus-gold font-bold text-3xl flex items-center justify-center uppercase select-none">
                      {name ? name.charAt(0) : <Store className="w-8 h-8" />}
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-xs flex items-center justify-center text-white">
                      <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-brand-blue text-white ring-2 ring-surface flex items-center justify-center shadow-md hover:bg-brand-blue-hover transition-colors"
                  title="Unggah Foto Toko"
                  aria-label="Unggah Foto Toko"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1.5 flex-1 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <span className="text-sm font-bold text-ink">Foto / Logo Toko</span>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Tampilkan foto etalase, logo lapak, atau identitas tokomu. Format JPG, PNG, atau WebP (maks. 5 MB).
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={uploadingImage ? Loader2 : UploadCloud}
                    loading={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUrl ? 'Ganti Foto' : 'Unggah Foto'}
                  </Button>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={uploadingImage}
                      onClick={() => setImageUrl('')}
                      className="text-danger-text hover:bg-danger-bg"
                      icon={Trash2}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
                {hasUnsavedImageChange && (
                  <p className="text-[11px] font-medium text-warning-text mt-1">
                    Perubahan foto belum tersimpan — klik Simpan Informasi Toko di bawah.
                  </p>
                )}
              </div>
            </div>

            <Input
              id="store-name-input"
              label="Nama Toko / Lapak *"
              placeholder="Contoh: Lapak Dinda UNHAS"
              icon={Store}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  const err = validateStoreName(e.target.value);
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.name = err;
                    else delete n.name;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validateStoreName(name);
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

            <CampusSelector
              id="store-campus-selector"
              label="Kampus Toko Terdaftar *"
              variant="field"
              value={campus}
              onChange={(val) => {
                setCampus(val);
                if (fieldErrors.campus) {
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.campus;
                    return n;
                  });
                }
              }}
              campuses={campuses}
              allowAll={false}
              placeholder="Pilih kampus terdaftar..."
              fullWidth={true}
              className="w-full"
              error={fieldErrors.campus}
            />

            <Input
              id="store-location-input"
              label="Detail Lokasi / Area Kost"
              placeholder="Contoh: Tamalanrea, Pintu 1 UNHAS atau Kukusan Teknik"
              icon={MapPin}
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (fieldErrors.location) {
                  const err = e.target.value ? validateLocation(e.target.value) : null;
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.location = err;
                    else delete n.location;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                if (location) {
                  const err = validateLocation(location);
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.location = err;
                    else delete n.location;
                    return n;
                  });
                }
              }}
              error={fieldErrors.location}
              helperText="Area patokan untuk mempermudah pembeli COD di sekitarmu"
            />

            <Textarea
              id="store-description-input"
              label="Deskripsi / Catatan Lapak *"
              placeholder="Tuliskan info barang yang sering kamu jual atau jam ketemuan COD toko..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  const err = validateStoreDescription(e.target.value);
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.description = err;
                    else delete n.description;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validateStoreDescription(description);
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.description = err;
                  else delete n.description;
                  return n;
                });
              }}
              error={fieldErrors.description}
              rows={4}
              required
            />

            <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full sm:w-auto px-6"
              >
                Simpan Informasi Toko
              </Button>
              {hasUnsavedChanges && (
                <span className="text-xs font-medium text-warning-text">
                  Ada perubahan yang belum disimpan
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Kolom Kanan (5/12 sticky): Formulir Identitas Pribadi Penjual */}
        <section
          aria-labelledby="seller-identity-heading"
          className="lg:col-span-5 lg:sticky lg:top-20 surface-3d rounded-2xl p-5 sm:p-6 md:p-7"
        >
          <div className="flex items-start gap-2.5 pb-4 mb-5 border-b border-border-subtle">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0">
              <User className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="seller-identity-heading" className="text-base font-bold text-ink">
                Identitas Pribadi Penjual
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Perbarui nama lengkap, nomor WhatsApp, dan email akun penjual.
              </p>
            </div>
          </div>

          <form
            aria-labelledby="seller-identity-heading"
            noValidate
            onSubmit={handleProfileSubmit}
            className="flex flex-col gap-5"
          >
            <Input
              id="seller-fullname-input"
              name="name"
              label="Nama Lengkap *"
              placeholder="Contoh: Dinda Putri Rahayu"
              icon={User}
              maxLength={100}
              autoComplete="name"
              value={profileName}
              onChange={(e) => {
                const val = e.target.value;
                setProfileName(val);
                if (profileErrors.name) {
                  const err = validateFullName(val);
                  setProfileErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.name = err;
                    else delete n.name;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validateFullName(profileName);
                setProfileErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.name = err;
                  else delete n.name;
                  return n;
                });
              }}
              error={profileErrors.name}
              helperText="Nama pengelola toko yang tampil pada profil lapak"
              required
            />

            <Input
              id="seller-phone-input"
              name="phone"
              label="Nomor WhatsApp / HP *"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="081234567890"
              icon={Phone}
              maxLength={20}
              value={profilePhone}
              onChange={(e) => {
                const val = e.target.value;
                setProfilePhone(val);
                if (profileErrors.phone) {
                  const err = validatePhone(val);
                  setProfileErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.phone = err;
                    else delete n.phone;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validatePhone(profilePhone);
                setProfileErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.phone = err;
                  else delete n.phone;
                  return n;
                });
              }}
              error={profileErrors.phone}
              helperText="Gunakan format 08... atau 62... untuk koordinasi COD & admin"
              required
            />

            <Input
              id="seller-email-input"
              name="email"
              label="Alamat Email (Gmail / Kampus) *"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nama@gmail.com"
              icon={Mail}
              maxLength={255}
              value={profileEmail}
              onChange={(e) => {
                const val = e.target.value;
                setProfileEmail(val);
                if (profileErrors.email) {
                  const err = validateEmail(val);
                  setProfileErrors((prev) => {
                    const n = { ...prev };
                    if (err) n.email = err;
                    else delete n.email;
                    return n;
                  });
                }
              }}
              onBlur={() => {
                const err = validateEmail(profileEmail);
                setProfileErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.email = err;
                  else delete n.email;
                  return n;
                });
              }}
              error={profileErrors.email}
              helperText="Dipakai sebagai email masuk akun penjual LepasIn"
              required
            />

            <div className="pt-4 border-t border-border-subtle flex flex-col gap-2.5">
              <Button
                type="submit"
                variant="primary"
                loading={profileLoading}
                className="w-full"
              >
                Simpan Identitas Pribadi
              </Button>
              {hasUnsavedProfileChanges && (
                <span className="text-xs font-medium text-warning-text text-center">
                  Ada perubahan identitas yang belum disimpan
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
