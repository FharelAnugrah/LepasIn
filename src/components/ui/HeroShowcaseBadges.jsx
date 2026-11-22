'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Laptop,
  BedDouble,
  BookOpen,
  Cpu,
  GraduationCap,
  Utensils,
  Shirt,
  Dumbbell,
  Bike,
} from 'lucide-react';

/**
 * 2 Batch Kategori Preloved Mahasiswa
 * - Batch 1 (0): Laptop & Gadget, Buku Kuliah, Elektronik Kost, Perabot Kost
 * - Batch 2 (1): Alat Dapur Kost, Olahraga & Hobi, Kendaraan & Helm, Fashion & Jas Lab
 */
const BATCHES = [
  {
    top: {
      href: '/products?category=1',
      title: 'Lihat Laptop & Gadget Preloved',
      name: 'Laptop & Gadget',
      tag: 'Mulus',
      icon: Laptop,
      iconBg: 'bg-gradient-to-br from-blue-400/30 to-navy-900/50',
      iconBorder: 'border border-blue-300/40',
      iconColor: 'text-blue-200',
    },
    right: {
      href: '/products?category=4',
      title: 'Lihat Buku & Diktat Kuliah',
      name: 'Buku Kuliah',
      tag: 'Lengkap',
      icon: BookOpen,
      iconBg: 'bg-gradient-to-br from-indigo-400/25 to-navy-900/50',
      iconBorder: 'border border-indigo-300/40',
      iconColor: 'text-indigo-200',
    },
    bottom: {
      href: '/products?category=1',
      title: 'Lihat Kipas & Elektronik Kost',
      name: 'Elektronik Kost',
      tag: 'Normal',
      icon: Cpu,
      iconBg: 'bg-gradient-to-br from-cyan-400/25 to-navy-900/50',
      iconBorder: 'border border-cyan-300/40',
      iconColor: 'text-cyan-200',
    },
    left: {
      href: '/products?category=2',
      title: 'Lihat Kasur & Perabot Kost',
      name: 'Perabot Kost',
      tag: 'Bersih',
      icon: BedDouble,
      iconBg: 'bg-gradient-to-br from-amber-400/25 to-navy-900/50',
      iconBorder: 'border border-amber-300/40',
      iconColor: 'text-amber-200',
    },
  },
  {
    top: {
      href: '/products?category=5',
      title: 'Lihat Alat Dapur Kost Preloved',
      name: 'Alat Dapur Kost',
      tag: 'Praktis',
      icon: Utensils,
      iconBg: 'bg-gradient-to-br from-orange-400/25 to-navy-900/50',
      iconBorder: 'border border-orange-300/40',
      iconColor: 'text-orange-200',
    },
    right: {
      href: '/products?category=6',
      title: 'Lihat Alat Olahraga & Hobi',
      name: 'Olahraga & Hobi',
      tag: 'Siap Pakai',
      icon: Dumbbell,
      iconBg: 'bg-gradient-to-br from-emerald-400/25 to-navy-900/50',
      iconBorder: 'border border-emerald-300/40',
      iconColor: 'text-emerald-200',
    },
    bottom: {
      href: '/products?category=7',
      title: 'Lihat Sepeda & Helm Mahasiswa',
      name: 'Kendaraan & Helm',
      tag: 'Aman',
      icon: Bike,
      iconBg: 'bg-gradient-to-br from-teal-400/25 to-navy-900/50',
      iconBorder: 'border border-teal-300/40',
      iconColor: 'text-teal-200',
    },
    left: {
      href: '/products?category=3',
      title: 'Lihat Fashion & Jas Praktikum',
      name: 'Fashion & Jas Lab',
      tag: 'Rapih',
      icon: Shirt,
      iconBg: 'bg-gradient-to-br from-fuchsia-400/25 to-navy-900/50',
      iconBorder: 'border border-fuchsia-300/40',
      iconColor: 'text-fuchsia-200',
    },
  },
];

/**
 * Sub-komponen Badge Kategori Preloved Mahasiswa dengan Glassmorphism 3D
 */
function ShowcaseBadgeLink({
  href,
  title,
  name,
  tag,
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
}) {
  return (
    <Link
      href={href}
      title={title}
      className="group block select-none pointer-events-auto"
      style={{
        transformStyle: 'preserve-3d',
        transform: 'translateZ(20px)',
      }}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-white/[0.14] hover:bg-white/[0.24] backdrop-blur-md border border-white/25 hover:border-campus-gold/60 shadow-[0_8px_24px_-6px_rgba(4,13,26,0.6),inset_0_1px_0_rgba(255,255,255,0.35),0_3px_0_rgba(6,18,34,0.55)] transition-all duration-200">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl ${iconBg} ${iconBorder} flex items-center justify-center ${iconColor} shadow-inner group-hover:scale-105 transition-transform`}
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
        </div>
        <span className="text-xs sm:text-sm font-bold text-white group-hover:text-campus-gold transition-colors tracking-tight whitespace-nowrap">
          {name}
        </span>
        {tag && (
          <span className="hidden sm:inline-block px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[9px] sm:text-[10px] font-extrabold text-emerald-300 tracking-wide">
            {tag}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * HeroShowcaseBadges
 * Showcase 3D melayang interaktif dengan rotasi orbit 360 derajat (16s cycle).
 * - Pendekatan Single-Batch React State: hanya merender satu batch kategori aktif di 4 node.
 * - Berganti batch secara berkala setiap 16 detik (sinkron dengan 1 putaran orbit 360°).
 * - Counter-rotation 360° memastikan teks badge selalu tegak lurus dan terbaca.
 * - Pause on hover (isHovered) agar timer dan animasi orbit berhenti saat diarahkan kursor.
 * - Tilt 3D interaktif terhadap kursor mouse.
 */
export default function HeroShowcaseBadges() {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [batchIdx, setBatchIdx] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Siklus pergantian batch setiap 16 detik (pause saat hover)
  useEffect(() => {
    if (isHovered) return;

    const switchTimer = setTimeout(() => {
      setIsFading(true);

      const fadeTimer = setTimeout(() => {
        setBatchIdx((prev) => (prev + 1) % BATCHES.length);
        setIsFading(false);
      }, 400);

      return () => clearTimeout(fadeTimer);
    }, 15600);

    return () => clearTimeout(switchTimer);
  }, [batchIdx, isHovered]);

  // Interaksi 3D Tilt kursor mouse
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    if (prefersReducedMotion.matches || !finePointer.matches) return;

    const heroSection = el.closest('section') || el.parentElement;
    if (!heroSection) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isTracking = false;

    const handlePointerMove = (e) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      targetX = Math.max(-1, Math.min(1, normX));
      targetY = Math.max(-1, Math.min(1, normY));

      if (!isTracking) {
        isTracking = true;
        animate();
      }
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      setTilt({
        x: parseFloat((currentY * -12).toFixed(2)),
        y: parseFloat((currentX * 14).toFixed(2)),
      });

      if (
        Math.abs(targetX - currentX) < 0.005 &&
        Math.abs(targetY - currentY) < 0.005 &&
        targetX === 0 &&
        targetY === 0
      ) {
        isTracking = false;
        setTilt({ x: 0, y: 0 });
        return;
      }

      rafId = requestAnimationFrame(animate);
    };

    heroSection.addEventListener('pointermove', handlePointerMove, { passive: true });
    heroSection.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      heroSection.removeEventListener('pointermove', handlePointerMove);
      heroSection.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  const currentBatch = BATCHES[batchIdx];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="hero-orbit-wrapper relative w-full max-w-[340px] sm:max-w-[400px] md:max-w-[440px] h-[310px] sm:h-[340px] md:h-[360px] flex items-center justify-center select-none"
      style={{ perspective: '1000px' }}
      aria-label="Showcase kategori barang preloved Mahasiswa berotasi orbit 360 derajat"
    >
      {/* Container Berputar Sesuai Tilt Kursor */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.15s ease-out',
        }}
      >
        {/* Luminous Backdrop Disc: Lingkaran cahaya glowing bulat */}
        <div
          className="w-56 h-56 rounded-full bg-gradient-to-tr from-campus-gold/25 via-blue-500/20 to-teal-400/20 blur-2xl absolute pointer-events-none"
          aria-hidden="true"
        />

        {/* Cincin Orbit Konsentris Statis (Guide Ring) */}
        <div
          className="w-[210px] h-[210px] sm:w-[250px] sm:h-[250px] md:w-[270px] md:h-[270px] rounded-full border border-dashed border-white/15 absolute pointer-events-none shadow-[0_0_20px_rgba(255,255,255,0.03)]"
          aria-hidden="true"
        />
        <div
          className="w-36 h-36 rounded-full border border-white/10 absolute pointer-events-none"
          aria-hidden="true"
        />

        {/* Core Glowing Emblem LepasIn di Titik Pusat (Logo Toga Mahasiswa) */}
        <div
          className="w-12 h-12 rounded-full bg-navy-900/80 border border-campus-gold/40 backdrop-blur-md flex items-center justify-center text-campus-gold absolute pointer-events-none shadow-[0_0_24px_rgba(251,191,36,0.3)] z-0"
          aria-hidden="true"
        >
          <GraduationCap className="w-5 h-5 text-campus-gold stroke-[2]" />
        </div>

        {/* Track Orbit Berputar 360° (heroOrbit360 - 16s) */}
        <div className="hero-orbit-track w-[210px] h-[210px] sm:w-[250px] sm:h-[250px] md:w-[270px] md:h-[270px] rounded-full absolute pointer-events-none z-20">
          {/* Node 1: TOP */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="hero-orbit-node-counter">
              <div
                className={`transition-all duration-400 ease-in-out ${
                  isFading ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
                }`}
              >
                <ShowcaseBadgeLink {...currentBatch.top} />
              </div>
            </div>
          </div>

          {/* Node 2: RIGHT */}
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="hero-orbit-node-counter">
              <div
                className={`transition-all duration-400 ease-in-out ${
                  isFading ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
                }`}
              >
                <ShowcaseBadgeLink {...currentBatch.right} />
              </div>
            </div>
          </div>

          {/* Node 3: BOTTOM */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-auto">
            <div className="hero-orbit-node-counter">
              <div
                className={`transition-all duration-400 ease-in-out ${
                  isFading ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
                }`}
              >
                <ShowcaseBadgeLink {...currentBatch.bottom} />
              </div>
            </div>
          </div>

          {/* Node 4: LEFT */}
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="hero-orbit-node-counter">
              <div
                className={`transition-all duration-400 ease-in-out ${
                  isFading ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
                }`}
              >
                <ShowcaseBadgeLink {...currentBatch.left} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
