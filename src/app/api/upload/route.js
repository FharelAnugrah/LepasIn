import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { isValidImageMagicBytes } from '@/lib/image-util';

export const dynamic = 'force-dynamic';

const ALLOWED_FOLDERS = ['products', 'stores', 'avatars', 'verifications'];

// Untuk verifikasi KTM identitas: format gambar (JPG, PNG, WebP), maksimal 5 MB
const VERIFICATION_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VERIFICATION_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_VERIFICATION_SIZE = 5 * 1024 * 1024; // 5 MB

// Untuk umum (produk, avatar, toko): JPEG, PNG, dan WebP, maksimal 10 MB
const GENERAL_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_GENERAL_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request) {
  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    // Jika ukuran payload awal jelas melampaui batas maksimal 10 MB (tambah margin header ~128KB)
    if (contentLength > MAX_GENERAL_SIZE + 131072) {
      return NextResponse.json(
        { error: 'Ukuran foto terlalu besar. Maksimal 10 MB per foto.' },
        { status: 400 }
      );
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      return NextResponse.json(
        { error: 'Ukuran foto terlalu besar atau gagal diuraikan. Maksimal 10 MB per foto.' },
        { status: 400 }
      );
    }
    const file = formData.get('file') || formData.get('image');
    const rawFolder = (formData.get('folder') || 'products').toString();
    const sanitizedFolder = rawFolder.replace(/[^a-z0-9_-]/gi, '');
    const targetFolder = ALLOWED_FOLDERS.includes(sanitizedFolder) ? sanitizedFolder : 'products';

    // Verifikasi identitas (KTM / selfie) diizinkan saat pendaftaran sebelum memiliki sesi aktif
    const user = await getCurrentUser();
    if (!user && targetFolder !== 'verifications') {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File foto tidak ditemukan' }, { status: 400 });
    }

    const mimeType = (file.type || '').toLowerCase();
    const originalExt = path.extname(file.name || '').toLowerCase();

    // 1. Validasi format file & ukuran berdasarkan folder tujuan
    if (targetFolder === 'verifications') {
      if (!VERIFICATION_MIMES.includes(mimeType)) {
        return NextResponse.json(
          { error: 'Format berkas harus berupa gambar (JPG, PNG, WebP) dengan ukuran maksimal 5 MB.' },
          { status: 400 }
        );
      }

      if (file.name && !VERIFICATION_EXTS.includes(originalExt) && originalExt !== '') {
        return NextResponse.json(
          { error: 'Format berkas harus berupa gambar (JPG, PNG, WebP) dengan ukuran maksimal 5 MB.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_VERIFICATION_SIZE) {
        return NextResponse.json(
          { error: 'Format berkas harus berupa gambar (JPG, PNG, WebP) dengan ukuran maksimal 5 MB.' },
          { status: 400 }
        );
      }
    } else {
      if (!GENERAL_MIMES.includes(mimeType)) {
        return NextResponse.json(
          { error: 'Format file tidak didukung. Hanya file foto JPG/JPEG, PNG, dan WebP yang diperbolehkan.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_GENERAL_SIZE) {
        return NextResponse.json(
          { error: 'Ukuran foto terlalu besar. Maksimal 10 MB per foto.' },
          { status: 400 }
        );
      }
    }

    // 2. Baca buffer dan validasi integritas magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isValidImageMagicBytes(buffer, mimeType)) {
      return NextResponse.json(
        { error: 'File gambar rusak atau bukan file gambar yang valid.' },
        { status: 400 }
      );
    }

    // 3. Simpan file ke sistem penyimpanan file disk (public/uploads/[folder])
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', targetFolder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let fileExt = '.jpg';
    if (mimeType === 'image/png') {
      fileExt = '.png';
    } else if (mimeType === 'image/webp') {
      fileExt = '.webp';
    } else if (originalExt === '.jpeg') {
      fileExt = '.jpg';
    }

    const uniqueId = crypto.randomUUID();
    const fileName = `${uniqueId}${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, buffer);

    // URL publik yang dapat diakses browser
    const publicUrl = `/uploads/${targetFolder}/${fileName}`;

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil diunggah',
      url: publicUrl,
      fileName,
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (
      error?.message?.includes('FormData') ||
      error?.message?.includes('maxFileSize') ||
      error?.name === 'PayloadTooLargeError'
    ) {
      return NextResponse.json(
        { error: 'Ukuran foto terlalu besar. Maksimal 10 MB per foto.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses foto' },
      { status: 500 }
    );
  }
}
