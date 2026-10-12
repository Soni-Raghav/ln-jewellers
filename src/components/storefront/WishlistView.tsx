"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import ProductCard from "@/components/home/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/types";

export default function WishlistView() {
  const wishlist = useApp((s) => s.wishlist);
  const navigate = useApp((s) => s.navigate);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (wishlist.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/products?ids=${wishlist.join(",")}&pageSize=50`);
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wishlist]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Saved for later</p>
        <h1 className="mt-2 font-serif text-4xl">Your Wishlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">{wishlist.length} {wishlist.length === 1 ? "piece" : "pieces"} kept safe</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/5] w-full rounded-lg bg-muted" />
              <Skeleton className="mt-3 h-4 w-2/3 bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mx-auto grid max-w-md place-items-center rounded-xl border border-dashed border-[#D4AF37]/40 bg-white py-16 text-center">
          <Heart className="mb-4 h-8 w-8 text-[#D4AF37]" strokeWidth={1.4} />
          <p className="font-serif text-xl">Nothing saved yet</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">Tap the heart on any piece to keep it here — wishlist items stay even after you close the browser.</p>
          <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Discover jewelry</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
