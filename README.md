<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/logo-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="./public/logo.svg" />
  <img src="./public/logo.svg" alt="Logo LepasIn" width="210" />
</picture>

### Marketplace Preloved Mahasiswa Sekampus

*Lepas barang kostmu ke sesama mahasiswa sekampus — aman dengan verifikasi KTM, negosiasi via chat terpadu, dan COD di titik aman kampus.*

<p>
  <img src="https://img.shields.io/badge/Next.js-16.4.6-0F294A?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16.4.6" />
  <img src="https://img.shields.io/badge/React-19.3.0-1B4375?style=flat-square&logo=react&logoColor=white" alt="React 19.3.0" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-1B4375?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/PostgreSQL-14%2B-0F294A?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 14+" />
  <img src="https://img.shields.io/badge/Zod-4.6.7-334155?style=flat-square" alt="Zod 4.6.7" />
  <img src="https://img.shields.io/badge/Auth-JWT_HS256-B87D04?style=flat-square" alt="JWT HS256" />
</p>

<p>
  <a href="#arsitektur--alur-sistem">Arsitektur</a> &bull;
  <a href="#peran--hak-akses">Peran &amp; Akses</a> &bull;
  <a href="#fitur-utama">Fitur Utama</a> &bull;
  <a href="#referensi-teknis-interaktif">API &amp; Struktur</a> &bull;
  <a href="#panduan-instalasi-lokal">Instalasi Lokal</a> &bull;
  <a href="#akun-demo-seed-data">Akun Demo</a>
</p>

</div>

---

## Tentang LepasIn

**LepasIn** adalah platform *e-commerce* multi-peran (*Guest*, *Buyer*, *Seller*, dan *Admin*) yang dirancang khusus untuk kebutuhan transaksi barang *preloved* mahasiswa—mulai dari perabot kost, elektronik kerja kuliah, buku referensi, hingga perlengkapan harian lintas 30 perguruan tinggi di Indonesia.

Platform ini dibangun langsung di atas **Next.js 16 App Router (JavaScript/JSX)** dengan **PostgreSQL Raw SQL (`pg`)** tanpa ORM, proteksi sesi cookie `httpOnly` (`lepasin_session`), validasi *magic bytes* gambar unggahan, serta kontrol transaksi atomik agar stok barang tetap sinkron saat checkout maupun pembatalan pesanan.

---

## Arsitektur & Alur Sistem

### 1. Alur Navigasi Peran & Verifikasi Penjual

```mermaid
flowchart LR
    G["Tamu (Guest)"] -->|"Lanjutkan sebagai Tamu / Akses Langsung"| PUB["Beranda, Katalog, Detail Produk, Profil Toko"]
    PUB -->|"Masuk Akun (/login)"| AUTH{"Autentikasi JWT"}
    AUTH -->|"role: buyer"| BUY["Area Pembeli (/buyer/* & /chat)"]
    AUTH -->|"role: admin"| ADM["Dashboard Admin (/admin/*)"]
    AUTH -->|"role: seller"| ST{"Status Penjual?"}
    ST -->|"pending"| PEN["Menunggu Review (/pending-seller)"]
    ST -->|"rejected (awal)"| REJ["Penolakan Final + Alasan & Hapus Akun"]
    ST -->|"approved"| SEL["Dashboard Toko (/seller/* & /chat)"]
    ST -->|"ditangguhkan (was_approved=TRUE)"| SUS["Pop-up Penangguhan + Hubungi CS (WA)"]
    ADM -->|"Setujui"| SEL
    ADM -->|"Tolak + Alasan Wajib"| REJ
    ADM -->|"Tangguhkan Toko"| SUS
    ADM -->|"Aktifkan Kembali"| SEL
```

### 2. Alur Transaksi Atomik & Pengamanan Stok

```mermaid
flowchart LR
    C["Keranjang Belanja (/buyer/cart)"] -->|"Pilih Item per Toko"| CK["Checkout (/buyer/checkout)"]
    CK -->|"BEGIN + SELECT ... FOR UPDATE"| DB["Validasi Toko Approved & Potong Stok"]
    DB -->|"meetup / delivery"| ORD["Pesanan Dibuat (Menunggu Konfirmasi / Bayar)"]
    ORD -->|"Seller Proses -> Kirim / Siap COD"| SHIP["Barang Diterima Pembeli"]
    SHIP -->|"Tombol Pesanan Diterima (Buyer)"| DONE["Status completed + Buka Form Ulasan"]
    ORD -->|"Dibatalkan"| CANCEL["Status cancelled + Stok Dikembalikan Atomik"]
```

---

## Peran & Hak Akses

| Peran | Halaman yang Dapat Diakses | Batasan Keamanan & RBAC (`src/proxy.js` & `src/lib/auth.js`) |
| :--- | :--- | :--- |
| **Tamu (Guest)** | Beranda (`/`), katalog (`/products`), detail produk (`/products/[id]`), etalase toko (`/stores/[id]`), `/login`, `/register` | Dapat masuk dari `/login` lewat tombol **Lanjutkan sebagai Tamu** (tujuan rute aman publik dipertahankan; rute terproteksi otomatis diarahkan ke `/`). Wajib login untuk keranjang, wishlist, checkout, dan chat. |
| **Pembeli (`buyer`)** | Seluruh katalog publik, wishlist (`/buyer/wishlist`), keranjang (`/buyer/cart`), checkout (`/buyer/checkout`), riwayat pesanan (`/buyer/orders`), alamat (`/buyer/addresses`), profil (`/buyer/profile`), dan `/chat` | Diblokir dari seluruh rute `/seller/*` dan `/admin/*`. Hanya pembeli pemilik pesanan yang dapat menyelesaikan pesanan menjadi `completed` dan memberi ulasan. |
| **Penjual (`pending` / `rejected`)** | Halaman status verifikasi (`/pending-seller`) dengan kontrol **Keluar** di kiri atas dan **Refresh** status di kanan atas | Dilarang membuka katalog publik, `/chat`, maupun dashboard `/seller/*`. Penolakan awal bersifat final dengan alasan wajib dari Admin dan opsi **Hapus Akun** untuk daftar ulang; toko ditangguhkan (`was_approved = TRUE`) menampilkan pop-up kontak WhatsApp CS Admin. |
| **Penjual (`approved`)** | Ringkasan lapak (`/seller`), manajemen produk (`/seller/products`, `/new`, `/[id]/edit`), pesanan masuk (`/seller/orders`), pengaturan toko (`/seller/store`), dan `/chat` | Hanya mengakses area penjual dan ruang obrolan. Tidak dapat mengakses katalog publik pembeli maupun rute `/admin/*`. |
| **Admin (`admin`)** | Statistik platform (`/admin`), verifikasi penjual (`/admin/sellers`), kelola pengguna (`/admin/users`), kategori (`/admin/categories`), daftar kampus (`/admin/campuses`), dan moderasi produk (`/admin/products`) | Status verifikasi penjual hanya diproses di `/admin/sellers` (terkunci di `/admin/users/[id]/edit`). Penghapusan kategori/kampus yang masih berproduk/berkomunitas aktif diblokir dengan modal proteksi. |

---

## Fitur Utama

### Publik & Pembeli
- **Filter Kampus & Katalog Terkurasi**: Selektor 30 perguruan tinggi Indonesia di navbar, pencarian instan nama produk dan toko (*ILIKE wildcard-safe*), filter kategori, kondisi (*Seperti Baru*, *Baik*, *Layak Pakai*, *Ada Minus*), rentang harga, urutan (`latest`, `price_asc`, `price_desc`), serta paginasi 12 item per halaman.
- **Keranjang Berbasis Toko & Checkout Atomik**: Pemisahan pilihan item per toko di keranjang sebelum checkout, pilihan metode **COD / Ketemuan di Kampus** (`meetup`) dan **Dikirim ke Alamat** (`delivery`), serta penguncian stok baris PostgreSQL (`FOR UPDATE`).
- **Chat Terpadu Pra-Order & Pesanan**: Percakapan buyer–seller disatukan dalam satu ruangan per toko di `/chat` lengkap dengan *quick replies* dan banner konteks produk/pesanan.
- **Aksesibilitas Inklusif**: Panel kontrol aksesibilitas di header (ukuran teks nyaman & mode kontras tinggi) serta navigasi ramah keyboard (`focus-visible`).

### Penjual
- **Registrasi Multi-Langkah & Foto Verifikasi**: Pemilihan perguruan tinggi, info kost/lokasi COD, dan unggahan selfie bersama KTM melalui galeri atau `CameraModal` (`getUserMedia` dengan fallback kamera perangkat pada HTTP jaringan lokal).
- **Manajemen Produk & `RupiahInput`**: Form tambah/ubah barang 2 kolom dengan validasi ketat nama produk (`validateProductName`), format ribuan titik otomatis dengan indikator skala (*ribu/juta*), persentase hemat otomatis, batas harga wajar, dan unggah hingga 5 foto per barang.
- **Perlindungan Riwayat Penjualan**: Produk yang sudah memiliki transaksi selesai (`completed`) tidak dihapus secara fisik melainkan di-*soft delete* (`is_deleted = TRUE`) agar arsip pesanan dan ulasan pembeli tetap utuh.

### Admin
- **Verifikasi Penjual dengan Alasan Terstruktur**: Persetujuan toko baru, penolakan final dengan modal preset alasan + catatan wajib 10–500 karakter, serta penangguhan sementara / pengaktifan ulang toko terverifikasi.
- **Proteksi Data Relasional**: Modal proteksi saat mencoba menghapus kategori yang masih menampung produk aktif (`HAS_PRODUCTS`) atau kampus yang masih terhubung ke akun/toko, serta moderasi produk dengan pratinjau langsung.

---

## Referensi Teknis Interaktif

<details>
<summary><strong>1. Daftar Lengkap API Route Handlers (<code>src/app/api/</code>)</strong></summary>

<br />

| Kelompok | Endpoint | Kegunaan Utama |
| :--- | :--- | :--- |
| **Autentikasi & Sesi** | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/refresh-session`, `/api/auth/delete-account` | Login email/password (`bcryptjs`), registrasi buyer/seller, penghapusan cookie JWT `lepasin_session`, sinkronisasi ulang status sesi, serta hapus akun pribadi (`DELETE`) |
| **Publik & Pencarian** | `/api/products`, `/api/products/[id]`, `/api/search/instant`, `/api/campuses`, `/api/categories` | Query katalog terfilter, detail produk aktif, pencarian instan navbar, daftar kampus & kategori |
| **Upload & Media** | `/api/upload`, `/api/uploads/[folder]/[filename]` | Validasi *magic bytes* gambar (`JPEG`, `PNG`, `WebP`) serta penyajian berkas terunggah lokal |
| **Buyer** | `/api/buyer/cart`, `/api/buyer/cart/[id]`, `/api/buyer/orders`, `/api/buyer/orders/[id]`, `/api/buyer/wishlist`, `/api/buyer/reviews`, `/api/buyer/addresses`, `/api/buyer/addresses/[id]`, `/api/buyer/profile` | CRUD keranjang, pembuatan dan penyelesaian/pembatalan pesanan, toggle wishlist, pengiriman ulasan, manajemen alamat pengiriman, dan edit profil |
| **Seller** | `/api/seller/products`, `/api/seller/products/[id]`, `/api/seller/orders/[id]`, `/api/seller/store` | Tambah/edit/soft-delete produk toko, pembaruan status pesanan masuk, dan pengaturan profil toko |
| **Chat** | `/api/chat` | Pengambilan daftar ruang obrolan dan pengiriman pesan terpadu buyer–seller (`GET`, `POST`) |
| **Admin** | `/api/admin/sellers/[id]`, `/api/admin/users/[id]`, `/api/admin/categories`, `/api/admin/categories/[id]`, `/api/admin/campuses`, `/api/admin/campuses/[id]`, `/api/admin/products/[id]` | Keputusan verifikasi/penangguhan penjual (`PATCH`), edit pengguna tanpa bypass status toko, CRUD kampus & kategori berproteksi relasi, dan moderasi produk |

</details>

<details>
<summary><strong>2. Struktur Direktori Proyek</strong></summary>

<br />

```text
LepasIn/
├── database/
│   └── lepasin.sql                  # Skema tabel PostgreSQL, indeks, trigger, & seed data
├── public/
│   ├── logo.svg                     # Logo LepasIn untuk tema terang (#0F294A + titik emas 3D)
│   ├── logo-dark.svg                # Logo LepasIn untuk tema gelap (#FFFFFF + titik emas 3D)
│   └── uploads/                     # Direktori file gambar produk, toko, avatar, & verifikasi KTM
├── src/
│   ├── proxy.js                     # Route guard & redirect berbasis peran (Next.js 16)
│   ├── app/
│   │   ├── admin/                   # Dashboard admin, verifikasi penjual, pengguna, kategori, kampus, moderasi
│   │   ├── api/                     # Backend Route Handlers Next.js
│   │   ├── buyer/                   # Beranda akun buyer, keranjang, checkout, pesanan, wishlist, alamat, profil
│   │   ├── chat/                    # Ruang obrolan Buyer <-> Seller
│   │   ├── login/ & register/       # Halaman autentikasi (termasuk akses Lanjutkan sebagai Tamu)
│   │   ├── pending-seller/          # Status review/penolakan/penangguhan toko + kontak CS WhatsApp
│   │   ├── products/                # Katalog pencarian & halaman detail produk
│   │   ├── seller/                  # Dashboard lapak, CRUD produk, pesanan masuk, pengaturan toko
│   │   ├── stores/[id]/             # Profil & etalase toko publik
│   │   ├── globals.css              # Token tema Tailwind CSS v4, gaya elevasi 3D, & aksesibilitas
│   │   ├── layout.js                # Root layout & pemuatan font Plus Jakarta Sans
│   │   └── page.js                  # Beranda LepasIn
│   ├── components/
│   │   ├── home/                    # Showcase 3D halaman utama
│   │   ├── layout/                  # Navbar, Footer, BottomNav, DashboardShell, Sidebar
│   │   ├── product/                 # ProductCard katalog
│   │   └── ui/                      # Button, Input, RupiahInput, Select, Modal, ConfirmDialog, Toast, ImageUploader, CameraModal
│   └── lib/
│       ├── auth.js                  # Helper autentikasi server-side & pembatasan role publik
│       ├── db.js                    # Pool PostgreSQL & migrasi startup aman (migrationPromise lock)
│       ├── session.js               # Penandatanganan & verifikasi cookie JWT (jose)
│       ├── order-guards.js          # Guard pesanan aktif & pembekuan transaksi
│       ├── params.js                # Parsing parameter aman & escape wildcard ILIKE
│       ├── product-validation.js    # Validasi batas harga & aturan nama produk
│       ├── price-input.js           # Pemformatan & perhitungan diskon RupiahInput
│       ├── validation.js            # Validator teks, email, telepon, kampus, & kategori
│       ├── form-utils.js            # Utilitas scroll/fokus ke field error pertama
│       └── image-util.js            # Utilitas pemrosesan pratinjau gambar
├── .env.example                     # Contoh variabel environment
├── next.config.mjs                  # Konfigurasi allowedDevOrigins LAN & Turbopack
└── package.json                     # Dependensi & skrip npm
```

</details>

<details>
<summary><strong>3. Checklist Verifikasi Alur &amp; Catatan Pemecahan Masalah</strong></summary>

<br />

Gunakan daftar periksa interaktif ini bila menguji aplikasi secara menyeluruh sebelum presentasi/deploy:

- [ ] **Akses Tamu**: Buka `/login`, klik **Lanjutkan sebagai Tamu**, lalu jelajahi beranda (`/`), `/products`, filter kampus, dan detail produk tanpa dipaksa login.
- [ ] **Checkout Pembeli**: Masuk sebagai `andi@lepasin.id`, pilih item per toko di `/buyer/cart`, lanjutkan checkout, dan konfirmasi penerimaan pada pesanan aktif.
- [ ] **Verifikasi & Penangguhan Seller**: Masuk sebagai `admin@lepasin.id` di `/admin/sellers`, uji persetujuan/penolakan ber-alasan pada akun `pending`, lalu uji **Tangguhkan Toko** pada seller `approved` dan cek pop-up CS WhatsApp saat seller tersebut login.
- [ ] **Proteksi Penghapusan Relasi**: Uji tombol hapus kategori atau kampus yang masih memiliki produk/pengguna aktif di `/admin/categories` & `/admin/campuses` untuk memastikan modal proteksi muncul.
- [ ] **Akses Kamera via Jaringan Lokal (HTTP)**: Fitur *live stream* kamera di browser (`navigator.mediaDevices.getUserMedia`) hanya diizinkan pada konteks aman (`localhost` atau `HTTPS`). Jika mengakses dari HP lewat alamat IP LAN `http://<IP>:3000`, gunakan tombol fallback **Buka Kamera Perangkat** atau **Pilih dari Galeri** di dalam `CameraModal`.

</details>

---

## Panduan Instalasi Lokal

### 1. Prasyarat
- **Node.js** 18+ (disarankan versi LTS) dan **npm**
- **PostgreSQL** 14+

### 2. Siapkan Database PostgreSQL
Buat database kosong bernama `lepasin`, lalu impor skema beserta data awal dari [`database/lepasin.sql`](./database/lepasin.sql):

```bash
psql -U postgres -d lepasin -f database/lepasin.sql
```

*(Saat aplikasi pertama kali mengakses database, `src/lib/db.js` juga menjalankan pengecekan migrasi startup aman agar struktur tabel dan kolom tetap selaras.)*

### 3. Konfigurasi Environment Variable
Salin [`.env.example`](./.env.example) menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Untuk **PowerShell (Windows)**:

```powershell
Copy-Item .env.example .env.local
```

Sesuaikan nilai di `.env.local`:

```env
DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@localhost:5432/lepasin
JWT_SECRET=isi-secret-acak-minimal-32-karakter
NODE_ENV=development

# Opsional: override nomor WhatsApp CS Admin pada pop-up penangguhan toko
# NEXT_PUBLIC_CS_WHATSAPP=081200000001
```

### 4. Instal Dependensi & Jalankan Aplikasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000` di browser (juga mendukung akses perangkat lain dalam satu Wi-Fi/LAN lewat konfigurasi `allowedDevOrigins` di [`next.config.mjs`](./next.config.mjs)).

### Perintah NPM

```bash
npm run dev     # Menjalankan server development Next.js
npm run lint    # Menjalankan pemeriksaan ESLint
npm run build   # Membangun bundle produksi (Turbopack)
npm run start   # Menjalankan aplikasi hasil build produksi
```

---

## Akun Demo (Seed Data)

Skrip `database/lepasin.sql` menyediakan dataset awal yang berisi **30 Perguruan Tinggi**, **8 Kategori Produk**, **36 Pengguna**, **32 Toko**, **121 Produk beserta 121 Foto Produk**, **7 Pesanan**, **3 Ulasan**, dan **9 Pesan Chat**.

Seluruh akun bawaan menggunakan kata sandi **`LepasIn123`** (atau klik langsung kartu **Akun Demo Pengujian** pada halaman `/login`):

| Peran | Nama | Email | Kampus | Keterangan Skenario |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Admin LepasIn | `admin@lepasin.id` | - | Manajemen platform, verifikasi penjual, & nomor default CS Admin (`081200000001`) |
| **Seller (`approved`)** | Dinda Putri Rahayu | `dinda@lepasin.id` | UNHAS (Makassar) | Lapak Dinda UNHAS (toko terverifikasi dengan riwayat COD) |
| **Seller (`approved`)** | Rizky Pratama Putra | `rizky@lepasin.id` | UI (Depok) | Rizky Preloved UI (toko terverifikasi & chat pra-order aktif) |
| **Seller (`pending`)** | Salsa Amelia Putri | `salsa@lepasin.id` | UNHAS (Makassar) | Status menunggu persetujuan verifikasi KTM oleh Admin |
| **Seller (`rejected`)** | Bayu Saputra | `bayu@lepasin.id` | ITS (Surabaya) | Status penolakan awal final beserta contoh `rejection_reason` |
| **Buyer** | Andi Firmansyah | `andi@lepasin.id` | UNHAS (Makassar) | Keranjang, favorit, pesanan COD aktif, ulasan, & chat |
| **Buyer** | Nabila Zahra | `nabila@lepasin.id` | UI (Depok) | Keranjang, favorit, pesanan *delivery* aktif, & chat |
| **Buyer** | Rafi Alfarizi | `rafi@lepasin.id` | UGM (Yogyakarta) | Favorit, pesanan selesai & menunggu pembayaran |

<details>
<summary>Catatan cakupan dataset kampus lainnya pada <code>database/lepasin.sql</code></summary>

Selain tabel sampel di atas, terdapat **28 akun penjual terverifikasi tambahan** untuk kampus lainnya di Indonesia (mulai dari USK Banda Aceh, UNAND Padang, ITB Bandung, UGM Yogyakarta, UB Malang, UNDIP Semarang, UNPAD Sumedang, ITS Surabaya, UNUD Bali, UNMUL Samarinda, ULM Banjarmasin, hingga UNCEN Jayapura) dengan pola email `<nama>@lepasin.id` dan kata sandi `LepasIn123`.

</details>
