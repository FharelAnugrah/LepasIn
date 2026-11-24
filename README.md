# LepasIn

> *Lepas barang kostmu ke sesama Mahasiswa sekampus.*

**LepasIn** adalah marketplace web (*e-commerce* multi-peran) khusus barang *preloved* untuk mahasiswa dan anak kost di seluruh perguruan tinggi Indonesia. Pengguna dapat mencari barang berdasarkan kampus, berkoordinasi lewat ruang chat, memilih **COD Ketemuan di Kampus** atau pengiriman ke kost, serta mengunggah foto produk maupun verifikasi identitas langsung dari kamera atau galeri.

---

## Teknologi Utama

- **Framework**: Next.js 16 (`16.4.6`) — App Router (JavaScript + JSX)
- **UI & Styling**: React `19.3.0`, Tailwind CSS v4 (`@tailwindcss/turbopack`), `lucide-react`, Google Font *Plus Jakarta Sans*
- **Database**: PostgreSQL 14+ menggunakan Raw SQL via `pg` (tanpa ORM) dengan *parameterized queries* (`$1, $2, ...`) dan transaksi atomik
- **Autentikasi**: JWT HS256 (`jose`) dalam cookie `httpOnly` (`lepasin_session`, berlaku 7 hari) + `bcryptjs` (cost 10)
- **Validasi**: `zod` di API backend beserta validasi *magic bytes* gambar (`image/jpeg`, `image/png`, `image/webp`)

---

## Peran & Hak Akses

| Peran | Area Akses Utama | Pembatasan |
| :--- | :--- | :--- |
| **Tamu (Guest)** | Beranda (`/`), katalog (`/products`), detail produk (`/products/[id]`), profil toko (`/stores/[id]`), `/login`, `/register` | Tidak dapat bertransaksi/wishlist/chat sebelum masuk akun |
| **Pembeli (`buyer`)** | Katalog publik, profil toko, wishlist (`/buyer/wishlist`), keranjang (`/buyer/cart`), checkout (`/buyer/checkout`), pesanan (`/buyer/orders`), ulasan, alamat (`/buyer/addresses`), profil (`/buyer/profile`), chat (`/chat`) | Tidak dapat mengakses area `/seller/*` maupun `/admin/*` |
| **Penjual (`seller` — `pending` / `rejected`)** | Halaman status verifikasi (`/pending-seller`), serta opsi **Hapus Akun** khusus bila berstatus `rejected` | Tidak dapat membuka katalog publik, `/chat`, maupun dashboard `/seller/*` |
| **Penjual (`seller` — `approved`)** | Dashboard lapak (`/seller`), kelola produk (`/seller/products`), pesanan masuk (`/seller/orders`), pengaturan toko (`/seller/store`), chat pembeli (`/chat`) | Hanya mengakses dashboard penjual & ruang chat; tidak mengakses katalog publik maupun `/admin/*` |
| **Admin (`admin`)** | Dashboard statistik (`/admin`), verifikasi KTM penjual (`/admin/sellers`), kelola pengguna (`/admin/users`), kategori (`/admin/categories`), kampus (`/admin/campuses`), moderasi & pratinjau produk (`/admin/products`) | Hanya mengakses dashboard admin; tidak mengakses katalog publik maupun `/chat` |

---

## Fitur Utama

### Publik & Pembeli
- **Filter Kampus se-Indonesia**: Selektor perguruan tinggi di header untuk memprioritaskan barang dari kampus pilihan maupun menjelajah lintas kampus.
- **Pencarian & Katalog Lengkap**: Pencarian instan nama produk/toko, filter kategori, kondisi (*Seperti Baru*, *Baik*, *Layak Pakai*, *Ada Minus*), rentang harga, paginasi (`12` item per halaman), serta urutan (*Paling Baru Dilepas*, *Harga: Termurah*, *Harga: Tertinggi*).
- **Keranjang & Checkout Atomik**: Item dikelompokkan per toko, mendukung metode **COD / Ketemuan di Kampus** (`meetup`) dan **Dikirim ke Alamat** (`delivery`), penguncian baris stok (`FOR UPDATE`), dan pengembalian stok saat pesanan dibatalkan.
- **Konfirmasi & Ulasan Anti-Penipuan**: Status `completed` hanya dapat diselesaikan oleh Pembeli setelah barang diterima (`Pesanan Diterima`), diikuti pengisian rating bintang (`1–5`) dan ulasan.
- **Chat Terpadu Pembeli–Penjual**: Tanya produk pra-order maupun koordinasi COD/pesanan dalam satu timeline percakapan di `/chat`.

### Penjual
- **Registrasi & Verifikasi KTM**: Pendaftaran toko memilih kampus asal, area kost, dan foto selfie/KTM.
- **Manajemen Produk & Input Harga Nyaman**: Form 2 kolom dengan komponen `RupiahInput` (pemisah ribuan titik otomatis, prefix `Rp`, pembaca skala *ribu/juta*, dan kalkulasi persentase hemat otomatis), serta batas stok produk.
- **Kamera & Galeri Foto**: `ImageUploader` dan `CameraModal` (`getUserMedia` / input kamera seluler + drag & drop) hingga 5 foto per produk.

### Admin
- **Panel Manajemen Terpusat**: Statistik nasional, persetujuan/penolakan penjual dengan pratinjau foto KTM, manajemen pengguna (peran, status, kampus), CRUD daftar perguruan tinggi dan kategori, serta moderasi produk via modal pratinjau langsung.

---

## Struktur Proyek

```text
LepasIn/
├── database/
│   └── lepasin.sql            # Skema awal PostgreSQL & seed data
├── public/uploads/            # Penyimpanan lokal file unggahan (products, stores, avatars, verifications)
├── src/
│   ├── proxy.js               # Proteksi & redirect rute berbasis peran (Next.js 16)
│   ├── app/
│   │   ├── admin/             # Halaman & komponen dashboard Admin
│   │   ├── api/               # Route Handlers (auth, buyer, seller, admin, products, chat, upload)
│   │   ├── buyer/             # Dashboard, keranjang, checkout, pesanan, wishlist, alamat, profil
│   │   ├── chat/              # Ruang percakapan Buyer <-> Seller
│   │   ├── login/ & register/ # Autentikasi pengguna
│   │   ├── pending-seller/    # Status review & penolakan pendaftaran penjual
│   │   ├── products/          # Katalog publik & detail produk
│   │   ├── seller/            # Dashboard, produk, pesanan masuk, & pengaturan toko
│   │   ├── stores/[id]/       # Halaman etalase toko publik
│   │   ├── globals.css        # Konfigurasi tema Tailwind CSS v4 & utilitas 3D/aksesibilitas
│   │   └── page.js            # Beranda LepasIn
│   ├── components/
│   │   ├── home/              # Komponen showcase halaman utama
│   │   ├── layout/            # Navbar, Footer, BottomNav, DashboardShell, Sidebar
│   │   ├── product/           # Kartu produk
│   │   └── ui/                # Button, Input, RupiahInput, Select, Modal, Toast, ImageUploader, CameraModal, dll.
│   └── lib/                   # Koneksi DB + migrasi ringan (db.js), auth/session, validasi, format harga
├── .env.example
├── next.config.mjs
└── package.json
```

---

## Cara Menjalankan di Lokal

### 1. Prasyarat
- **Node.js** 18+ (disarankan LTS) & **npm**
- **PostgreSQL** 14+

### 2. Siapkan Database PostgreSQL
Buat database kosong bernama `lepasin`, lalu jalankan skrip `database/lepasin.sql` melalui pgAdmin Query Tool atau terminal:

```bash
psql -U postgres -d lepasin -f database/lepasin.sql
```

*(Catatan: `src/lib/db.js` juga menjalankan penyesuaian skema ringan secara otomatis saat query pertama dijalankan, termasuk pembuatan tabel `chats`.)*

### 3. Konfigurasi Environment Variable
Salin berkas `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Sesuaikan nilai di `.env.local`:

```env
DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@localhost:5432/lepasin
JWT_SECRET=isi-secret-acak-minimal-32-karakter
NODE_ENV=development
```

### 4. Instal Dependensi & Jalankan Aplikasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000` di browser.

### Perintah NPM Lainnya

```bash
npm run lint    # Menjalankan ESLint
npm run build   # Membangun aplikasi untuk produksi
npm run start   # Menjalankan hasil build produksi
```

---

## Akun Demo (Seed Data)

Seluruh akun bawaan dari `database/lepasin.sql` menggunakan kata sandi **`LepasIn123`**:

| Peran | Nama | Email | Kampus | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Admin LepasIn | `admin@lepasin.id` | - | Akses penuh manajemen & moderasi |
| **Seller (Approved)** | Dinda Putri Rahayu | `dinda@lepasin.id` | UNHAS (Makassar) | Lapak Dinda UNHAS (4 produk + riwayat COD) |
| **Seller (Approved)** | Rizky Pratama Putra | `rizky@lepasin.id` | UI (Depok) | Rizky Preloved UI (4 produk + chat pra-order) |
| **Seller (Approved)** | Alya Rahmawati | `alya@lepasin.id` | ITB (Bandung) | Alya Kos ITB (2 produk + pesanan diproses) |
| **Seller (Approved)** | Dimas Adi Nugroho | `dimas@lepasin.id` | UGM (Yogyakarta) | Dimas Preloved UGM (2 produk + ulasan) |
| **Seller (Approved)** | Fajar Maulana Hakim | `fajar@lepasin.id` | UB (Malang) | Fajar Thrift UB (2 produk + pesanan masuk) |
| **Seller (Approved)** | Tari Kusuma Dewi | `tari@lepasin.id` | UNDIP (Semarang) | Tari Preloved UNDIP (2 produk dapur & kost) |
| **Seller (Approved)** | Hendra Wijaya | `hendra@lepasin.id` | UNPAD (Sumedang) | Hendra Garage UNPAD (2 produk) |
| **Seller (Approved)** | Putri Maharani | `putri@lepasin.id` | ITS (Surabaya) | Putri Kos ITS (2 produk) |
| **Seller (Pending)** | Salsa Amelia Putri | `salsa@lepasin.id` | UNHAS (Makassar) | Menunggu verifikasi KTM oleh Admin |
| **Seller (Rejected)** | Bayu Saputra | `bayu@lepasin.id` | ITS (Surabaya) | Status ditolak (tersedia opsi hapus akun) |
| **Buyer** | Andi Firmansyah | `andi@lepasin.id` | UNHAS (Makassar) | Keranjang, favorit, pesanan COD aktif, ulasan, & chat |
| **Buyer** | Nabila Zahra | `nabila@lepasin.id` | UI (Depok) | Keranjang, favorit, pesanan delivery aktif, & chat |
| **Buyer** | Rafi Alfarizi | `rafi@lepasin.id` | UGM (Yogyakarta) | Favorit, pesanan selesai & menunggu pembayaran |
