'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package,
  Trash2,
  Search,
  Store,
  GraduationCap,
  ExternalLink,
  Eye,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { ConditionBadge, formatRupiah } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/**
 * Thumbnail foto produk untuk tabel/kartu moderasi admin.
 * Menyediakan fallback ikon jika foto belum ada atau gagal dimuat.
 */
function ProductThumbnail({ imageUrl, name, onPreview }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onPreview}
      className="group relative w-12 h-12 rounded-xl overflow-hidden border border-border-subtle bg-surface-muted flex items-center justify-center shrink-0 hover:border-brand-blue transition-colors cursor-pointer"
      title="Perbesar foto & cek detail produk"
      aria-label={`Perbesar foto dan detail ${name}`}
    >
      {!imgError && imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt={name}
            fill
            unoptimized
            onError={() => setImgError(true)}
            sizes="48px"
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/25 transition-colors flex items-center justify-center">
            <Eye
              className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
              aria-hidden="true"
            />
          </span>
        </>
      ) : (
        <Package className="w-5 h-5 text-ink-subtle group-hover:text-brand-blue transition-colors" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Judul produk dapat diklik menuju halaman publik (atau modal pratinjau jika toko belum disetujui).
 * Tidak menggunakan class `block` agar `line-clamp-2` (`display: -webkit-box`) tetap memotong teks di 2 baris.
 */
function ProductTitle({ product, onPreview, className = '' }) {
  const sharedClass = `font-bold text-ink hover:text-brand-blue hover:underline line-clamp-2 [overflow-wrap:anywhere] transition-colors ${className}`;

  if (product.seller_status === 'approved') {
    return (
      <Link
        href={`/products/${product.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title={product.name}
        className={sharedClass}
      >
        {product.name}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview(product)}
      title={product.name}
      className={`${sharedClass} text-left`}
    >
      {product.name}
    </button>
  );
}

/**
 * Tombol aksi moderasi proporsional (Lihat & Hapus).
 */
function ProductModerationActions({ product, onPreview, onDelete }) {
  const isPubliclyVisible = product.seller_status === 'approved';

  return (
    <div className="inline-flex items-center justify-end gap-2">
      {isPubliclyVisible ? (
        <Button
          href={`/products/${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          size="sm"
          icon={ExternalLink}
          aria-label={`Lihat halaman publik produk ${product.name} di tab baru`}
        >
          Lihat
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon={Eye}
          onClick={() => onPreview(product)}
          aria-label={`Lihat pratinjau produk ${product.name}`}
        >
          Lihat
        </Button>
      )}
      <Button
        variant="danger"
        size="sm"
        icon={Trash2}
        onClick={() => onDelete(product)}
        aria-label={`Hapus produk ${product.name}`}
      >
        Hapus
      </Button>
    </div>
  );
}

export default function ProductsModerationManager({ initialProducts }) {
  const router = useRouter();
  const toast = useToast();

  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');

  const [previewState, setPreviewState] = useState({
    product: null,
    activeImageIdx: 0,
    brokenUrls: {},
  });

  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    product: null,
    loading: false,
  });

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.store_name.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q) ||
      p.campus_short_name.toLowerCase().includes(q) ||
      p.campus_name.toLowerCase().includes(q)
    );
  });

  const handleOpenPreview = (product) => {
    setPreviewState({
      product,
      activeImageIdx: 0,
      brokenUrls: {},
    });
  };

  const handleClosePreview = () => {
    setPreviewState({
      product: null,
      activeImageIdx: 0,
      brokenUrls: {},
    });
  };

  const handleOpenDelete = (product) => {
    setDeleteDialog({
      isOpen: true,
      product,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { product } = deleteDialog;
    if (!product) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menghapus produk');
        setDeleteDialog({ isOpen: false, product: null, loading: false });
        return;
      }

      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success(`Produk "${product.name}" berhasil dihapus dari katalog`);
      setDeleteDialog({ isOpen: false, product: null, loading: false });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Gagal memoderasi produk');
      setDeleteDialog({ isOpen: false, product: null, loading: false });
    }
  };

  const previewProduct = previewState.product;
  const previewImages = previewProduct
    ? Array.isArray(previewProduct.images) && previewProduct.images.length > 0
      ? previewProduct.images
      : previewProduct.image_url
      ? [previewProduct.image_url]
      : []
    : [];
  const activePreviewUrl = previewImages[previewState.activeImageIdx] || null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
          Moderasi Produk Nasional
        </h1>
        <p className="text-xs md:text-sm text-ink-muted mt-1">
          Pantau seluruh katalog barang preloved, periksa foto &amp; detail produk, dan hapus produk yang melanggar aturan komunitas kampus.
        </p>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <label htmlFor="admin-products-search" className="sr-only">
          Cari nama produk, toko, atau kampus
        </label>
        <Search
          className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="admin-products-search"
          type="search"
          placeholder="Cari nama produk, toko, kampus..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[44px] md:min-h-[40px] pl-10 pr-4 text-base md:text-sm bg-surface border border-border-subtle rounded-lg text-ink placeholder:text-ink-muted focus:border-brand-blue transition-colors"
        />
      </div>

      <div className="surface-3d rounded-2xl overflow-hidden">
        {/* Tampilan Kartu Mobile */}
        <div className="md:hidden divide-y divide-border-subtle">
          {filteredProducts.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-ink-muted">
              Tidak ada produk yang cocok dengan pencarian.
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <ProductThumbnail
                      key={`${p.id}-${p.image_url || 'none'}`}
                      imageUrl={p.image_url}
                      name={p.name}
                      onPreview={() => handleOpenPreview(p)}
                    />
                    <div className="min-w-0">
                      <ProductTitle
                        product={p}
                        onPreview={handleOpenPreview}
                        className="text-sm"
                      />
                      <div className="text-xs text-ink-muted tabular-nums mt-0.5">
                        ID #{p.id} · {p.category_name}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ConditionBadge condition={p.condition} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-ink inline-flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                      <span>{p.store_name}</span>
                    </div>
                    <div className="text-xs text-navy-900 font-medium flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 shrink-0 text-brand-blue" aria-hidden="true" />
                      <span>{p.campus_short_name} ({p.campus_city})</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-bold text-ink">{formatRupiah(p.price)}</div>
                    <div className={`text-xs ${p.stock <= 0 ? 'text-danger-text font-semibold' : 'text-ink-muted'}`}>
                      {p.stock <= 0 ? (
                        'Habis (Stok 0)'
                      ) : (
                        <>
                          Stok: <span className="font-semibold text-ink">{p.stock}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <ProductModerationActions
                    product={p}
                    onPreview={handleOpenPreview}
                    onDelete={handleOpenDelete}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tampilan Tabel Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-surface-muted text-ink-subtle font-semibold border-b border-border-subtle">
              <tr>
                <th className="py-3 px-3 xl:px-4">Produk</th>
                <th className="py-3 px-3 xl:px-4">Toko &amp; Kampus</th>
                <th className="hidden xl:table-cell py-3 px-4">Kategori &amp; Kondisi</th>
                <th className="py-3 px-3 xl:px-4">Harga &amp; Stok</th>
                <th className="py-3 px-3 xl:px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-ink-muted">
                    Tidak ada produk yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas transition-colors">
                    <td className="py-3.5 px-3 xl:px-4">
                      <div className="flex items-start gap-3">
                        <ProductThumbnail
                          key={`${p.id}-${p.image_url || 'none'}`}
                          imageUrl={p.image_url}
                          name={p.name}
                          onPreview={() => handleOpenPreview(p)}
                        />
                        <div className="min-w-0">
                          <ProductTitle
                            product={p}
                            onPreview={handleOpenPreview}
                            className="max-w-[165px] xl:max-w-[210px]"
                          />
                          <div className="text-xs text-ink-muted tabular-nums mt-0.5">
                            ID #{p.id}
                          </div>
                          <div className="xl:hidden flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-xs text-ink-muted">{p.category_name}</span>
                            <ConditionBadge condition={p.condition} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 xl:px-4">
                      <div className="font-semibold text-ink flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[180px] xl:max-w-[220px]" title={p.store_name}>
                          {p.store_name}
                        </span>
                      </div>
                      <div className="text-xs text-navy-900 font-medium flex items-center gap-1 mt-0.5 whitespace-nowrap">
                        <GraduationCap className="w-3 h-3 shrink-0 text-brand-blue" aria-hidden="true" />
                        <span>{p.campus_short_name} ({p.campus_city})</span>
                      </div>
                    </td>
                    <td className="hidden xl:table-cell py-3.5 px-4">
                      <div className="font-medium text-ink">{p.category_name}</div>
                      <div className="mt-1">
                        <ConditionBadge condition={p.condition} />
                      </div>
                    </td>
                    <td className="py-3.5 px-3 xl:px-4 tabular-nums">
                      <div className="font-bold text-ink whitespace-nowrap">{formatRupiah(p.price)}</div>
                      <div className={`text-xs ${p.stock <= 0 ? 'text-danger-text font-semibold' : 'text-ink-muted'}`}>
                        {p.stock <= 0 ? (
                          'Habis (Stok 0)'
                        ) : (
                          <>
                            Stok: <span className="font-semibold text-ink">{p.stock}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 xl:px-4 text-right">
                      <ProductModerationActions
                        product={p}
                        onPreview={handleOpenPreview}
                        onDelete={handleOpenDelete}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pratinjau Foto & Detail Produk */}
      <Modal
        isOpen={Boolean(previewProduct)}
        onClose={handleClosePreview}
        title={previewProduct?.name || 'Detail Produk'}
        maxWidth="max-w-lg"
      >
        {previewProduct && (
          <div className="flex flex-col gap-4">
            <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden bg-surface-muted border border-border-subtle flex items-center justify-center">
              {activePreviewUrl && !previewState.brokenUrls[activePreviewUrl] ? (
                <Image
                  src={activePreviewUrl}
                  alt={previewProduct.name}
                  fill
                  unoptimized
                  onError={() =>
                    setPreviewState((prev) => ({
                      ...prev,
                      brokenUrls: { ...prev.brokenUrls, [activePreviewUrl]: true },
                    }))
                  }
                  sizes="(max-width: 640px) 90vw, 500px"
                  className="object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-ink-subtle p-6 text-center">
                  <Package className="w-10 h-10 stroke-[1.5]" aria-hidden="true" />
                  <span className="text-xs font-medium">Foto produk belum tersedia</span>
                </div>
              )}
            </div>

            {previewImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {previewImages.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() =>
                      setPreviewState((prev) => ({ ...prev, activeImageIdx: idx }))
                    }
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border shrink-0 transition-all ${
                      previewState.activeImageIdx === idx
                        ? 'border-brand-blue ring-2 ring-brand-blue-soft'
                        : 'border-border-subtle opacity-75 hover:opacity-100'
                    }`}
                    aria-label={`Lihat foto ke-${idx + 1}`}
                  >
                    <Image
                      src={url}
                      alt={`${previewProduct.name} foto ${idx + 1}`}
                      fill
                      unoptimized
                      sizes="56px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-canvas border border-border-subtle text-xs">
              <div>
                <span className="text-ink-muted block">Harga &amp; Stok</span>
                <span className="font-bold text-sm text-ink tabular-nums">
                  {formatRupiah(previewProduct.price)}
                </span>
                <span
                  className={`block mt-0.5 tabular-nums ${
                    previewProduct.stock <= 0 ? 'text-danger-text font-semibold' : 'text-ink-muted'
                  }`}
                >
                  {previewProduct.stock <= 0 ? 'Habis (Stok 0)' : `Stok: ${previewProduct.stock} item`}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block">Toko &amp; Kategori</span>
                <span className="font-semibold text-ink block truncate">{previewProduct.store_name}</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-ink-secondary">{previewProduct.category_name}</span>
                  <ConditionBadge condition={previewProduct.condition} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
                Deskripsi Produk
              </h3>
              <p className="text-sm text-ink-secondary whitespace-pre-line break-words leading-relaxed bg-canvas p-3 rounded-xl border border-border-subtle max-h-40 overflow-y-auto">
                {previewProduct.description || 'Tidak ada deskripsi.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClosePreview}
              >
                Tutup
              </Button>
              <div className="flex items-center gap-2">
                {previewProduct.seller_status === 'approved' && (
                  <Button
                    href={`/products/${previewProduct.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                  >
                    Buka Halaman Produk
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    const target = previewProduct;
                    handleClosePreview();
                    handleOpenDelete(target);
                  }}
                >
                  Hapus Produk
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, product: null, loading: false })}
        onConfirm={handleConfirmDelete}
        loading={deleteDialog.loading}
        title="Hapus Produk dari Katalog?"
        message={`Apakah Anda yakin ingin menghapus produk "${deleteDialog.product?.name}" milik toko ${deleteDialog.product?.store_name}? Produk akan langsung dihilangkan dari katalog publik.`}
        confirmText="Ya, Hapus Produk"
        confirmVariant="danger"
        type="danger"
      />
    </div>
  );
}
