'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import Button from '@/components/ui/Button';

export default function WishlistManager({ initialProducts = [], user }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);

  const handleWishlistToggle = (productId, nextState) => {
    if (!nextState) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
            <span>Barang Favorit Saya</span>
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Daftar barang kost yang disimpan untuk dibeli nanti.
          </p>
        </div>
        <span className="text-xs text-ink-secondary font-semibold tabular-nums">
          {products.length} barang disimpan
        </span>
      </div>

      {products.length === 0 ? (
        <div className="surface-3d rounded-3xl p-10 text-center max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl icon-plinth-3d text-danger-text flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-ink mb-2">Belum Ada Barang Favorit</h2>
          <p className="text-sm text-ink-muted mb-6 leading-relaxed max-w-sm mx-auto">
            Tekan ikon hati pada kartu produk untuk menyimpan barang incaranmu.
          </p>
          <Button href="/products" variant="primary" size="lg" className="rounded-xl">
            Jelajah Katalog
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isWishlisted={true}
              user={user}
              onWishlistToggle={handleWishlistToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
