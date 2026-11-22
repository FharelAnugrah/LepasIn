'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Store, MapPin, Camera, UploadCloud, Trash2, Loader2 } from 'lucide-react';
import Input, { Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import CampusSelector from '@/components/ui/CampusSelector';
import { useToast } from '@/components/ui/Toast';
import { validateStoreName, validateStoreDescription, validateLocation } from '@/lib/validation';

export default function StoreSettingsClient({ store, initialCampus, campuses }) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(store?.name || '');
  const [location, setLocation] = useState(store?.location || '');
  const [description, setDescription] = useState(store?.description || '');
  const [campus, setCampus] = useState(initialCampus);
  const [imageUrl, setImageUrl] = useState(store?.image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

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
      toast.success('Foto toko berhasil diunggah.');
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
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/seller/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          campus_id: campus.id,
          location: location.trim(),
          description: description.trim(),
          image_url: imageUrl ? imageUrl.trim() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan perubahan toko');
        setLoading(false);
        return;
      }

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
    <div className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
          <Store className="w-6 h-6 text-brand-blue" aria-hidden="true" />
          <span>Pengaturan Lapak dan Lokasi COD</span>
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Sesuaikan nama toko, asal kampus, dan area kost untuk mempermudah COD sekampus.
        </p>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl p-6 md:p-8">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md hover:bg-brand-blue-hover transition-colors"
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
              <div className="flex flex-wrap items-center gap-2 mt-1">
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
            </div>
          </div>

          <Input
            id="store-name-input"
            label="Nama Toko / Lapak"
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

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-secondary">
              Kampus Toko Terdaftar (Wajib)
            </span>
            <CampusSelector
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
              placeholder="Pilih kampus..."
              fullWidth={true}
              className="w-full"
            />
            {fieldErrors.campus && (
              <p role="alert" className="text-xs text-danger-text font-medium mt-0.5">
                {fieldErrors.campus}
              </p>
            )}
          </div>

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
            label="Deskripsi / Catatan Lapak"
            placeholder="Tuliskan info barang yang sering kamu jual atau jam ketemuan COD toko..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (fieldErrors.description) {
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  delete n.description;
                  return n;
                });
              }
            }}
            error={fieldErrors.description}
            rows={3}
            required
          />

          <div className="pt-4 border-t border-border-subtle">
            <Button type="submit" variant="primary" loading={loading} className="w-full sm:w-auto px-6">
              Simpan Informasi Toko
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
