import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { createSession } from '@/lib/session';
import {
  FULL_NAME_REGEX,
  validateFullName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateStoreName,
  validateLocation,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const registerSchema = z
  .object({
    name: z
      .string({ message: 'Nama lengkap wajib diisi sesuai identitas mahasiswa.' })
      .trim()
      .min(1, 'Nama lengkap wajib diisi sesuai identitas mahasiswa.')
      .min(3, 'Nama lengkap minimal terdiri dari 3 karakter.')
      .max(100, 'Nama lengkap maksimal 100 karakter'),
    email: z
      .string({ message: 'Alamat email aktif wajib diisi.' })
      .trim()
      .min(1, 'Alamat email aktif wajib diisi.')
      .email('Format email tidak valid. Contoh: nama@kampus.ac.id atau nama@gmail.com.')
      .max(255, 'Alamat email maksimal 255 karakter'),
    phone: z
      .string({ message: 'Nomor WhatsApp wajib diisi untuk koordinasi transaksi/COD.' })
      .trim()
      .min(1, 'Nomor WhatsApp wajib diisi untuk koordinasi transaksi/COD.'),
    password: z
      .string({ message: 'Kata sandi wajib dibuat.' })
      .min(1, 'Kata sandi wajib dibuat.'),
    confirmPassword: z
      .string({ message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi di samping.' })
      .min(1, 'Konfirmasi kata sandi tidak cocok dengan kata sandi di samping.'),
    role: z.enum(['buyer', 'seller'], {
      errorMap: () => ({ message: 'Pilih peran sebagai Pembeli atau Penjual' }),
    }),
    campus_id: z.union([z.number(), z.string()]).nullable().optional(),
    store_name: z.string().trim().max(100).optional(),
    location: z.string().trim().max(150).optional(),
    id_card_url: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (!data.name) return true;
      return FULL_NAME_REGEX.test(data.name.trim()) && /[a-zA-Z]/.test(data.name.trim());
    },
    {
      message: 'Nama hanya boleh menggunakan huruf alfabet, spasi, titik, dan tanda petik.',
      path: ['name'],
    }
  )
  .refine(
    (data) => {
      const nonSpaceLength = (data.password || '').replace(/\s/g, '').length;
      return nonSpaceLength >= 8;
    },
    {
      message: 'Kata sandi minimal 8 karakter (kombinasi huruf dan angka disarankan).',
      path: ['password'],
    }
  )
  .refine(
    (data) => {
      // Hanya menerima angka, huruf, dan simbol (spasi tidak dihitung)
      const allowedRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`\s]+$/;
      return allowedRegex.test(data.password || '');
    },
    {
      message: 'Kata sandi minimal 8 karakter (kombinasi huruf dan angka disarankan).',
      path: ['password'],
    }
  )
  .refine(
    (data) => {
      return /^(?=.*[A-Za-z])(?=.*\d)/.test(data.password || '');
    },
    {
      message: 'Kata sandi minimal 8 karakter (kombinasi huruf dan angka disarankan).',
      path: ['password'],
    }
  )
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi di samping.',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      const err = validatePhone(data.phone);
      return !err;
    },
    {
      message: 'Nomor WhatsApp harus diawali 08 atau 62 dan terdiri dari 10-14 digit angka.',
      path: ['phone'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'seller') {
        return !!data.campus_id && Number(data.campus_id) > 0;
      }
      return true;
    },
    {
      message: 'Asal kampus wajib dipilih untuk mendaftarkan toko ke direktori kampus.',
      path: ['campus_id'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'seller') {
        const s = data.store_name ? data.store_name.trim() : '';
        if (s.length < 3) return false;
        if (!/[a-zA-Z]/.test(s)) return false;
        return /^[a-zA-Z0-9\s&'.,\-_/]+$/.test(s);
      }
      return true;
    },
    {
      message: 'Nama toko wajib diisi (minimal 3 karakter, tidak menggunakan karakter khusus).',
      path: ['store_name'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'seller') {
        const loc = data.location ? data.location.trim() : '';
        if (loc.length < 5) return false;
        if (!/[a-zA-Z]/.test(loc)) return false;
        return /^[a-zA-Z0-9\s&'.,\-_/()]+$/.test(loc);
      }
      return true;
    },
    {
      message: 'Detail lokasi/area kost wajib diisi (minimal 5 karakter).',
      path: ['location'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'seller') {
        return !!data.id_card_url && data.id_card_url.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Foto Kartu Tanda Mahasiswa (KTM) wajib diunggah untuk verifikasi toko.',
      path: ['id_card_url'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'seller' && data.id_card_url) {
        const val = data.id_card_url.trim();
        if (val.includes('data:image/')) {
          return false;
        }
        return (
          val.startsWith('/uploads/verifications/') ||
          /^https:\/\/[^\s]+$/i.test(val)
        );
      }
      return true;
    },
    {
      message: 'Format URL foto identitas tidak valid. Foto harus diunggah melalui endpoint berkas.',
      path: ['id_card_url'],
    }
  );

export async function POST(request) {
  try {
    const body = await request.json();
    const validated = registerSchema.safeParse(body);

    if (!validated.success) {
      const fieldErrors = {};
      const issues = validated.error.issues || validated.error.errors || [];
      issues.forEach((err) => {
        const field = err.path[0];
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      const firstErrorMessage = Object.values(fieldErrors)[0];
      return NextResponse.json(
        {
          error: firstErrorMessage || 'Mohon lengkapi data formulir dengan benar',
          errors: fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, phone, password, role, campus_id, store_name, location, id_card_url } = validated.data;
    const normalizedEmail = email.toLowerCase();
    const parsedCampusId = campus_id ? Number(campus_id) : null;
    const cleanPhone = phone
      ? phone.trim().replace(/[\s-]/g, '').replace(/^(\+62|62)/, '0')
      : null;

    // Cek apakah email sudah terdaftar
    const existing = await query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          error: 'Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk ke akunmu.',
          errors: {
            email: 'Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk ke akunmu.',
          },
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const sellerStatus = role === 'seller' ? 'pending' : null;

    // Mutasi database dalam transaksi atomik
    const newUserData = await withTransaction(async (client) => {
      // 1. Insert ke tabel users
      const userRes = await client.query(
        `INSERT INTO users (campus_id, name, email, password_hash, role, seller_status, phone, id_card_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, email, role, seller_status, campus_id`,
        [
          parsedCampusId,
          name,
          normalizedEmail,
          passwordHash,
          role,
          sellerStatus,
          cleanPhone || null,
          role === 'seller' ? id_card_url?.trim() || null : null,
        ]
      );

      const user = userRes.rows[0];
      let storeId = null;

      // 2. Jika seller, buat toko secara otomatis
      if (role === 'seller') {
        const storeRes = await client.query(
          `INSERT INTO stores (user_id, campus_id, name, description, location)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            user.id,
            parsedCampusId,
            store_name.trim(),
            `Toko Mahasiswa ${name} di sekitar kampus.`,
            location ? location.trim() : null,
          ]
        );
        storeId = storeRes.rows[0].id;
      }

      return { ...user, storeId };
    });

    // Buat cookie sesi
    await createSession({
      userId: newUserData.id,
      email: newUserData.email,
      name: newUserData.name,
      role: newUserData.role,
      sellerStatus: newUserData.seller_status,
      campusId: newUserData.campus_id,
      storeId: newUserData.storeId,
    });

    const redirectTo = role === 'seller' ? '/pending-seller' : '/';

    return NextResponse.json({
      success: true,
      message: 'Registrasi berhasil',
      redirectTo,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      const emailErr = 'Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk ke akunmu.';
      return NextResponse.json(
        {
          error: emailErr,
          errors: { email: emailErr },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: 'Terjadi gangguan pada server saat mendaftarkan akun. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
