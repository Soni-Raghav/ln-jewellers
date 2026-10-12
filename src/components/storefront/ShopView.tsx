"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import ProductCard from "@/components/home/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { SearchX, SlidersHorizontal, RotateCcw, PackageSearch } from "lucide-react";
import type { Category, Collection, Paginated, Product } from "@/lib/types";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most loved" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "featured", label: "Curator's picks" },
];

const PRICE_BANDS = [
  { label: "Under ₹50,000", max: 50000 },
  { label: "₹50,000 – ₹1,00,000", max: 100000 },
  { label: "₹1,00,000 – ₹2,00,000", max: 200000 },
  { label: "Above ₹2,00,000", max: 10000000 },
];

export default function ShopView() {
  const shopQuery = useApp((s) => s.shopQuery);
  const setShopQuery = useApp((s) => s.setShopQuery);
  const resetShopQuery = useApp((s) => s.resetShopQuery);

  const [data, setData] = useState<Paginated<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? [])).catch(() => null);
    fetch("/api/collections").then((r) => r.json()).then((d) => setCollections(d.collections ?? [])).catch(() => null);
  }, []);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    const q = shopQuery;
    if (q.q) params.set("q", q.q);
    if (q.category) params.set("category", q.category);
    if (q.collection) params.set("collection", q.collection);
    if (q.sort) params.set("sort", q.sort);
    if (q.inStockOnly) params.set("inStock", "true");
    if (q.maxPrice && q.maxPrice < 10000000) params.set("maxPrice", String(q.maxPrice));
    params.set("page", String(p));
    params.set("pageSize", "12");
    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [shopQuery]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [load]);

  const activeFilters = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (shopQuery.q) chips.push({ label: `“${shopQuery.q}”`, clear: () => setShopQuery({ q: "" }) });
    const cat = categories.find((c) => c.slug === shopQuery.category);
    if (cat) chips.push({ label: cat.name, clear: () => setShopQuery({ category: "" }) });
    const col = collections.find((c) => c.slug === shopQuery.collection);
    if (col) chips.push({ label: col.name, clear: () => setShopQuery({ collection: "" }) });
    const band = PRICE_BANDS.find((b) => b.max === shopQuery.maxPrice);
    if (band && shopQuery.maxPrice < 10000000) chips.push({ label: band.label, clear: () => setShopQuery({ maxPrice: 500000 }) });
    if (shopQuery.inStockOnly) chips.push({ label: "In stock only", clear: () => setShopQuery({ inStockOnly: false }) });
    return chips;
  }, [shopQuery, categories, collections, setShopQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      {/* header */}
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">The Collection</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">
          {shopQuery.category
            ? categories.find((c) => c.slug === shopQuery.category)?.name ?? "Shop"
            : shopQuery.collection
              ? collections.find((c) => c.slug === shopQuery.collection)?.name ?? "Shop"
              : "All Jewelry"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          {shopQuery.category
            ? categories.find((c) => c.slug === shopQuery.category)?.tagline
            : "Every piece BIS-hallmarked, hand-finished and inspected under loupe before it travels to you."}
        </p>
      </header>

      {/* toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Input
            value={shopQuery.q}
            onChange={(e) => setShopQuery({ q: e.target.value })}
            placeholder="Search name, SKU, gemstone…"
            className="h-11 border-[#D4AF37]/40 bg-white pr-3 pl-10"
            aria-label="Search products"
          />
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Select value={shopQuery.sort} onValueChange={(v) => setShopQuery({ sort: v })}>
          <SelectTrigger className="h-11 w-[190px] border-[#D4AF37]/40 bg-white" aria-label="Sort products">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11 border-[#D4AF37]/40 lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)}>
          {filtersOpen ? "Hide filters" : "Filters"}
        </Button>
        <p className="ml-auto hidden text-sm text-muted-foreground sm:block">
          {loading ? "Curating…" : `${data?.total ?? 0} pieces`}
        </p>
      </div>

      <div className="flex gap-8">
        {/* filter rail */}
        <aside className={`${filtersOpen ? "block" : "hidden"} w-full shrink-0 space-y-7 lg:block lg:w-60`}>
          <FilterGroup title="Category">
            <div className="flex flex-col gap-1.5">
              <FilterChip active={!shopQuery.category} onClick={() => setShopQuery({ category: "" })} label="All jewelry" />
              {categories.map((c) => (
                <FilterChip key={c.id} active={shopQuery.category === c.slug} onClick={() => setShopQuery({ category: c.slug })} label={`${c.name} (${c.productCount ?? 0})`} />
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Collection">
            <div className="flex flex-col gap-1.5">
              <FilterChip active={!shopQuery.collection} onClick={() => setShopQuery({ collection: "" })} label="All collections" />
              {collections.map((c) => (
                <FilterChip key={c.id} active={shopQuery.collection === c.slug} onClick={() => setShopQuery({ collection: c.slug })} label={c.name} />
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Price">
            <div className="flex flex-col gap-1.5">
              <FilterChip active={shopQuery.maxPrice >= 10000000} onClick={() => setShopQuery({ maxPrice: 500000 })} label="Any price" />
              {PRICE_BANDS.map((b) => (
                <FilterChip key={b.label} active={shopQuery.maxPrice === b.max} onClick={() => setShopQuery({ maxPrice: b.max })} label={b.label} />
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Availability">
            <label className="flex cursor-pointer items-center justify-between text-sm">
              <span>In stock only</span>
              <Switch checked={shopQuery.inStockOnly} onCheckedChange={(v) => setShopQuery({ inStockOnly: v })} aria-label="In stock only" />
            </label>
          </FilterGroup>
          <Button variant="ghost" className="w-full text-[#A8862A] hover:bg-[#D4AF37]/10 hover:text-[#A8862A]" onClick={() => { resetShopQuery(); }}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset all filters
          </Button>
        </aside>

        {/* grid */}
        <div className="min-w-0 flex-1">
          {/* active filter chips */}
          {activeFilters.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <button key={f.label} onClick={f.clear} className="group inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-3 py-1 text-xs text-[#7a611f] transition-colors hover:bg-[#D4AF37] hover:text-black">
                  {f.label}
                  <span aria-hidden className="text-[10px] group-hover:text-black/70">✕</span>
                </button>
              ))}
              <button onClick={() => resetShopQuery()} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Clear all
              </button>
            </div>
          )}

          {error && (
            <div className="grid place-items-center rounded-xl border border-destructive/30 bg-destructive/5 py-20 text-center">
              <SearchX className="mb-3 h-8 w-8 text-destructive" />
              <p className="font-serif text-lg">The atelier didn&apos;t respond</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Something went wrong fetching pieces. Please try again.</p>
              <Button className="mt-4 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => load(page)}>Retry</Button>
            </div>
          )}

          {loading && !error && (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[4/5] w-full rounded-lg bg-muted" />
                  <Skeleton className="mt-3 h-4 w-1/3 bg-muted" />
                  <Skeleton className="mt-2 h-5 w-2/3 bg-muted" />
                  <Skeleton className="mt-2 h-4 w-1/4 bg-muted" />
                </div>
              ))}
            </div>
          )}

          {!loading && !error && data && data.items.length === 0 && (
            <div className="grid place-items-center rounded-xl border border-[#D4AF37]/25 bg-white py-20 text-center">
              <PackageSearch className="mb-3 h-8 w-8 text-[#D4AF37]" />
              <p className="font-serif text-xl">No pieces match those filters</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try widening the price band or clearing a filter — our karigars may be finishing something soon.</p>
              <Button className="mt-4 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => resetShopQuery()}>Reset filters</Button>
            </div>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {data.totalPages > 1 && (
                <div className="mt-12">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) { setPage(page - 1); load(page - 1); } }} className={page <= 1 ? "pointer-events-none opacity-40" : ""} />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, data.totalPages) }).map((_, i) => {
                        const p = Math.max(1, Math.min(data.totalPages - 4, page - 2)) + i;
                        if (p > data.totalPages) return null;
                        return (
                          <PaginationItem key={p}>
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); setPage(p); load(p); }}
                              className={`grid h-9 w-9 place-items-center rounded-md text-sm transition-colors ${p === page ? "bg-[#0A0A0A] text-[#E6C87A]" : "border border-border hover:bg-[#D4AF37]/10"}`}
                            >
                              {p}
                            </a>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < data.totalPages) { setPage(page + 1); load(page + 1); } }} className={page >= data.totalPages ? "pointer-events-none opacity-40" : ""} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#A8862A]">{title}</h3>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-[#0A0A0A] text-[#E6C87A]" : "text-muted-foreground hover:bg-[#D4AF37]/10 hover:text-foreground"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
