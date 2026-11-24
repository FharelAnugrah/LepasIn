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
  ShieldCheck,
  GraduationCap,
  Package,
} from 'lucide-react';
import Input, { Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import CampusSelector from '@/components/ui/CampusSelector';
import { useToast } from '@/components/ui/Toast';
import { validateStoreName, validateStoreDescription, validateLocation } from '@/lib/validation';
import { focusFirstInvalidField } from '@/lib/form-utils';

export default function StoreSettingsClient({
  store,
  initialCampus,
  campuses,
  sellerName = 'Pemilik Lapak',
  productCount = 0,
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

  const hasUnsavedImageChange = imageUrl !== savedSnapshot.imageUrl;
  const hasUnsavedChanges =
    name.trim() !== savedSnapshot.name.trim() ||
    location.trim() !== savedSnapshot.location.trim() ||
    description.trim() !== savedSnapshot.description.trim() ||
    (campus?.id || null) !== savedSnapshot.campusId ||
    hasUnsavedImageChange;

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

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-brand-blue" aria-hidden="true" />
            <span>Pengaturan Lapak dan Lokasi COD</span>
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Sesuaikan nama toko, asal kampus, dan area kost untuk mempermudah COD sekampus.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        {/* Kolom Kiri (2/3): Formulir Pengaturan Toko */}
        <div className="lg:col-span-2 surface-3d rounded-2xl p-5 sm:p-6 md:p-8">
          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        </div>

        {/* Kolom Kanan (1/3 sticky): Pratinjau Kartu Lapak Publik */}
        <aside className="lg:col-span-1 lg:sticky lg:top-20 surface-3d rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-bold text-ink">Pratinjau Kartu Lapak</h2>
              <p className="text-xs text-ink-muted">Tampilan profil di sisi pembeli</p>
            </div>
            <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-2 py-0.5 rounded-md shrink-0">
              Live
            </span>
          </div>

          <div className="rounded-xl border border-border-subtle bg-canvas p-4 flex flex-col gap-3.5">
            <div className="flex items-start gap-3 min-w-0">
              {imageUrl ? (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border-subtle bg-surface-muted">
                  <Image
                    src={imageUrl}
                    alt={name || 'Logo Lapak'}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl icon-plinth-navy text-white font-bold text-xl flex items-center justify-center shrink-0 uppercase select-none">
                  {name.trim() ? name.trim().charAt(0) : 'T'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-ink truncate">
                  {name.trim() || 'Nama Toko Kamu'}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-success-bg text-success-text">
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    <span>Terverifikasi</span>
                  </span>
                </div>
                <p className="text-xs text-ink-muted truncate mt-1">
                  Pengelola: {sellerName}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-brand-blue font-semibold">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {campus
                    ? `${campus.short_name}${campus.city ? ` (${campus.city})` : ''}`
                    : 'Kampus belum dipilih'}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-ink-secondary">
                <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
                <span className="break-words">
                  {location.trim() || 'Area COD belum diisi'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border-subtle text-xs text-ink-secondary leading-relaxed">
              <p className="line-clamp-4 break-words">
                {description.trim() || 'Deskripsi dan jadwal COD toko akan tampil di sini.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle text-xs text-ink-muted tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-ink">{productCount}</strong> produk aktif
                </span>
              </span>
            </div>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Pembeli sekampus melihat kartu identitas di atas pada halaman toko maupun sebelum menyepakati titik temu COD.
          </p>
        </aside>
      </div>
    </div>
  );
}
