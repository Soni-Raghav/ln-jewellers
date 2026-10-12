"use client";

/**
 * RecentlyViewed — localStorage-backed "recently viewed" strip.
 * Snapshots are written by ProductView (slug, name, image, price, discount).
 * Renders nothing when there are fewer than 2 items.
 */
import { useState } from "react";
import { useApp } from "@/lib/store";
import { formatINR, netPrice } from "@/lib/format";
import { History } from "lucide-react";

export interface RecentSnapshot {
  slug: string;
  name: string;
  image: string;
  price: number;
  discountPercent: number;
}

const KEY = "ln-recent";

export function pushRecent(item: RecentSnapshot) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentSnapshot[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.slug !== item.slug);
    window.localStorage.setItem(KEY, JSON.stringify([item, ...filtered].slice(0, 8)));
  } catch {
    /* storage unavailable — silently skip */
  }
}

function readRecent(excludeSlug?: string): RecentSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentSnapshot[] = raw ? JSON.parse(raw) : [];
    return list.filter((x) => x.slug && x.name).filter((x) => x.slug !== excludeSlug).slice(0, 6);
  } catch {
    return [];
  }
}

export default function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const navigate = useApp((s) => s.navigate);
  const [items] = useState<RecentSnapshot[]>(() => readRecent(excludeSlug));

  if (items.length < 2) return null;

  return (
    <section className="mt-16" aria-label="Recently viewed">
      <div className="mb-5 flex items-center gap-3">
        <History className="h-4 w-4 text-[#A8862A]" strokeWidth={1.6} />
        <h2 className="font-serif text-2xl">Recently viewed</h2>
        <span className="h-px flex-1 bg-[#D4AF37]/25" aria-hidden />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-elegant md:grid md:grid-cols-6 md:overflow-visible">
        {items.map((it) => (
          <button
            key={it.slug}
            onClick={() => navigate("product", { slug: it.slug })}
            className="group w-32 shrink-0 text-left md:w-auto"
          >
            <span className="block overflow-hidden rounded-lg border border-[#D4AF37]/25 bg-white">
              <img
                src={it.image || "/images/brand/atelier.png"}
                alt={it.name}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <span className="mt-2 block truncate font-serif text-sm group-hover:text-[#A8862A]" title={it.name}>
              {it.name}
            </span>
            <span className="text-xs text-muted-foreground">{formatINR(netPrice(it.price, it.discountPercent))}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
