import Link from 'next/link';
import {
  GraduationCap,
  Package,
  Handshake,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { query } from '@/lib/db';
import { getCurrentUser, redirectRestrictedPublicRole } from '@/lib/auth';
import { parsePositiveInt } from '@/lib/params';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import ProductCard from '@/components/product/ProductCard';
import Button from '@/components/ui/Button';
import HeroAnimatedBackground from '@/components/ui/HeroAnimatedBackground';
import HeroShowcaseBadges from '@/components/ui/HeroShowcaseBadges';

export const dynamic = 'force-dynamic';

const PRODUCT_BASE_QUERY = `
  SELECT p.id, p.name, p.price, p.original_price, p.stock, p.condition, p.created_at,
         c.name AS category_name,
         s.name AS store_name,
         s.location AS store_location,
         cp.id AS campus_id,
         cp.short_name AS campus_short_name,
         cp.name AS campus_name,
         cp.city AS campus_city,
         (SELECT pi.url FROM product_images pi
           WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1) AS image_url,
         COALESCE(r.avg_rating, 0)   AS avg_rating,
         COALESCE(r.review_count, 0) AS review_count
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN stores s     ON s.id = p.store_id
  JOIN campuses cp  ON cp.id = s.campus_id
  JOIN users u      ON u.id = s.user_id AND u.seller_status = 'approved'
  LEFT JOIN (SELECT product_id, ROUND(AVG(rating), 1)::float AS avg_rating, COUNT(*)::int AS review_count
             FROM reviews GROUP BY product_id) r ON r.product_id = p.id
`;

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  redirectRestrictedPublicRole(user);

  const rawCampus = (Array.isArray(sp?.campus) ? sp.campus[0] : sp?.campus || '').trim();
  const isAllCampuses = rawCampus.toLowerCase() === 'all';
  const validCampusParam = isAllCampuses ? null : parsePositiveInt(rawCampus);

  const selectedCampusId = isAllCampuses ? null : (validCampusParam || user?.campus_id || null);
  const selectedCategoryId = parsePositiveInt(sp?.category);

  // 1. Ambil Kategori (posisi 'Lainnya' selalu berada di paling akhir)
  const categoriesRes = await query(`
    SELECT id, name FROM categories
    ORDER BY
      CASE
        WHEN LOWER(name) = 'lainnya' OR LOWER(name) = 'lain-lain' THEN 1
        ELSE 0
      END ASC,
      id ASC
  `);
  const categories = categoriesRes.rows;

  // 2. Ambil Kampus Terpilih + Ringkasan Nyata dari DB
  let selectedCampusObj = null;
  if (selectedCampusId) {
    const campusRes = await query(`SELECT id, name, short_name, city FROM campuses WHERE id = $1`, [
      selectedCampusId,
    ]);
    selectedCampusObj = campusRes.rows[0] || null;
  }

  let realSummary = { campusCount: 0, availableCount: 0 };
  try {
    const summaryRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM campuses) AS campus_count,
        (SELECT COUNT(*)::int FROM products p
         JOIN stores s ON s.id = p.store_id
         JOIN users u ON u.id = s.user_id AND u.seller_status = 'approved'
         WHERE p.stock > 0 AND p.is_deleted = FALSE) AS available_count
    `);
    realSummary = {
      campusCount: summaryRes.rows[0]?.campus_count || 0,
      availableCount: summaryRes.rows[0]?.available_count || 0,
    };
  } catch (err) {
    console.error('Error fetching home summary:', err);
  }

  // 3. Info Keranjang & Wishlist jika Buyer
  let cartCount = 0;
  let cartTotal = 0;
  let wishlistIds = new Set();

  if (user && user.role === 'buyer') {
    const cartRes = await query(
      `SELECT COALESCE(SUM(ci.quantity), 0)::int AS count, COALESCE(SUM(ci.quantity * p.price), 0)::int AS total
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1 AND p.is_deleted = FALSE`,
      [user.id]
    );
    cartCount = cartRes.rows[0]?.count || 0;
    cartTotal = cartRes.rows[0]?.total || 0;

    const wishRes = await query(`SELECT product_id FROM wishlists WHERE user_id = $1`, [user.id]);
    wishlistIds = new Set(wishRes.rows.map((r) => r.product_id));
  }

  // 4. Query Rekomendasi Kampus / Pilihan
  let recommendations = [];
  try {
    const recParams = [];
    let recSql = `${PRODUCT_BASE_QUERY} WHERE p.stock > 0 AND p.is_deleted = FALSE`;

    if (selectedCampusId) {
      recParams.push(selectedCampusId);
      recSql += ` AND s.campus_id = $${recParams.length}`;
    }

    if (selectedCategoryId) {
      recParams.push(selectedCategoryId);
      recSql += ` AND p.category_id = $${recParams.length}`;
    }

    recSql += ` ORDER BY p.created_at DESC LIMIT 4`;

    const recRes = await query(recSql, recParams);
    recommendations = recRes.rows;
  } catch (err) {
    console.error('Error fetching recommendations:', err);
  }

  // 5. Query "Baru Dilepas"
  let latestProducts = [];
  try {
    const latestRes = await query(
      `${PRODUCT_BASE_QUERY}
       WHERE p.is_deleted = FALSE
       ORDER BY
         CASE WHEN p.stock > 0 THEN 0 ELSE 1 END ASC,
         p.created_at DESC,
         p.id DESC
       LIMIT 4`
    );
    latestProducts = latestRes.rows;
  } catch (err) {
    console.error('Error fetching latest products:', err);
  }

  // Tombol CTA kedua Hero kondisional berdasarkan role user
  const role = (user?.role || '').toLowerCase();
  const isSeller = role === 'seller' || Boolean(user?.store_id) || user?.seller_status === 'approved';
  const isAdmin = role === 'admin';
  const isBuyer = role === 'buyer';

  const secondaryCta = isSeller
    ? { href: '/seller/products/new', label: '+ Jual Barang Preloved' }
    : isAdmin
    ? { href: '/admin/sellers', label: '📋 Verifikasi Penjual' }
    : isBuyer
    ? { href: '/buyer/orders', label: 'Pesanan Saya' }
    : { href: '/register?role=seller', label: 'Buka Lapak Mahasiswa' };

  return (
    <div className="min-h-screen flex flex-col text-ink">
      <Navbar
        user={user}
        cartCount={cartCount}
        selectedCampus={selectedCampusObj}
        showSearchBar={true}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-7 flex flex-col space-y-9 outline-none"
      >
        {/* Horizontal Category Chips 3D Keycaps */}
        <nav aria-label="Kategori produk" className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1.5 px-0.5">
          <Link
            href={isAllCampuses ? '/?campus=all' : validCampusParam ? `/?campus=${validCampusParam}` : '/'}
            className={`inline-flex items-center min-h-[42px] rounded-xl px-4 py-2 text-xs whitespace-nowrap ${
              !selectedCategoryId
                ? 'chip-3d-active font-semibold'
                : 'chip-3d font-medium'
            }`}
          >
            <span>Semua Produk</span>
          </Link>
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}${selectedCampusId ? `&campus=${selectedCampusId}` : ''}`}
                className={`inline-flex items-center min-h-[42px] rounded-xl px-4 py-2 text-xs whitespace-nowrap ${
                  isSelected
                    ? 'chip-3d-active font-semibold'
                    : 'chip-3d font-medium'
                }`}
              >
                <span>{cat.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Hero Banner Monolith 3D (Modern E-Commerce Hero Showcase) */}
        <section
          aria-label="Pengenalan LepasIn"
          className="plinth-navy-3d relative overflow-hidden rounded-3xl text-white flex flex-col"
        >
          {/* Latar Belakang Animasi Bergerak Interaktif 3D (Luminous Aurora, Constellation Orbit, Isometric Grid & Parallax) */}
          <HeroAnimatedBackground />

          {/* Badge Diskon Aksen Emas (Pojok Kanan Atas Banner) */}
          <div className="hero-starburst-pulse absolute top-4 right-4 sm:top-6 sm:right-8 z-20 pointer-events-auto">
            <span className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-campus-gold text-ink font-black text-[11px] sm:text-xs shadow-[0_4px_14px_rgba(251,191,36,0.35),0_2px_0_#B37903] border border-amber-200/90 select-none">
              <Sparkles className="w-3.5 h-3.5 fill-ink/20 shrink-0" aria-hidden="true" />
              <span className="tracking-tight whitespace-nowrap">Hemat s/d 70%</span>
            </span>
          </div>

          {/* Bagian Atas Hero (Grid 2-Kolom: Teks Narasi & 3D Preloved Item Showcase) */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-6 sm:p-8 md:p-10">
            {/* Sisi Kiri: Headline, Subheadline, Deskripsi, 2 Tombol CTA Pill 3D */}
            <div className="lg:col-span-7 flex flex-col gap-4 text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] xl:text-[2.85rem] font-extrabold tracking-tight leading-[1.18] text-white">
                Barang kost tak terpakai?{' '}
                <span className="text-campus-gold drop-shadow-[0_2px_0_rgba(7,23,44,0.45)]">
                  Saatnya dilepas!
                </span>
              </h1>

              <div className="flex flex-col gap-1">
                <p className="text-base sm:text-lg lg:text-xl font-semibold text-slate-100 leading-snug">
                  Temukan pemilik baru dari sesama Mahasiswa.
                </p>
                <p className="text-xs sm:text-sm md:text-[15px] text-slate-200 leading-relaxed max-w-lg">
                  Marketplace preloved khusus Mahasiswa untuk jual beli langsung antar Mahasiswa. Cek barang langsung saat COD sekampus.
                </p>
              </div>

              {/* 2 Tombol CTA Pill 3D Berdampingan */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1.5">
                <Link
                  href="/products"
                  className="btn-3d btn-3d-accent inline-flex items-center justify-center min-h-[46px] font-bold text-sm rounded-full px-6 py-2.5 shadow-lg"
                >
                  <span>⚡ Jelajah Produk</span>
                </Link>
                <Link
                  href={secondaryCta.href}
                  className="btn-3d btn-3d-frost inline-flex items-center justify-center min-h-[46px] font-semibold text-sm rounded-full px-6 py-2.5"
                >
                  <span>{secondaryCta.label}</span>
                </Link>
              </div>
            </div>

            {/* Sisi Kanan: Area Orbiting 3D Preloved Item Badges */}
            <div className="lg:col-span-5 relative flex items-center justify-center min-h-[280px] perspective-stage">
              <HeroShowcaseBadges />
            </div>
          </div>

          {/* Bagian Bawah Hero: Integrated Bottom Trust Strip */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md border-t border-white/15 px-6 sm:px-8 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {/* Item 1: COD Kampus */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-campus-gold shrink-0 shadow-inner">
                <Handshake className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  COD Kampus
                </span>
                <span className="text-[11px] sm:text-xs text-slate-200 truncate">
                  Cek fisik langsung di fakultas
                </span>
              </div>
            </div>

            {/* Item 2: Khusus Mahasiswa */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-campus-gold shrink-0 shadow-inner">
                <GraduationCap className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  Khusus Mahasiswa
                </span>
                <span className="text-[11px] sm:text-xs text-slate-200 truncate">
                  {selectedCampusObj ? `Komunitas ${selectedCampusObj.short_name} & mitra aktif` : 'Komunitas UNHAS & mitra aktif'}
                </span>
              </div>
            </div>

            {/* Item 3: Harga Anak Kost */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-campus-gold shrink-0 shadow-inner">
                <Package className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  Harga Anak Kost
                </span>
                <span className="text-[11px] sm:text-xs text-slate-200 truncate">
                  Hemat s/d 70% barang preloved
                </span>
              </div>
            </div>

            {/* Item 4: 100% Aman */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-campus-gold shrink-0 shadow-inner">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  100% Aman
                </span>
                <span className="text-[11px] sm:text-xs text-slate-200 truncate">
                  Wajib verifikasi KTM & selfie
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Rekomendasi Kampus */}
        <section className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl icon-plinth-3d text-brand-blue items-center justify-center shrink-0 mt-0.5">
              <GraduationCap className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg md:text-xl font-extrabold text-ink tracking-tight">
                  Rekomendasi Kampus
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-brand-blue-soft border border-brand-blue-border text-brand-blue shadow-[0_1.5px_0_#C5D6EA]">
                  <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{selectedCampusObj ? selectedCampusObj.short_name : 'Semua Kampus'}</span>
                </span>
              </div>
              <p className="text-xs md:text-sm text-ink-muted mt-1">
                {selectedCampusObj
                  ? `Barang preloved terdekat di area ${selectedCampusObj.short_name} (${selectedCampusObj.city}).`
                  : 'Pilihan barang preloved yang siap COD atau dikirim dari berbagai kampus.'}
              </p>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-8 text-center surface-3d rounded-2xl text-sm text-ink-muted">
              <p className="mb-3">
                {selectedCampusObj
                  ? `Belum ada produk tersedia untuk ${selectedCampusObj.short_name}.`
                  : 'Belum ada produk yang tersedia saat ini.'}
              </p>
              <Button href="/products" variant="primary" size="sm">
                Jelajah Semua Kampus
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {recommendations.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isWishlisted={wishlistIds.has(product.id)}
                    user={user}
                  />
                ))}
              </div>
              <div className="flex justify-center pt-1">
                <Link
                  href={`/products${selectedCampusId ? `?campus=${selectedCampusId}` : ''}`}
                  className="btn-3d btn-3d-secondary inline-flex items-center justify-center min-h-[42px] text-xs font-semibold px-10 py-2.5 rounded-xl"
                >
                  Lihat semua produk
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Section 2: Baru Dilepas */}
        <section className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl icon-plinth-navy text-campus-gold items-center justify-center shrink-0 mt-0.5">
              <Package className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-ink tracking-tight">
                Baru Dilepas Mahasiswa
              </h2>
              <p className="text-xs md:text-sm text-ink-muted mt-1">
                Unggahan terbaru dari kamar kost dan asrama Mahasiswa se-Indonesia.
              </p>
            </div>
          </div>

          {latestProducts.length === 0 ? (
            <div className="p-8 text-center surface-3d rounded-2xl text-sm text-ink-muted">
              Belum ada barang baru yang diunggah.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {latestProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isWishlisted={wishlistIds.has(product.id)}
                    user={user}
                  />
                ))}
              </div>
              <div className="flex justify-center pt-1">
                <Link
                  href="/products"
                  className="btn-3d btn-3d-secondary inline-flex items-center justify-center min-h-[42px] text-xs font-semibold px-10 py-2.5 rounded-xl"
                >
                  Buka katalog lengkap
                </Link>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
      <BottomNav user={user} cartCount={cartCount} cartTotal={cartTotal} />
    </div>
  );
}
