"use client";

/**
 * HomeView — the full homepage for LN Jewellers (sections a–m).
 * Footer is provided by the root shell — deliberately NOT rendered here.
 *
 * Data: 8 endpoints fetched once on mount via Promise.all with individual
 * try/catch; each section degrades gracefully (skeleton -> error note ->
 * empty note). Settings are pushed into the zustand store if not already set.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  Diamond,
  Gem,
  Hammer,
  Instagram,
  Leaf,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import type {
  Category,
  Collection,
  Paginated,
  Product,
  StoreSettingsDTO,
} from "@/lib/types";
import { useApp } from "@/lib/store";
import { waGeneralInquiry } from "@/lib/format";
import { cn } from "@/lib/utils";
import GoogleG from "@/components/layout/GoogleG";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { JewelHero } from "@/components/three/JewelHero";
import { ProductCard } from "./ProductCard";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/* ------------------------------------------------------------------ */
/* Data plumbing                                                       */
/* ------------------------------------------------------------------ */

type FailKey =
  | "featured"
  | "best"
  | "trending"
  | "handmade"
  | "newest"
  | "categories"
  | "collections"
  | "settings";

interface HomeData {
  featured: Product[];
  best: Product[];
  trending: Product[];
  handmade: Product[];
  newest: Product[];
  categories: Category[];
  collections: Collection[];
  settings: StoreSettingsDTO | null;
}

const INITIAL_DATA: HomeData = {
  featured: [],
  best: [],
  trending: [],
  handmade: [],
  newest: [],
  categories: [],
  collections: [],
  settings: null,
};

const EMPTY_PAGE: Paginated<Product> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 0,
  totalPages: 0,
};

async function fetchJson<T>(
  url: string,
  pick: (j: Record<string, unknown>) => T,
  fallback: T,
  key: FailKey,
  onFail: (k: FailKey) => void
): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    return pick(json);
  } catch {
    onFail(key);
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Small local helpers                                                 */
/* ------------------------------------------------------------------ */

/** Image with graceful gradient fallback (assets may not exist yet). */
function SafeImg({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "grid place-items-center bg-gradient-to-br from-[#F1E8D2] via-[#E6C87A]/50 to-[#D4AF37]/40",
          className
        )}
      >
        <span className="font-serif text-4xl text-[#8A6D1F]/60">A</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-[#D4AF37]/15 bg-card">
          <Skeleton className="aspect-[4/5] w-full rounded-none bg-[#EFE6D0]" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-16 bg-[#EFE6D0]" />
            <Skeleton className="h-4 w-3/4 bg-[#EFE6D0]" />
            <Skeleton className="h-4 w-24 bg-[#EFE6D0]" />
          </div>
        </div>
      ))}
    </>
  );
}

function ErrorNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-4 border border-[#D4AF37]/30 bg-[#FAF7F0] px-6 py-12 text-center">
      <p className="font-serif text-lg text-foreground">
        Something slipped behind the velvet — these pieces could not be fetched.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="border-[#D4AF37]/60 text-[#8A6D1F] hover:bg-[#D4AF37]/10 hover:text-[#8A6D1F]"
      >
        <RotateCcw className="size-3.5" /> Try again
      </Button>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="col-span-full border border-dashed border-[#D4AF37]/30 bg-[#FAF7F0]/60 px-6 py-12 text-center">
      <p className="font-serif text-base text-foreground/60">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero motion variants                                                */
/* ------------------------------------------------------------------ */

const heroStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const heroItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  },
};

const MARQUEE_ITEMS = [
  "BIS Hallmarked",
  "Handcrafted",
  "Free insured shipping above ₹50,000",
  "Made-to-order couture",
];

const CRAFT_PROPS = [
  {
    icon: Hammer,
    title: "Hand-hammered & chased",
    copy: "Texture raised by hand at the bench, never cast.",
  },
  {
    icon: Gem,
    title: "Hand-set stones",
    copy: "Every bezel closed stone-by-stone under a loupe.",
  },
  {
    icon: Sparkles,
    title: "One of one",
    copy: "No two artisan pieces are ever repeated.",
  },
  {
    icon: Leaf,
    title: "Responsible gold",
    copy: "Sourced exclusively from RJC-certified refiners.",
  },
];

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "BIS Hallmarked" },
  { icon: Truck, label: "Insured Shipping" },
  { icon: RotateCcw, label: "30-Day Returns" },
];

/* ------------------------------------------------------------------ */
/* HomeView                                                            */
/* ------------------------------------------------------------------ */

export default function HomeView() {
  const navigate = useApp((s) => s.navigate);
  const setShopQuery = useApp((s) => s.setShopQuery);
  const resetShopQuery = useApp((s) => s.resetShopQuery);
  const setSettings = useApp((s) => s.setSettings);

  const [data, setData] = useState<HomeData>(INITIAL_DATA);
  const [failed, setFailed] = useState<Partial<Record<FailKey, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    setFailed({});
    const fail = (k: FailKey) => setFailed((f) => ({ ...f, [k]: true }));

    const asPage = (j: Record<string, unknown>) => j as unknown as Paginated<Product>;
    const asCategories = (j: Record<string, unknown>) =>
      (Array.isArray(j.categories) ? j.categories : []) as Category[];
    const asCollections = (j: Record<string, unknown>) =>
      (Array.isArray(j.collections) ? j.collections : []) as Collection[];
    const asSettings = (j: Record<string, unknown>) =>
      (j.settings ?? null) as StoreSettingsDTO | null;

    const [featuredPg, bestPg, trendingPg, handmadePg, newestPg, categories, collections, settings] =
      await Promise.all([
        fetchJson("/api/products?featured=true&pageSize=8", asPage, EMPTY_PAGE, "featured", fail),
        fetchJson("/api/products?bestSeller=true&pageSize=4", asPage, EMPTY_PAGE, "best", fail),
        fetchJson("/api/products?trending=true&pageSize=4", asPage, EMPTY_PAGE, "trending", fail),
        fetchJson("/api/products?handmade=true&pageSize=4", asPage, EMPTY_PAGE, "handmade", fail),
        fetchJson("/api/products?sort=newest&pageSize=8", asPage, EMPTY_PAGE, "newest", fail),
        fetchJson("/api/categories", asCategories, [], "categories", fail),
        fetchJson("/api/collections", asCollections, [], "collections", fail),
        fetchJson("/api/settings", asSettings, null, "settings", fail),
      ]);

    setData({
      featured: featuredPg.items ?? [],
      best: bestPg.items ?? [],
      trending: trendingPg.items ?? [],
      handmade: handmadePg.items ?? [],
      newest: newestPg.items ?? [],
      categories,
      collections,
      settings,
    });

    // cache settings globally if the shell hasn't already
    if (settings && !useApp.getState().settings) {
      setSettings(settings);
    }
    setLoading(false);
  }, [setSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------------- derived data (with graceful fallbacks) ---------------- */

  const settings = data.settings;

  /* ---------------- settings-driven hero + connectivity (round 14) ---------------- */
  const heroEyebrow = settings?.heroEyebrow?.trim() || "Handcrafted in Jaipur · Since 2016";
  const heroTitle = settings?.heroTitle?.trim() || "Heirlooms for the";
  const heroHighlight = settings?.heroHighlight?.trim() || "Modern Muse";
  const heroSubtitle =
    settings?.heroSubtitle?.trim() ||
    "22K and 18K gold, raised by master karigars in our Jaipur atelier — hallmarked, insured, and made to be inherited.";
  const heroCtaLabel = settings?.heroCtaLabel?.trim() || "Explore the Collection";
  const googleRating = settings?.googleRating?.trim() || "";
  const googleRatingNum = Math.min(5, Math.max(0, Math.round(parseFloat(googleRating) || 0)));
  const featured = data.featured;
  const bestList = data.best.length ? data.best : featured.slice(0, 4);
  const trendingList = data.trending.length ? data.trending : featured.slice(0, 4);
  const handmadeList = data.handmade.length
    ? data.handmade
    : featured.filter((p) => p.handmade).slice(0, 2);
  const newList = data.newest.length ? data.newest.slice(0, 4) : featured.slice(0, 4);
  const collections = data.collections.slice(0, 4);
  const categories = data.categories.slice(0, 4);
  const testimonials = (settings?.testimonials ?? []).slice(0, 4);
  const gallery = (settings?.instagramGallery ?? []).slice(0, 8);
  const aboutExcerpt =
    settings?.aboutStory?.split("\n")[0] ??
    "LN Jewellers began in 2016 at a two-bench workshop in Johari Bazaar, Jaipur — with one master karigar, a sheet of 22K gold and a stubborn belief that real luxury is made slowly.";
  const waHref = settings ? waGeneralInquiry(settings) : "https://wa.me/";

  const bestUnavailable = (failed.best || failed.featured) && bestList.length === 0;
  const trendingUnavailable = (failed.trending || failed.featured) && trendingList.length === 0;
  const newUnavailable = (failed.newest || failed.featured) && newList.length === 0;
  const handmadeUnavailable = (failed.handmade || failed.featured) && handmadeList.length === 0;

  const goShopCategory = (slug: string) => {
    setShopQuery({ category: slug, collection: "", q: "" });
    navigate("shop");
  };

  const viewAllNewArrivals = () => {
    resetShopQuery();
    setShopQuery({ sort: "newest" });
    navigate("shop");
  };

  /* ---------------- newsletter ---------------- */

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const subscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSubscribing(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(json?.error || "Subscription failed. Please try again.");
      toast.success(json?.message || "Welcome to the LN Jewellers circle.");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  /* ---------------- marquee ---------------- */

  const marqueeRow = (key: string) => (
    <div key={key} className="flex shrink-0 items-center">
      {MARQUEE_ITEMS.map((text, i) => (
        <span
          key={i}
          className="flex items-center text-xs uppercase tracking-[0.35em] text-[#E6C87A]"
        >
          <span className="px-8">{text}</span>
          <Diamond className="size-2 fill-[#D4AF37] text-[#D4AF37]" />
        </span>
      ))}
    </div>
  );

  /* ================================================================== */
  /* Render                                                              */
  /* ================================================================== */

  return (
    <div className="bg-[#FAF7F0]">
      {/* ============ a) HERO ============ */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#0A0A0A]">
        {/* soft radial gold glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 68% 40%, rgba(212,175,55,0.20) 0%, rgba(212,175,55,0.05) 45%, transparent 70%)",
          }}
        />

        {/* 3D canvas — behind, slides to the right half on large screens */}
        <motion.div
          className="pointer-events-none absolute inset-0 lg:left-[38%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.4 }}
        >
          <JewelHero />
        </motion.div>

        {/* legibility veil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/70 to-transparent lg:via-[#0A0A0A]/30"
        />

        {/* copy */}
        <motion.div
          variants={heroStagger}
          initial={reduced ? false : "hidden"}
          animate="show"
          className="pointer-events-none relative z-10 mx-auto w-full max-w-7xl px-4 py-28 md:px-8 lg:py-24"
        >
          <div className="max-w-2xl">
            <motion.p
              variants={heroItem}
              className="text-xs uppercase tracking-[0.3em] text-[#D4AF37]"
            >
              {heroEyebrow}
            </motion.p>

            <motion.h1
              variants={heroItem}
              className="mt-6 font-serif text-5xl leading-[1.05] text-[#FAF7F0] md:text-6xl lg:text-7xl"
            >
              {heroTitle}
              {heroHighlight ? (
                <>
                  <br />
                  <em className="italic text-[#D4AF37]">{heroHighlight}</em>
                </>
              ) : null}
            </motion.h1>

            <motion.p
              variants={heroItem}
              className="mt-6 max-w-md text-base leading-relaxed text-white/70"
            >
              {heroSubtitle}
            </motion.p>

            <motion.div
              variants={heroItem}
              className="pointer-events-auto mt-10 flex flex-wrap items-center gap-4"
            >
              <Button
                onClick={() => navigate("shop")}
                className="btn-shimmer h-12 bg-[#D4AF37] px-8 text-sm font-medium text-black hover:bg-[#E6C87A]"
              >
                {heroCtaLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("about")}
                className="h-12 border-[#D4AF37]/60 bg-transparent px-8 text-sm text-[#FAF7F0] hover:bg-[#D4AF37]/10 hover:text-[#E6C87A]"
              >
                Our Story
              </Button>
            </motion.div>

            <motion.div
              variants={heroItem}
              className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3"
            >
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60"
                >
                  <Icon className="size-4 text-[#D4AF37]" />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          aria-hidden
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: reduced ? 0.4 : 1 }}
          transition={{ delay: 1.6, duration: 1 }}
        >
          <motion.div
            animate={reduced ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
              Scroll
            </span>
            <span className="h-8 w-px bg-gradient-to-b from-[#D4AF37]/70 to-transparent" />
          </motion.div>
        </motion.div>
      </section>

      {/* ============ b) MARQUEE ============ */}
      <section
        aria-hidden
        className="overflow-hidden border-y border-[#D4AF37]/25 bg-[#171717] py-4"
      >
        {reduced ? (
          <div className="flex items-center justify-center">{marqueeRow("static")}</div>
        ) : (
          <motion.div
            className="flex w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 32, ease: "linear", repeat: Infinity }}
          >
            {marqueeRow("a")}
            {marqueeRow("b")}
          </motion.div>
        )}
      </section>

      {/* ============ c) FEATURED COLLECTIONS (toggle: showCollectionsSection) ============ */}
      {settings?.showCollectionsSection !== false && (
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHeading
            eyebrow="Curated For You"
            title={
              <>
                Featured{" "}
                <em className="italic text-[#D4AF37]">Collections</em>
              </>
            }
            subtitle="Four worlds of gold, each born from a different chapter of the Jaipur atelier."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="min-h-[300px] w-full rounded-none bg-[#EFE6D0] lg:min-h-[340px]" />
              ))
            ) : collections.length === 0 && failed.collections ? (
              <ErrorNote onRetry={() => void load()} />
            ) : collections.length === 0 ? (
              <EmptyNote text="Collections are being curated — check back soon." />
            ) : (
              collections.map((col, i) => (
                <Reveal key={col.id} delay={i * 0.08}>
                  <button
                    type="button"
                    onClick={() => navigate("collection", { collection: col.slug })}
                    className="group relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
                  >
                    <div className="relative min-h-[300px] w-full lg:min-h-[340px]">
                      <SafeImg
                        src={col.image}
                        alt={col.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                      <div className="relative flex min-h-[300px] flex-col justify-end p-6 md:p-8 lg:min-h-[340px]">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-[#E6C87A]">
                          {col.productCount ?? 0} {col.productCount === 1 ? "piece" : "pieces"}
                        </span>
                        <h3 className="mt-2 font-serif text-2xl text-[#FAF7F0] md:text-3xl">
                          {col.name}
                        </h3>
                        {col.story ? (
                          <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-white/70">
                            {col.story}
                          </p>
                        ) : null}
                        <span className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#E6C87A]">
                          Discover
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </button>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>
      )}

      {/* ============ d) SHOP BY CATEGORY (toggle: showCategoriesSection) ============ */}
      {settings?.showCategoriesSection !== false && (
      <section className="border-t border-[#D4AF37]/20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHeading
            eyebrow="The Jewellery Box"
            title={
              <>
                Shop by <em className="italic text-[#D4AF37]">Category</em>
              </>
            }
          />

          <div className="mt-14 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-none bg-[#EFE6D0]" />
              ))
            ) : categories.length === 0 && failed.categories ? (
              <ErrorNote onRetry={() => void load()} />
            ) : categories.length === 0 ? (
              <EmptyNote text="Categories are being arranged — check back soon." />
            ) : (
              categories.map((cat, i) => (
                <Reveal key={cat.id} delay={i * 0.08}>
                  <button
                    type="button"
                    onClick={() => goShopCategory(cat.slug)}
                    aria-label={`Shop ${cat.name}`}
                    className="group relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden bg-[#F1E8D2]">
                      <SafeImg
                        src={cat.image}
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 md:p-5">
                      <div>
                        <h3 className="font-serif text-lg text-[#FAF7F0] md:text-xl">
                          {cat.name}
                        </h3>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/60">
                          {cat.productCount ?? 0} pieces
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-[#E6C87A] transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>
      )}

      {/* ============ e) NEW ARRIVALS (toggle: showNewArrivals) ============ */}
      {settings?.showNewArrivals !== false && (
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHeading
            eyebrow="Fresh From The Bench"
            title={
              <>
                New <em className="italic text-[#D4AF37]">Arrivals</em>
              </>
            }
            subtitle="The latest pieces to leave the polishing cloth — often one batch, rarely repeated."
          />

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <ProductGridSkeleton count={4} />
            ) : newUnavailable ? (
              <ErrorNote onRetry={() => void load()} />
            ) : newList.length === 0 ? (
              <EmptyNote text="New pieces are on the bench — check back soon." />
            ) : (
              newList.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.07} className="h-full">
                  <ProductCard product={p} />
                </Reveal>
              ))
            )}
          </div>

          <Reveal className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={viewAllNewArrivals}
              className="group inline-flex items-center gap-2 border-b border-[#D4AF37]/40 pb-1 text-xs uppercase tracking-[0.3em] text-[#8A6D1F] transition hover:text-[#D4AF37]"
            >
              View all new arrivals
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </Reveal>
        </div>
      </section>
      )}

      {/* ============ f) BEST SELLERS (toggle: showBestSellers) ============ */}
      {settings?.showBestSellers !== false && (
      <section className="border-y border-[#D4AF37]/20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHeading
            eyebrow="Most Coveted"
            title={
              <>
                Best <em className="italic text-[#D4AF37]">Sellers</em>
              </>
            }
            subtitle="The pieces our muses return for — drag or swipe to browse."
          />

          <div className="mt-14">
            {loading ? (
              <div className="flex gap-5 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[264px] shrink-0 sm:w-[300px]">
                    <div className="border border-[#D4AF37]/15">
                      <Skeleton className="aspect-[4/5] w-full rounded-none bg-[#EFE6D0]" />
                      <div className="space-y-2 p-4">
                        <Skeleton className="h-3 w-16 bg-[#EFE6D0]" />
                        <Skeleton className="h-4 w-3/4 bg-[#EFE6D0]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : bestUnavailable ? (
              <ErrorNote onRetry={() => void load()} />
            ) : bestList.length === 0 ? (
              <EmptyNote text="The favourites are being re-counted — check back soon." />
            ) : (
              <div
                className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4"
                style={{ scrollbarWidth: "thin" }}
              >
                {bestList.map((p) => (
                  <div
                    key={p.id}
                    className="w-[264px] shrink-0 snap-start sm:w-[300px]"
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ============ g) TRENDING NOW (toggle: showTrending) ============ */}
      {settings?.showTrending !== false && (
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHeading
            eyebrow="Worn Everywhere This Season"
            title={
              <>
                Trending <em className="italic text-[#D4AF37]">Now</em>
              </>
            }
          />

          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <ProductGridSkeleton count={4} />
            ) : trendingUnavailable ? (
              <ErrorNote onRetry={() => void load()} />
            ) : trendingList.length === 0 ? (
              <EmptyNote text="The trend report is being rewritten — check back soon." />
            ) : (
              trendingList.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.08} className="h-full">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-2xl text-[#D4AF37]/80 md:text-3xl">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-[#D4AF37]/30" />
                  </div>
                  <div className="mt-4 h-full">
                    <ProductCard product={p} />
                  </div>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>
      )}

      {/* ============ h) HANDMADE SHOWCASE — ARTISAN SOUL (toggle: showHandmade) ============ */}
      {settings?.showHandmade !== false && (
      <section className="border-y border-[#D4AF37]/20 bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-8 lg:grid-cols-2 lg:gap-16">
          {/* left: framed artisan image */}
          <Reveal>
            <div className="relative mr-4 md:mr-6">
              <div
                aria-hidden
                className="absolute inset-0 translate-x-4 translate-y-4 border border-[#D4AF37]/60 md:translate-x-6 md:translate-y-6"
              />
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F1E8D2]">
                <SafeImg
                  src="/images/products/pendant-handmade.png"
                  alt="Handmade gold pendant from the Artisan Soul collection"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="absolute -bottom-5 left-6 bg-[#D4AF37] px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-black">
                Artisan Soul
              </span>
            </div>
          </Reveal>

          {/* right: story + props + pieces */}
          <div>
            <SectionHeading
              align="left"
              eyebrow="Artisan Soul"
              title={
                <>
                  Made by hand,
                  <br />
                  for a lifetime of <em className="italic text-[#D4AF37]">hands</em>
                </>
              }
              subtitle="Our one-of-one collection is hammered, chased and textured entirely at the bench. When a piece sells, its story ends — and a new one begins."
            />

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {CRAFT_PROPS.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-[#D4AF37]/40">
                    <Icon className="size-4 text-[#D4AF37]" />
                  </span>
                  <div>
                    <p className="font-serif text-base text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {loading ? (
                <ProductGridSkeleton count={2} />
              ) : handmadeUnavailable ? (
                <ErrorNote onRetry={() => void load()} />
              ) : (
                handmadeList.slice(0, 2).map((p) => <ProductCard key={p.id} product={p} />)
              )}
            </div>

            <Reveal className="mt-10">
              <Button
                onClick={() => navigate("collection", { collection: "artisan-soul" })}
                variant="outline"
                className="h-12 border-[#D4AF37]/60 px-8 text-sm text-[#8A6D1F] hover:bg-[#D4AF37]/10 hover:text-[#8A6D1F]"
              >
                Enter the Artisan Soul collection
                <ArrowRight className="size-4" />
              </Button>
            </Reveal>
          </div>
        </div>
      </section>
      )}

      {/* ============ i) BRAND STORY TEASER ============ */}
      <section className="bg-[#171717] py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              dark
              eyebrow="The LN Jewellers Story"
              title={
                <blockquote className="font-serif text-3xl leading-snug md:text-5xl">
                  “Real luxury is{" "}
                  <em className="italic text-[#D4AF37]">made slowly</em>.”
                </blockquote>
              }
            />
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">
                {aboutExcerpt}
              </p>
              <Button
                onClick={() => navigate("about")}
                className="mt-8 h-12 bg-[#D4AF37] px-8 text-sm font-medium text-black hover:bg-[#E6C87A]"
              >
                Our Story
                <ArrowRight className="size-4" />
              </Button>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 -translate-x-4 translate-y-4 border border-[#D4AF37]/40"
              />
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#221E14]">
                <SafeImg
                  src="/images/brand/artisan.png"
                  alt="LN Jewellers master karigar at the bench in Jaipur"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ j0) GOOGLE REVIEWS TRUST BADGE (settings-driven) ============ */}
      {googleRating && (
        <section aria-label="Google reviews" className="border-t border-[#D4AF37]/20 bg-white py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center md:px-8">
            <Reveal>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
                <GoogleG className="h-9 w-9 shrink-0" />
                <span className="font-serif text-4xl text-[#0A0A0A] md:text-5xl">{googleRating}</span>
                <div className="flex flex-col items-center gap-1 sm:items-start">
                  <div className="flex gap-0.5" aria-label={`${googleRating} out of 5 stars on Google`}>
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star
                        key={s}
                        className={cn(
                          "size-4",
                          s < googleRatingNum ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#D4AF37]/30"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {(settings?.googleReviewCount ?? 0) > 0
                      ? `${settings?.googleReviewCount} verified Google reviews`
                      : "Google reviews"}
                  </span>
                </div>
              </div>
              {settings?.googleReviewUrl ? (
                <a
                  href={settings.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-11 items-center gap-2.5 border border-[#D4AF37]/60 px-6 text-xs uppercase tracking-[0.25em] text-[#8A6D1F] transition hover:bg-[#D4AF37]/10"
                >
                  <GoogleG className="h-3.5 w-3.5" />
                  Review us on Google
                </a>
              ) : null}
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ j) TESTIMONIALS (toggle: showTestimonials) ============ */}
      {settings?.showTestimonials !== false && testimonials.length > 0 && (
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <SectionHeading
              eyebrow="Testimonials"
              title={
                <>
                  Loved, worn,{" "}
                  <em className="italic text-[#D4AF37]">inherited</em>
                </>
              }
              subtitle="Words from the women who wear LN Jewellers — in their own handwriting, almost."
            />

            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {testimonials.map((t, i) => (
                <Reveal key={`${t.name}-${i}`} delay={i * 0.08} className="h-full">
                  <figure className="flex h-full flex-col border border-[#D4AF37]/25 bg-white p-6 md:p-7">
                    <div className="flex gap-1" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={cn(
                            "size-3.5",
                            s < t.rating
                              ? "fill-[#D4AF37] text-[#D4AF37]"
                              : "text-[#D4AF37]/30"
                          )}
                        />
                      ))}
                    </div>
                    <blockquote className="mt-4 flex-1 font-serif text-base leading-relaxed text-foreground md:text-lg">
                      “{t.text}”
                    </blockquote>
                    <figcaption className="mt-5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {t.name} — {t.location}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ k) INSTAGRAM GALLERY (toggle: instagramFeedEnabled) ============ */}
      {settings?.instagramFeedEnabled !== false && gallery.length > 0 && (
        <section className="border-t border-[#D4AF37]/20 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <SectionHeading
              eyebrow="Instagram"
              title={
                <>
                  Follow{" "}
                  <a
                    href={settings?.instagramUrl || "https://instagram.com"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#D4AF37] underline-offset-4 hover:underline"
                  >
                    @lnjewellers
                  </a>
                </>
              }
              subtitle="Bench-side moments, unboxings and the occasional karigar chai break."
            />

            <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {gallery.map((src, i) => (
                <Reveal key={`${src}-${i}`} delay={i * 0.05}>
                  <a
                    href={settings?.instagramUrl || "https://instagram.com"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`LN Jewellers on Instagram, photo ${i + 1}`}
                    className="group relative block aspect-square overflow-hidden bg-[#F1E8D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
                  >
                    <SafeImg
                      src={src}
                      alt={`LN Jewellers Instagram post ${i + 1}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <Instagram className="size-6 text-white" />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ l) WHATSAPP CTA BAND ============ */}
      <section className="border-y border-[#D4AF37]/25 bg-[#171717] py-16 md:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center md:px-8">
          <Reveal>
            <span className="grid size-14 place-items-center rounded-full border border-[#D4AF37]/40">
              <MessageCircle className="size-6 text-[#D4AF37]" />
            </span>
            <h2 className="mt-6 font-serif text-3xl text-[#FAF7F0] md:text-4xl">
              Shop with a <em className="italic text-[#D4AF37]">human</em>, not a cart.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/60">
              Our Jaipur concierge answers within minutes — availability, sizing,
              customisation, gifting. No bots, no pressure.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center gap-2 bg-[#D4AF37] px-8 text-sm font-medium text-black transition hover:bg-[#E6C87A]"
            >
              <MessageCircle className="size-4" />
              Chat on WhatsApp
            </a>
          </Reveal>
        </div>
      </section>

      {/* ============ m) NEWSLETTER (toggle: showNewsletter) ============ */}
      {settings?.showNewsletter !== false && (
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-xl px-4 text-center md:px-8">
          <SectionHeading
            eyebrow="The LN Jewellers Circle"
            title={
              <>
                First access,{" "}
                <em className="italic text-[#D4AF37]">always</em>
              </>
            }
            subtitle="New collections, private previews and gold-care letters — one email a month, never more."
          />

          <Reveal delay={0.1}>
            <form onSubmit={subscribe} noValidate className="mt-10">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  aria-invalid={!!emailError}
                  aria-label="Email address"
                  className="h-12 flex-1 border-[#D4AF37]/40 bg-white text-base md:text-sm"
                />
                <Button
                  type="submit"
                  disabled={subscribing}
                  className="h-12 bg-[#D4AF37] px-8 text-sm font-medium text-black hover:bg-[#E6C87A]"
                >
                  {subscribing ? "Joining…" : "Join the Circle"}
                </Button>
              </div>
              {emailError ? (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {emailError}
                </p>
              ) : null}
            </form>
          </Reveal>
        </div>
      </section>
      )}
      {/* Footer intentionally omitted — rendered by the root shell. */}
    </div>
  );
}
