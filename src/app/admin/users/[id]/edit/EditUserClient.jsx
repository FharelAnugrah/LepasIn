'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Mail, Phone, ShieldCheck, Store, ShoppingBag } from 'lucide-react';
import Input from '@/components/ui/Input';
import Badge, { SellerStatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import CampusSelector from '@/components/ui/CampusSelector';
import { useToast } from '@/components/ui/Toast';
import { focusFirstInvalidField, preventEnterSubmitOnInput } from '@/lib/form-utils';
import { validateEmail, validateFullName, validatePhone } from '@/lib/validation';

const FIELD_INPUT_IDS = {
  name: 'admin-edit-name',
  email: 'admin-edit-email',
  phone: 'admin-edit-phone',
};

const ROLE_META = {
  admin: { label: 'Administrator (Admin)', variant: 'navy', icon: ShieldCheck },
  seller: { label: 'Penjual (Seller)', variant: 'mint', icon: Store },
  buyer: { label: 'Pembeli (Buyer)', variant: 'secondary', icon: ShoppingBag },
};

export default function EditUserClient({ user, initialCampus }) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [campus, setCampus] = useState(initialCampus);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const roleMeta = ROLE_META[user.role] || ROLE_META.buyer;

  const validateForm = () => {
    const errs = {};
    const nameErr = validateFullName(name);
    if (nameErr) errs.name = nameErr;

    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;

    if (phone.trim()) {
      const phoneErr = validatePhone(phone.trim());
      if (phoneErr) errs.phone = phoneErr;
    }
    if (user.role === 'seller' && !campus?.id) {
      errs.campus = 'Akun penjual wajib terikat ke salah satu kampus.';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const invalidIds = ['name', 'email', 'phone']
        .filter((key) => errs[key])
        .map((key) => FIELD_INPUT_IDS[key]);
      focusFirstInvalidField(invalidIds);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        campus_id: campus ? campus.id : null,
      };

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal memperbarui pengguna');
        if (data.errors && typeof data.errors === 'object') {
          setFieldErrors((prev) => ({ ...prev, ...data.errors }));
          const invalidIds = ['name', 'email', 'phone']
            .filter((key) => data.errors[key])
            .map((key) => FIELD_INPUT_IDS[key]);
          focusFirstInvalidField(invalidIds);
        }
        setLoading(false);
        return;
      }

      toast.success('Data pengguna berhasil diperbarui!');
      router.push('/admin/users');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 min-h-[36px] text-xs md:text-sm font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Kembali ke Daftar Pengguna</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Edit Pengguna: {user.name}
          </h1>
          <Badge variant={roleMeta.variant} size="xs" icon={roleMeta.icon}>
            {roleMeta.label}
          </Badge>
        </div>
        <p className="text-xs md:text-sm text-ink-muted mt-1">
          Ubah nama, alamat email, nomor kontak, atau asal kampus pengguna.
        </p>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl p-6 md:p-8">
        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-lg bg-danger-bg border border-red-200 text-danger-text text-xs md:text-sm font-medium"
          >
            {error}
          </div>
        )}

        <form
          noValidate
          onSubmit={handleSubmit}
          onKeyDown={preventEnterSubmitOnInput}
          className="flex flex-col gap-4"
        >
          <Input
            id="admin-edit-name"
            label="Nama Lengkap"
            icon={User}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) {
                const err = validateFullName(e.target.value);
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.name = err;
                  else delete n.name;
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
            id="admin-edit-email"
            label="Alamat Email"
            type="email"
            icon={Mail}
            value={email}
            onChange={(e) => {
              const nextVal = e.target.value;
              setEmail(nextVal);
              if (fieldErrors.email && !validateEmail(nextVal)) {
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  delete n.email;
                  return n;
                });
              }
            }}
            onBlur={() => {
              const err = validateEmail(email);
              setFieldErrors((prev) => {
                const n = { ...prev };
                if (err) n.email = err;
                else delete n.email;
                return n;
              });
            }}
            error={fieldErrors.email}
            placeholder="nama@kampus.ac.id"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            helperText="Pastikan alamat email aktif dan unik karena digunakan untuk login akun ini"
            required
          />

          <Input
            id="admin-edit-phone"
            label="Nomor WhatsApp / HP"
            type="tel"
            icon={Phone}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (fieldErrors.phone) {
                const trimmed = e.target.value.trim();
                const err = trimmed ? validatePhone(trimmed) : null;
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  if (err) n.phone = err;
                  else delete n.phone;
                  return n;
                });
              }
            }}
            onBlur={() => {
              const trimmed = phone.trim();
              const err = trimmed ? validatePhone(trimmed) : null;
              setFieldErrors((prev) => {
                const n = { ...prev };
                if (err) n.phone = err;
                else delete n.phone;
                return n;
              });
            }}
            error={fieldErrors.phone}
            placeholder="081234567890"
          />

          {user.role === 'seller' && (
            <div className="p-3.5 rounded-lg bg-canvas border border-border-subtle flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-secondary">
                  Status Verifikasi Toko
                </span>
                <SellerStatusBadge
                  status={user.seller_status}
                  wasApproved={Boolean(user.was_approved)}
                />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Persetujuan, penolakan, maupun penangguhan toko dikelola melalui menu{' '}
                <Link href="/admin/sellers" className="text-brand-blue font-semibold hover:underline">
                  Verifikasi Penjual
                </Link>
                .
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs md:text-sm font-semibold text-ink">
              Asal Kampus
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
              allowAll={user.role !== 'seller'}
              allLabel="Tidak Mengikat Kampus"
              placeholder="Pilih kampus..."
              fullWidth={true}
              error={fieldErrors.campus}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle mt-2">
            <Button
              href="/admin/users"
              variant="secondary"
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
