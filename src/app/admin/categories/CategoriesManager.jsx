'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Tags, Package, Search, Lock, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { preventEnterSubmitOnInput } from '@/lib/form-utils';
import { validateCategoryName } from '@/lib/validation';

// Helper agar "Lainnya" selalu berada di paling akhir urutan kategori
const sortCategoriesWithLainnyaLast = (list = []) => {
  return [...list].sort((a, b) => {
    const isALainnya = /^(lainnya|lain-lain|lainnya \/ other)$/i.test(a.name?.trim());
    const isBLainnya = /^(lainnya|lain-lain|lainnya \/ other)$/i.test(b.name?.trim());
    if (isALainnya && !isBLainnya) return 1;
    if (!isALainnya && isBLainnya) return -1;
    return a.id - b.id;
  });
};

export default function CategoriesManager({ initialCategories }) {
  const router = useRouter();
  const toast = useToast();

  const [categories, setCategories] = useState(() =>
    sortCategoriesWithLainnyaLast(initialCategories || [])
  );
  const [search, setSearch] = useState('');

  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    category: null,
    name: '',
    error: '',
    loading: false,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    category: null,
    loading: false,
  });

  const [blockedDialog, setBlockedDialog] = useState({
    isOpen: false,
    category: null,
  });

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setModalState({
      isOpen: true,
      mode: 'add',
      category: null,
      name: '',
      error: '',
      loading: false,
    });
  };

  const handleOpenEdit = (category) => {
    if (/^(lainnya|lain-lain)$/i.test(category.name?.trim())) {
      toast.warning('Nama kategori "Lainnya" adalah kategori sistem dan tidak dapat diubah.');
      return;
    }
    setModalState({
      isOpen: true,
      mode: 'edit',
      category,
      name: category.name,
      error: '',
      loading: false,
    });
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (modalState.loading) return;
    const nameErr = validateCategoryName(modalState.name);
    if (nameErr) {
      setModalState((prev) => ({ ...prev, error: nameErr }));
      return;
    }

    setModalState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const isAdd = modalState.mode === 'add';
      const url = isAdd
        ? '/api/admin/categories'
        : `/api/admin/categories/${modalState.category.id}`;
      const method = isAdd ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modalState.name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalState((prev) => ({
          ...prev,
          loading: false,
          error: data.error || 'Gagal menyimpan kategori',
        }));
        return;
      }

      if (data.categories) {
        setCategories(sortCategoriesWithLainnyaLast(data.categories));
      } else if (isAdd) {
        setCategories((prev) =>
          sortCategoriesWithLainnyaLast([...prev, { ...data.category, product_count: 0 }])
        );
      } else {
        setCategories((prev) =>
          sortCategoriesWithLainnyaLast(
            prev.map((c) =>
              c.id === modalState.category.id ? { ...c, name: modalState.name.trim() } : c
            )
          )
        );
      }

      if (isAdd) {
        toast.success(`Kategori "${modalState.name}" berhasil ditambahkan`);
      } else {
        toast.success('Nama kategori berhasil diperbarui');
      }

      setModalState({ isOpen: false, mode: 'add', category: null, name: '', error: '', loading: false });
      router.refresh();
    } catch (err) {
      console.error(err);
      setModalState((prev) => ({
        ...prev,
        loading: false,
        error: 'Terjadi gangguan jaringan',
      }));
    }
  };

  const handleOpenDelete = (category) => {
    if (/^(lainnya|lain-lain)$/i.test(category.name?.trim())) {
      toast.warning('Kategori "Lainnya" adalah kategori sistem dan tidak dapat dihapus.');
      return;
    }
    if ((category.product_count || 0) > 0) {
      setBlockedDialog({
        isOpen: true,
        category,
      });
      return;
    }
    setDeleteDialog({
      isOpen: true,
      category,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { category } = deleteDialog;
    if (!category) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'HAS_PRODUCTS') {
          const updatedCat = {
            ...category,
            product_count: data.product_count ?? category.product_count ?? 1,
          };
          setCategories((prev) =>
            sortCategoriesWithLainnyaLast(
              prev.map((c) => (c.id === category.id ? updatedCat : c))
            )
          );
          setDeleteDialog({ isOpen: false, category: null, loading: false });
          setBlockedDialog({ isOpen: true, category: updatedCat });
          return;
        }
        toast.error(data.error || 'Gagal menghapus kategori');
        setDeleteDialog((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (data.categories) {
        setCategories(sortCategoriesWithLainnyaLast(data.categories));
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== category.id));
      }

      toast.success(data.message || `Kategori "${category.name}" berhasil dihapus`);

      setDeleteDialog({ isOpen: false, category: null, loading: false });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus kategori');
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
            Kategori Produk
          </h1>
          <p className="text-xs md:text-sm text-ink-muted mt-1">
            Kelola pengelompokan produk preloved di katalog LepasIn.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
          Tambah Kategori
        </Button>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <label htmlFor="admin-categories-search" className="sr-only">
          Cari nama kategori produk
        </label>
        <Search
          className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="admin-categories-search"
          type="search"
          placeholder="Cari kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[44px] md:min-h-[40px] pl-10 pr-4 text-base md:text-sm bg-surface border border-border-subtle rounded-lg text-ink placeholder:text-ink-muted focus:border-brand-blue transition-colors"
        />
      </div>

      <div className="surface-3d rounded-2xl overflow-hidden">
        <div className="md:hidden divide-y divide-border-subtle">
          {filteredCategories.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-ink-muted">
              Kategori tidak ditemukan.
            </div>
          ) : (
            filteredCategories.map((c) => {
              const isSystemCategory = /^(lainnya|lain-lain)$/i.test(c.name?.trim());
              return (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-ink flex items-center gap-2 flex-wrap">
                        <Tags className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                        <span>{c.name}</span>
                        {isSystemCategory && (
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-brand-blue-soft text-brand-blue">
                            Sistem
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted tabular-nums pl-6 mt-0.5">
                        ID #{c.id}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 tabular-nums ${
                        c.product_count > 0
                          ? 'bg-brand-blue-soft text-brand-blue'
                          : 'bg-surface-muted text-ink-subtle'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{c.product_count} produk</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isSystemCategory ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-muted bg-surface-muted border border-border-subtle select-none">
                        <Lock className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                        <span>Kategori Terproteksi</span>
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleOpenEdit(c)}
                          title="Edit nama kategori"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleOpenDelete(c)}
                          title="Hapus kategori"
                        >
                          Hapus
                        </Button>
                      </>
                    )}
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
                <th className="py-3 px-3 xl:px-5 w-16 text-center">ID</th>
                <th className="py-3 px-3 xl:px-5">Nama Kategori</th>
                <th className="py-3 px-3 xl:px-5">Jumlah Produk Aktif</th>
                <th className="py-3 px-3 xl:px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-ink-muted">
                    Kategori tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => {
                  const isSystemCategory = /^(lainnya|lain-lain)$/i.test(c.name?.trim());
                  return (
                    <tr key={c.id} className="hover:bg-canvas transition-colors">
                      <td className="py-4 px-3 xl:px-5 text-center tabular-nums font-semibold text-ink-muted">
                        {c.id}
                      </td>
                      <td className="py-4 px-3 xl:px-5">
                        <div className="font-bold text-ink flex items-center gap-2 flex-wrap">
                          <Tags className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                          <span>{c.name}</span>
                          {isSystemCategory && (
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-brand-blue-soft text-brand-blue">
                              Sistem
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-3 xl:px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                            c.product_count > 0
                              ? 'bg-brand-blue-soft text-brand-blue'
                              : 'bg-surface-muted text-ink-subtle'
                          }`}
                        >
                          <Package className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{c.product_count} produk</span>
                        </span>
                      </td>
                      <td className="py-4 px-3 xl:px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isSystemCategory ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-muted bg-surface-muted border border-border-subtle select-none">
                              <Lock className="w-3.5 h-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                              <span>Kategori Terproteksi</span>
                            </span>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit2}
                                onClick={() => handleOpenEdit(c)}
                                title="Edit nama kategori"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                onClick={() => handleOpenDelete(c)}
                                title="Hapus kategori"
                              >
                                Hapus
                              </Button>
                            </>
                          )}
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

      <Modal
        isOpen={modalState.isOpen}
        onClose={() =>
          !modalState.loading &&
          setModalState({ isOpen: false, mode: 'add', category: null, name: '', error: '', loading: false })
        }
        title={modalState.mode === 'add' ? 'Tambah Kategori Baru' : 'Edit Nama Kategori'}
      >
        <form
          noValidate
          onSubmit={handleSubmitModal}
          onKeyDown={preventEnterSubmitOnInput}
          className="flex flex-col gap-4"
        >
          <Input
            id="category-name-input"
            label="Nama Kategori"
            placeholder="Contoh: Elektronik & Gadget"
            maxLength={50}
            value={modalState.name}
            onChange={(e) => {
              const val = e.target.value;
              setModalState((prev) => {
                const nextErr = prev.error ? validateCategoryName(val) : '';
                return { ...prev, name: val, error: nextErr || '' };
              });
            }}
            onBlur={() => {
              const err = validateCategoryName(modalState.name);
              if (err) {
                setModalState((prev) => ({ ...prev, error: err }));
              }
            }}
            error={modalState.error}
            required
          />

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setModalState({ isOpen: false, mode: 'add', category: null, name: '', error: '', loading: false })
              }
              disabled={modalState.loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={modalState.loading}
            >
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, category: null, loading: false })}
        onConfirm={handleConfirmDelete}
        loading={deleteDialog.loading}
        title="Hapus Kategori Produk?"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteDialog.category?.name}" dari sistem LepasIn? Kategori ini tidak memiliki produk aktif terdaftar.`}
        confirmText="Ya, Hapus Kategori"
        confirmVariant="danger"
        type="danger"
      />

      {/* Modal Peringatan Proteksi Kategori Masih Memiliki Produk */}
      <Modal
        isOpen={blockedDialog.isOpen}
        onClose={() => setBlockedDialog({ isOpen: false, category: null })}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col items-center text-center p-1 sm:p-2">
          <div className="w-13 h-13 rounded-2xl flex items-center justify-center mb-4 bg-warning-bg border border-amber-200 text-warning-text shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_3px_0_rgba(15,41,74,0.12)]">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>

          <h3 className="text-lg font-bold text-ink mb-2">
            Kategori Tidak Dapat Dihapus
          </h3>

          <p className="text-sm text-ink-secondary mb-4 leading-relaxed">
            Kategori <strong className="text-ink">&quot;{blockedDialog.category?.name}&quot;</strong> saat ini masih menampung produk aktif:
          </p>

          <div className="grid grid-cols-1 gap-3 w-full mb-4">
            <div className="surface-3d rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-ink-muted flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-brand-blue" aria-hidden="true" />
                <span>Produk Terdaftar</span>
              </span>
              <span className="text-base font-extrabold text-ink tabular-nums">
                {blockedDialog.category?.product_count || 0} Produk
              </span>
            </div>
          </div>

          <p className="text-xs text-ink-muted bg-surface-muted border border-border-subtle rounded-xl p-3 mb-6 text-left leading-relaxed">
            Demi menjaga pengelompokan produk di katalog publik dan etalase penjual tetap rapi serta konsisten, sistem memproteksi kategori dari penghapusan selama masih terdapat produk di dalamnya.
          </p>

          <Button
            variant="primary"
            className="w-full"
            onClick={() => setBlockedDialog({ isOpen: false, category: null })}
          >
            Saya Mengerti
          </Button>
        </div>
      </Modal>
    </div>
  );
}
