"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import ProductCard from "@/components/home/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gem } from "lucide-react";
import type { Paginated, Product } from "@/lib/types";

/** Collection landing page — editorial banner + filtered product grid. */
export default function CollectionView() {
  const params = useApp((s) => s.params);
  const navigate = useApp((s) => s.navigate);
  const slug = params.collection ?? "";

  const [data, setData] = useState<Paginated<Product> | null>(null);
  const [meta, setMeta] = useState<{ name: string; story: string | null; image: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const [colRes, prodRes] = await Promise.all([
          fetch("/api/collections"),
          fetch(`/api/products?collection=${encodeURIComponent(slug)}&pageSize=24`),
        ]);
        if (!prodRes.ok) throw new Error();
        const colData = await colRes.json();
        const collection = (colData.collections ?? []).find((c: { slug: string }) => c.slug === slug);
        if (cancelled) return;
        if (!collection) {
          setNotFound(true);
          return;
        }
        setMeta({ name: collection.name, story: collection.story, image: collection.image });
        setData(await prodRes.json());
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center px-4 pb-24 pt-40 text-center">
        <Gem className="mb-4 h-8 w-8 text-[#D4AF37]" />
        <h1 className="font-serif text-3xl">This collection is resting</h1>
        <p className="mt-3 text-sm text-muted-foreground">The collection you&apos;re looking for isn&apos;t on display right now.</p>
        <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Browse all jewelry</Button>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* banner */}
      <section className="relative flex min-h-[42vh] items-end overflow-hidden bg-[#0A0A0A] pt-28">
        {meta?.image && (
           
          <img src={meta.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/55 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <button onClick={() => navigate("shop")} className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#E6C87A] transition-colors hover:text-[#D4AF37]">
            <ArrowLeft className="h-3.5 w-3.5" /> All jewelry
          </button>
          {loading ? (
            <Skeleton className="h-12 w-72 bg-[#171717]" />
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Collection</p>
              <h1 className="mt-2 font-serif text-4xl text-[#FAF7F0] md:text-6xl">{meta?.name}</h1>
              {meta?.story && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#FAF7F0]/75 md:text-base">{meta.story}</p>}
            </>
          )}
        </div>
      </section>

      {/* products */}
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[4/5] w-full rounded-lg bg-muted" />
                <Skeleton className="mt-3 h-4 w-2/3 bg-muted" />
                <Skeleton className="mt-2 h-4 w-1/4 bg-muted" />
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-[#D4AF37]/25 bg-white py-16 text-center">
            <p className="font-serif text-xl">Pieces from this collection are being crafted</p>
            <p className="mt-2 text-sm text-muted-foreground">Check back soon — or message us on WhatsApp for a preview.</p>
          </div>
        )}
      </div>
    </div>
  );
}
