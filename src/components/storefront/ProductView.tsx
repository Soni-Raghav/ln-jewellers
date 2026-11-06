"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import ProductCard from "@/components/home/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Heart, Share2, Minus, Plus, ShoppingBag, MessageCircle, Truck, RefreshCcw,
  ShieldCheck, Star, Sparkles, Hammer, ChevronLeft, ChevronDown, ZoomIn, PenLine, BellRing,
  Images, Rotate3d, Move3d, Camera, RotateCw, ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, netPrice, stockLabel, waProductInquiry, formatDate, ENGRAVING_FONTS, ENGRAVING_FONT_ORDER, engravingFeeFor } from "@/lib/format";
import type { Product, ProductQuestionDTO, EngravingFont, Review } from "@/lib/types";
import RecentlyViewed, { pushRecent } from "@/components/storefront/RecentlyViewed";
import SizeGuideDialog from "@/components/storefront/SizeGuideDialog";
import NotifyMeDialog from "@/components/storefront/NotifyMeDialog";
import ProductStage from "@/components/three/ProductStage";

export default function ProductView() {
  const params = useApp((s) => s.params);
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);
  const addToCart = useApp((s) => s.addToCart);
  const wishlist = useApp((s) => s.wishlist);
  const toggleWishlist = useApp((s) => s.toggleWishlist);

  const slug = params.slug ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [engravingText, setEngravingText] = useState("");
  const [engravingFont, setEngravingFont] = useState<EngravingFont>("SERIF");
  const [engravingOpen, setEngravingOpen] = useState(false);
  const [stickyBuy, setStickyBuy] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [mode, setMode] = useState<"photos" | "3d">("photos");
  const [spinMode, setSpinMode] = useState(false);
  const stageCaptureRef = useRef<(() => string) | null>(null);
  const buyBoxRef = useRef<HTMLDivElement | null>(null);

  // Magnifier: move the transform-origin with the cursor for a true loupe feel
  const onGalleryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      setImgIdx(0);
      setQty(1);
      setMode("photos");
      setSpinMode(false);
      setEngravingText("");
      setEngravingFont("SERIF");
      setEngravingOpen(false);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setProduct(data.product);
        setRelated(data.related ?? []);
        const firstAvailable = data.product?.variants?.find((v: { stock: number }) => v.stock > 0) ?? data.product?.variants?.[0];
        setVariantId(firstAvailable?.id ?? null);
        if (data.product) {
          pushRecent({
            slug: data.product.slug,
            name: data.product.name,
            image: data.product.images?.[0] ?? "",
            price: data.product.price,
            discountPercent: data.product.discountPercent,
          });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const variant = useMemo(() => product?.variants?.find((v) => v.id === variantId) ?? null, [product, variantId]);
  const gross = product ? product.price + (variant?.priceDelta ?? 0) : 0;
  const display = netPrice(gross, product?.discountPercent ?? 0);
  const stockInfo = product ? stockLabel(variant ? variant.stock : product.stock, variant ? true : product.trackInventory, product.lowStockThreshold) : null;
  const maxStock = variant ? variant.stock : product?.stock ?? 0;
  const outOfStock = product ? (variant ? true : product.trackInventory) && maxStock <= 0 : false;
  const wished = product ? wishlist.includes(product.id) : false;

  // Sticky mobile buy bar appears once the main buy box has scrolled past
  useEffect(() => {
    if (!product) return;
    const onScroll = () => {
      const el = buyBoxRef.current;
      if (!el) return;
      setStickyBuy(el.getBoundingClientRect().bottom < 0);
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [product]);

  const handleAdd = (thenCheckout = false) => {
    if (!product || outOfStock) return;
    const engraving = engravingText.trim();
    addToCart({
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      image: product.images?.[0] ?? "",
      unitPrice: gross,
      discountPercent: product.discountPercent,
      quantity: qty,
      variantName: variant?.name ?? null,
      maxStock: Math.max(maxStock, 1),
      engravingText: engraving || null,
      engravingFont: engraving ? engravingFont : null,
    });
    toast.success(`${product.name} added to your bag`, {
      description: engraving
        ? `${qty} × ${formatINR(display)} · engraved “${engraving}” in ${ENGRAVING_FONTS[engravingFont].label.toLowerCase()}`
        : `${qty} × ${formatINR(display)}`,
    });
    setEngravingText("");
    setEngravingFont("SERIF");
    setEngravingOpen(false);
    if (thenCheckout) navigate("checkout");
  };

  /** Download the current 3D pose as a PNG keepsake (works with any orbit angle). */
  const handleSnapshot = () => {
    const capture = stageCaptureRef.current;
    if (!capture) {
      toast.error("The 3D view is still warming up — try again in a moment.");
      return;
    }
    try {
      const url = capture();
      const a = document.createElement("a");
      a.href = url;
      a.download = `ln-${product?.slug ?? "piece"}-3d.png`;
      a.click();
      toast.success("3D snapshot saved to your device", { description: "Share it with someone special." });
    } catch {
      toast.error("Could not capture the stage — please try again.");
    }
  };

  /** Share the 3D pose: native share sheet with the image when possible,
   *  otherwise save it and hand off to WhatsApp with the product link. */
  const handleSnapshotShare = async () => {
    const capture = stageCaptureRef.current;
    if (!capture) {
      toast.error("The 3D view is still warming up — try again in a moment.");
      return;
    }
    try {
      const dataUrl = capture();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `ln-${product?.slug ?? "piece"}-3d.png`, { type: "image/png" });
      const shareText = `${product?.name ?? "This piece"} — viewed in 3D at LN Jewellers ✨`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: product?.name ?? "LN Jewellers", text: shareText });
        return;
      }
      // Fallback: keep the image locally + offer WhatsApp with the product link
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = file.name;
      a.click();
      if (settings) {
        const digits = settings.whatsappNumber.replace(/\D/g, "");
        window.open(
          `https://wa.me/${digits}?text=${encodeURIComponent(`${shareText}\n${window.location.href}`)}`,
          "_blank"
        );
        toast.success("Snapshot saved — WhatsApp opened with your view");
      } else {
        toast.success("Snapshot saved to your device");
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return; // user closed the share sheet
      toast.error("Could not share the stage — please try again.");
    }
  };

  const handleShare = async () => {
    if (!product) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `${product.name} — LN Jewellers`, url });
      } catch {
        /* user dismissed */
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => null);
      toast.success("Link copied to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full rounded-xl bg-muted" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-4 w-24 bg-muted" />
            <Skeleton className="h-10 w-3/4 bg-muted" />
            <Skeleton className="h-6 w-40 bg-muted" />
            <Skeleton className="h-24 w-full bg-muted" />
            <Skeleton className="h-12 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        sku: product.sku,
        description: product.shortDescription ?? product.description,
        image: product.images?.map((i) => i) ?? [],
        brand: { "@type": "Brand", name: "LN Jewellers" },
        material: product.material,
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: netPrice(product.price + (variant?.priceDelta ?? 0), product.discountPercent),
          availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
        },
        ...(product.rating !== undefined && product.reviewCount
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
              },
            }
          : {}),
      }
    : null;

  if (error || !product) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center px-4 pb-24 pt-40 text-center">
        <Sparkles className="mb-4 h-8 w-8 text-[#D4AF37]" />
        <h1 className="font-serif text-3xl">This piece has left the atelier</h1>
        <p className="mt-3 text-sm text-muted-foreground">It may have been sold, archived or renamed. Explore what&apos;s currently on display.</p>
        <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Browse the collection</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <button onClick={() => navigate("home")} className="hover:text-foreground">Home</button>
        <span>/</span>
        <button onClick={() => { useApp.getState().setShopQuery({ category: product.category?.slug ?? "" }); navigate("shop"); }} className="hover:text-foreground">
          {product.category?.name ?? "Shop"}
        </button>
        <span>/</span>
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* gallery */}
        <div className="relative">
          <div
            className="group relative overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-white"
            style={mode === "3d" ? { backgroundColor: "#0A0A0A" } : undefined}
            onMouseMove={mode === "photos" ? onGalleryMouseMove : undefined}
            onMouseEnter={mode === "photos" ? () => setZooming(true) : undefined}
            onMouseLeave={mode === "photos" ? () => setZooming(false) : undefined}
          >
            {mode === "3d" ? (
              /* ------- interactive 3D stage ------- */
              <div className="relative aspect-[4/5] w-full" data-stage3d="">
                <ProductStage
                  categorySlug={product.category?.slug ?? ""}
                  material={product.material}
                  modelUrl={product.model3dUrl ?? undefined}
                  image={product.images?.[0]}
                  name={product.name}
                  captureRef={stageCaptureRef}
                  spin={spinMode}
                  className="aspect-[4/5] w-full"
                />
                {/* stage chrome */}
                <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#0A0A0A]/70 px-3 py-1 text-[11px] uppercase tracking-widest text-[#E6C87A] backdrop-blur">
                  <Rotate3d className="h-3.5 w-3.5" /> 3D atelier view
                </span>
                <button
                  type="button"
                  onClick={() => setSpinMode((v) => !v)}
                  aria-pressed={spinMode}
                  className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                    spinMode
                      ? "border-[#D4AF37] bg-[#D4AF37] text-[#171717] shadow-[0_4px_16px_rgba(212,175,55,0.5)]"
                      : "border-[#D4AF37]/50 bg-[#0A0A0A]/70 text-[#E6C87A] hover:bg-[#D4AF37] hover:text-[#171717]"
                  }`}
                  title="Spin the piece a full 360° for a showcase view"
                >
                  <RotateCw className={`h-3 w-3 ${spinMode ? "animate-spin" : ""}`} style={spinMode ? { animationDuration: "2.5s" } : undefined} />
                  {spinMode ? "360° · stop" : "Spin 360°"}
                </button>
                <button
                  type="button"
                  onClick={handleSnapshot}
                  className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#0A0A0A]/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#E6C87A] backdrop-blur transition-colors hover:bg-[#D4AF37] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  title="Save the current 3D view as an image"
                >
                  <Camera className="h-3.5 w-3.5" /> Snapshot
                </button>
                <button
                  type="button"
                  onClick={handleSnapshotShare}
                  className="absolute bottom-4 left-[7.25rem] inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#0A0A0A]/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#E6C87A] backdrop-blur transition-colors hover:bg-[#D4AF37] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  title="Share this 3D view"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1 text-[10px] uppercase tracking-widest text-[#7a611f] shadow-sm backdrop-blur"
                >
                  <Move3d className="h-3 w-3" /> Drag to rotate · scroll to zoom
                </span>
              </div>
            ) : (
              /* ------- photograph with loupe zoom ------- */
              <>
                <img
                  key={product.images?.[imgIdx] ?? imgIdx}
                  src={product.images?.[imgIdx] || "/images/brand/atelier.png"}
                  alt={`${product.name} — view ${imgIdx + 1}`}
                  className="img-enter aspect-[4/5] w-full object-cover transition-transform duration-300 ease-out will-change-transform"
                  style={{
                    transformOrigin: zoomOrigin,
                    transform: zooming ? "scale(1.85)" : "scale(1)",
                  }}
                />
                {product.discountPercent > 0 && (
                  <span className="absolute left-4 top-4 rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-semibold text-black">
                    Save {product.discountPercent}%
                  </span>
                )}
                {product.handmade && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#0A0A0A]/85 px-3 py-1 text-[11px] uppercase tracking-widest text-[#E6C87A]">
                    <Hammer className="h-3 w-3" /> Handmade
                  </span>
                )}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] uppercase tracking-widest text-[#7a611f] shadow-sm backdrop-blur transition-opacity duration-200 ${
                    zooming ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <ZoomIn className="h-3 w-3" /> Hover to zoom
                </span>
              </>
            )}
          </div>

          {/* view-mode switch — photographs vs interactive 3D */}
          <div className="mt-3 flex items-center justify-center" role="tablist" aria-label="Gallery view mode">
            <div className="flex rounded-full border border-[#D4AF37]/35 bg-white p-1 shadow-sm">
              <button
                role="tab"
                aria-selected={mode === "photos"}
                onClick={() => setMode("photos")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  mode === "photos" ? "bg-[#0A0A0A] text-[#E6C87A]" : "text-muted-foreground hover:text-[#7a611f]"
                }`}
              >
                <Images className="h-3.5 w-3.5" /> Photographs
              </button>
              <button
                role="tab"
                aria-selected={mode === "3d"}
                onClick={() => setMode("3d")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  mode === "3d" ? "bg-[#0A0A0A] text-[#E6C87A]" : "text-muted-foreground hover:text-[#7a611f]"
                }`}
              >
                <Rotate3d className="h-3.5 w-3.5" /> View in 3D
              </button>
            </div>
          </div>

          {mode === "photos" && product.images && product.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`overflow-hidden rounded-lg border-2 transition-all ${i === imgIdx ? "border-[#D4AF37]" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  { }
                  <img src={src} alt="" className="h-20 w-20 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info */}
        <div className="flex flex-col">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">
            {product.collection?.name ?? product.material}
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight md:text-4xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>SKU · {product.sku}</span>
            {product.rating !== undefined && (
              <span className="inline-flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(product.rating!) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-border"}`} />
                ))}
                <span className="ml-1">{product.rating} ({product.reviewCount})</span>
              </span>
            )}
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-serif text-3xl text-[#0A0A0A]">{formatINR(display)}</span>
            {product.discountPercent > 0 && (
              <span className="text-lg text-muted-foreground line-through">{formatINR(gross)}</span>
            )}
            <span className="text-xs text-muted-foreground">incl. {settings ? settings.taxRatePercent : 3}% GST at checkout</span>
          </div>

          {product.shortDescription && <p className="mt-4 leading-relaxed text-muted-foreground">{product.shortDescription}</p>}

          {/* stock */}
          <div className="mt-5">
            <span className={`text-sm font-medium ${
              stockInfo?.tone === "out" ? "text-destructive" : stockInfo?.tone === "low" ? "text-[#A16207]" : "text-emerald-700"
            }`}>
              ● {stockInfo?.label}
            </span>
            {!product.readyToShip && <span className="ml-3 text-sm text-muted-foreground">Made to order — crafted for you in 3–8 weeks</span>}
          </div>

          {/* size guide when no variant picker exists */}
          {product.variants.length === 0 && ["rings", "bracelets-bangles", "necklaces"].includes(product.category?.slug ?? "") && (
            <div className="mt-3">
              <SizeGuideDialog categorySlug={product.category?.slug} categoryName={product.category?.name} />
            </div>
          )}

          {/* variants */}
          {product.variants.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#A8862A]">Choose option</p>
                <SizeGuideDialog categorySlug={product.category?.slug} categoryName={product.category?.name} />
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = v.id === variantId;
                  const vOut = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => !vOut && setVariantId(v.id)}
                      disabled={vOut}
                      aria-pressed={active}
                      className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                        active
                          ? "border-[#D4AF37] bg-[#0A0A0A] text-[#E6C87A]"
                          : vOut
                            ? "cursor-not-allowed border-border text-muted-foreground/40 line-through"
                            : "border-[#D4AF37]/40 bg-white hover:border-[#D4AF37]"
                      }`}
                    >
                      {v.name}
                      {v.priceDelta > 0 && <span className="ml-1.5 text-xs opacity-70">+{formatINR(v.priceDelta)}</span>}
                      {vOut && <span className="ml-1.5 text-[10px] uppercase">sold</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* qty + actions */}
          <div ref={buyBoxRef} className="mt-7 flex flex-wrap items-stretch gap-3">
            {outOfStock ? (
              <Button
                onClick={() => setNotifyOpen(true)}
                className="h-11 min-w-[240px] flex-1 border border-[#D4AF37]/60 bg-[#0A0A0A] text-[#E6C87A] transition-transform hover:bg-[#171717] active:scale-[0.97]"
              >
                <BellRing className="mr-2 h-4 w-4" /> Notify me when available
              </Button>
            ) : (
              <>
                <div className="flex items-center rounded-lg border border-[#D4AF37]/40 bg-white">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-10 place-items-center text-muted-foreground hover:text-foreground" aria-label="Decrease quantity">
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    value={qty}
                    readOnly
                    aria-label="Quantity"
                    className="h-11 w-12 border-0 bg-transparent p-0 text-center focus-visible:ring-0"
                  />
                  <button onClick={() => setQty(Math.min(Math.max(maxStock, 1), qty + 1))} className="grid h-11 w-10 place-items-center text-muted-foreground hover:text-foreground" aria-label="Increase quantity">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={() => handleAdd(false)}
                  className="h-11 flex-1 bg-[#0A0A0A] text-[#FAF7F0] transition-transform hover:bg-[#171717] active:scale-[0.97] sm:flex-none sm:px-8"
                >
                  <ShoppingBag className="mr-2 h-4 w-4" /> Add to bag
                </Button>
                <Button
                  onClick={() => handleAdd(true)}
                  className="h-11 flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C87A] sm:flex-none sm:px-8"
                >
                  Buy now
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" className="h-11 w-11 border-[#D4AF37]/40" onClick={() => toggleWishlist(product.id)} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}>
              <Heart className={`h-4 w-4 ${wished ? "fill-[#D4AF37] text-[#D4AF37]" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 border-[#D4AF37]/40" onClick={handleShare} aria-label="Share product">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* back-in-stock note */}
          {outOfStock && (
            <p className="mt-3 text-xs text-muted-foreground">
              This piece is being re-crafted in the atelier — leave your email and our concierge will write the moment it returns.
            </p>
          )}

          {/* per-piece engraving (fee set by the atelier, charged per engraved piece at checkout) */}
          {settings?.engravingEnabled !== false && !outOfStock && (
            <div
              className={`mt-4 rounded-lg border transition-colors ${
                engravingOpen || engravingText.trim() ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => setEngravingOpen((v) => !v)}
                aria-expanded={engravingOpen}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <PenLine className="h-4 w-4 shrink-0 text-[#A8862A]" />
                <span className="text-sm font-medium">Add hand engraving</span>
                <span className="ml-auto text-xs font-medium text-[#7a611f]">
                  {settings ? `+${formatINR(engravingFeeFor(settings, engravingFont))} / piece · ${ENGRAVING_FONTS[engravingFont].label}` : "Personalise it"}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${engravingOpen ? "rotate-180" : ""}`} />
              </button>
              {(engravingOpen || engravingText.trim()) && (
                <div className="px-4 pb-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A name, date or promise — chased into the metal by our master karigar. Each hand prices its own
                    labour: flowing script is the slowest, classic serif the timeless default.
                  </p>
                  <Input
                    value={engravingText}
                    onChange={(e) => setEngravingText(e.target.value.slice(0, 60))}
                    placeholder="e.g. A · R  14.02.2026"
                    maxLength={60}
                    aria-label="Engraving text"
                    className="mt-2 border-[#D4AF37]/40 bg-white tracking-wider"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Up to 60 characters · charged per piece at checkout</span>
                    <span className={engravingText.length >= 55 ? "font-medium text-[#7a611f]" : ""} aria-live="polite">{engravingText.length}/60</span>
                  </div>
                  {engravingText.trim() && (
                    <div aria-hidden className="mt-2 rounded-md border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF7F0] via-[#F7EFD9] to-[#EFE3C4] px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <p
                        className={`break-words text-base text-[#7a611f] ${ENGRAVING_FONTS[engravingFont].className}`}
                        style={ENGRAVING_FONTS[engravingFont].style}
                      >
                        {engravingText.trim()}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-[#A8862A]">{ENGRAVING_FONTS[engravingFont].label} hand</p>
                    </div>
                  )}
                  {/* lettering style — the karigar's three hands */}
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">Lettering style</p>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Engraving lettering style">
                      {ENGRAVING_FONT_ORDER.map((f) => {
                        const active = engravingFont === f;
                        return (
                          <button
                            key={f}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setEngravingFont(f)}
                            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-all ${
                              active
                                ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_6px_18px_-10px_rgba(212,175,55,0.8)]"
                                : "border-border bg-white hover:border-[#D4AF37]/50"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`text-lg leading-none text-[#7a611f] ${ENGRAVING_FONTS[f].className}`}
                              style={ENGRAVING_FONTS[f].style}
                            >
                              {ENGRAVING_FONTS[f].sample}
                            </span>
                            <span className={`text-[10px] leading-tight ${active ? "font-medium text-[#5d4a13]" : "text-muted-foreground"}`}>
                              {ENGRAVING_FONTS[f].label}
                            </span>
                            {settings && (
                              <span className={`text-[10px] leading-none ${active ? "font-semibold text-[#A8862A]" : "text-[#A8862A]/70"}`}>
                                +{formatINR(engravingFeeFor(settings, f))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* whatsapp inquiry */}
          {settings && (
            <a
              href={waProductInquiry(settings, product, { variantName: variant?.name, quantity: qty, price: display })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-12 items-center justify-center gap-2 rounded-lg border border-[#25D366]/50 bg-[#25D366]/5 text-sm font-medium text-[#128C4B] transition-colors hover:bg-[#25D366]/15"
            >
              <MessageCircle className="h-4 w-4" /> Ask about this piece on WhatsApp
            </a>
          )}

          {/* trust row */}
          <div className="mt-7 grid grid-cols-3 gap-3 border-y border-border py-4 text-center text-[11px] text-muted-foreground">
            <div><Truck className="mx-auto mb-1.5 h-5 w-5 text-[#A8862A]" strokeWidth={1.4} />Insured shipping</div>
            <div><ShieldCheck className="mx-auto mb-1.5 h-5 w-5 text-[#A8862A]" strokeWidth={1.4} />{product.purity ?? "BIS Hallmarked"}</div>
            <div><RefreshCcw className="mx-auto mb-1.5 h-5 w-5 text-[#A8862A]" strokeWidth={1.4} />30-day returns</div>
          </div>

          {/* accordions */}
          <Accordion type="multiple" defaultValue={["desc"]} className="mt-6">
            <AccordionItem value="desc">
              <AccordionTrigger className="font-serif text-base">The story of this piece</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{product.description}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="specs">
              <AccordionTrigger className="font-serif text-base">Specifications</AccordionTrigger>
              <AccordionContent>
                <dl className="text-sm">
                  {[
                    ["Material", product.material],
                    ["Purity", product.purity],
                    ["Colour", product.color],
                    ["Weight", product.weightGrams ? `≈ ${product.weightGrams} g` : null],
                    ["Dimensions", product.dimensions],
                    ["Category", product.category?.name],
                    ["Collection", product.collection?.name],
                    ["Fulfilment", product.readyToShip ? "Ready to ship in 48 hours" : "Made to order (3–8 weeks)"],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string} className="flex items-baseline justify-between gap-4 border-b border-[#D4AF37]/10 py-2 last:border-b-0">
                        <dt className="shrink-0 text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                </dl>
                {product.weightGrams && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Final invoice is based on actual hallmark weight (±0.20 g); you are never billed above listed weight.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
            {product.craftsmanship && (
              <AccordionItem value="craft">
                <AccordionTrigger className="font-serif text-base">Craftsmanship</AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">{product.craftsmanship}</AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="care">
              <AccordionTrigger className="font-serif text-base">Care instructions</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                {product.careInstructions || "Wipe with a soft cloth after wear; store in the lined box away from perfume and moisture."}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger className="font-serif text-base">Shipping & returns</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                Ready-to-ship pieces dispatch within 48 working hours via insured courier with signature on delivery. Free insured shipping above ₹50,000. Unworn pieces can be returned within 30 days —{" "}
                <button onClick={() => navigate("policy", { policy: "shipping" })} className="text-[#A8862A] underline underline-offset-2">read the full policy</button>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* reviews */}
      <section className="mt-20" aria-label="Customer reviews">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Loved by our clients</p>
            <h2 className="mt-2 font-serif text-3xl">Reviews</h2>
          </div>
          <ReviewDialog productId={product.id} />
        </div>
        {product.reviews && product.reviews.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {product.reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#D4AF37]/30 py-10 text-center text-sm text-muted-foreground">
            No reviews yet — be the first to share your experience with this piece.
          </p>
        )}
      </section>

      {/* questions & answers */}
      <QuestionsSection slug={product.slug} productName={product.name} />

      {/* recently viewed */}
      <RecentlyViewed excludeSlug={product.slug} />

      {/* related */}
      {related.length > 0 && (
        <section className="mt-20" aria-label="Related products">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Pairs beautifully with</p>
          <h2 className="mt-2 mb-8 font-serif text-3xl">You may also love</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* mobile back */}
      <div className="mt-14 lg:hidden">
        <Button variant="ghost" onClick={() => navigate("shop")} className="text-[#A8862A]">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
        </Button>
      </div>

      {/* sticky mobile buy bar — appears once the main buy box scrolls past */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-[#D4AF37]/30 bg-white/95 shadow-[0_-6px_24px_rgba(10,10,10,0.08)] backdrop-blur transition-transform duration-300 lg:hidden ${
          stickyBuy ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        aria-hidden={!stickyBuy}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <img src={product.images?.[0] || "/images/brand/atelier.png"} alt="" className="h-11 w-11 shrink-0 rounded-md border border-border object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-sm font-semibold text-[#7a611f]">
              {formatINR(display)}
              {variant ? <span className="font-normal text-muted-foreground"> · {variant.name}</span> : null}
            </p>
          </div>
          <Button
            onClick={() => (outOfStock ? setNotifyOpen(true) : handleAdd(false))}
            className="mr-14 h-11 shrink-0 bg-[#0A0A0A] px-5 text-[#FAF7F0] hover:bg-[#171717] active:scale-[0.97]"
          >
            {outOfStock ? (
              <>
                <BellRing className="mr-1.5 h-4 w-4" /> Notify me
              </>
            ) : (
              <>
                <ShoppingBag className="mr-1.5 h-4 w-4" /> Add to bag
              </>
            )}
          </Button>
        </div>
      </div>

      {/* back-in-stock dialog */}
      <NotifyMeDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        slug={product.slug}
        productName={product.name}
      />
    </div>
  );
}

/** One client review with a "was this helpful?" vote — votes persist on the
 *  review row and repeat votes from this browser are remembered locally. */
function ReviewCard({ review }: { review: Review }) {
  const [helpful, setHelpful] = useState(review.helpfulCount ?? 0);
  // Lazy initializer reads the dedup list once at mount — no effect needed.
  const [voted, setVoted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return (JSON.parse(localStorage.getItem("ln_helpful") || "[]") as string[]).includes(review.id);
    } catch {
      return false;
    }
  });

  const markVotedLocally = (id: string) => {
    try {
      const raw = JSON.parse(localStorage.getItem("ln_helpful") || "[]") as string[];
      localStorage.setItem("ln_helpful", JSON.stringify([...new Set([...raw, id])]));
    } catch {
      /* private mode etc. — the vote itself still counted server-side */
    }
  };

  const vote = async () => {
    if (voted) return;
    setVoted(true); // optimistic — prevents double-click double votes
    setHelpful((n) => n + 1);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(review.id)}/helpful`, { method: "POST" });
      const data = await res.json();
      if (res.ok && typeof data.helpfulCount === "number") {
        setHelpful(data.helpfulCount);
        markVotedLocally(review.id);
        toast.success("Thank you — feedback from clients like you guides the atelier.");
      } else {
        setVoted(false);
        setHelpful((n) => Math.max(0, n - 1));
        toast.error(data.error ?? "Could not record your vote");
      }
    } catch {
      setVoted(false);
      setHelpful((n) => Math.max(0, n - 1));
      toast.error("Network error — please try again");
    }
  };

  return (
    <figure className="flex flex-col rounded-xl border border-[#D4AF37]/25 bg-white p-6">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-border"}`} />
        ))}
      </div>
      {review.title && <figcaption className="mt-3 font-serif text-lg">{review.title}</figcaption>}
      <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">“{review.comment}”</blockquote>
      <p className="mt-4 text-xs text-muted-foreground">{review.name} · {formatDate(review.createdAt)}</p>
      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
        {voted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-medium text-[#7a611f]">
            <ThumbsUp className="h-3.5 w-3.5 fill-[#D4AF37]/40" aria-hidden />
            {helpful} {helpful === 1 ? "client found" : "clients found"} this helpful
          </span>
        ) : (
          <button
            type="button"
            onClick={vote}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 px-3 py-1.5 text-[11px] font-medium text-[#7a611f] transition-colors hover:border-[#D4AF37] hover:bg-[#D4AF37]/10"
            aria-label="Mark this review as helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> Helpful{helpful > 0 ? ` · ${helpful}` : ""}
          </button>
        )}
      </div>
    </figure>
  );
}

function ReviewDialog({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setFields({});
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, name, rating, title, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFields(data.fields ?? {});
        toast.error(data.error ?? "Could not submit review");
        return;
      }
      toast.success("Thank you — your review will appear after moderation.");
      setOpen(false);
      setName(""); setTitle(""); setComment(""); setRating(5);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#D4AF37]/50 text-[#A8862A] hover:bg-[#D4AF37] hover:text-black">
          Write a review
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[#D4AF37]/30 bg-[#FAF7F0]">
        <DialogHeader>
          <DialogTitle className="font-serif">Share your experience</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                  <Star className={`h-7 w-7 transition-colors ${n <= rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-border hover:text-[#E6C87A]"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Your name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
            {fields.name && <p className="mt-1 text-xs text-destructive">{fields.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Headline (optional)</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Your review</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="border-[#D4AF37]/40 bg-white" />
            {fields.comment && <p className="mt-1 text-xs text-destructive">{fields.comment}</p>}
          </div>
          <Button onClick={submit} disabled={sending} className="w-full bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
            {sending ? "Sending…" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionsSection({ slug, productName }: { slug: string; productName: string }) {
  const [qa, setQa] = useState<{ slug: string; questions: ProductQuestionDTO[] } | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const loading = !qa || qa.slug !== slug;
  const questions = qa?.slug === slug ? qa.questions : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${encodeURIComponent(slug)}/questions`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setQa({ slug, questions: data.questions ?? [] });
      })
      .catch(() => {
        if (!cancelled) setQa({ slug, questions: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <section className="mt-20" aria-label="Questions and answers">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Curious minds</p>
          <h2 className="mt-2 font-serif text-3xl">Questions &amp; Answers</h2>
        </div>
        <Button
          variant="outline"
          onClick={() => setAskOpen(true)}
          className="border-[#D4AF37]/50 text-[#A8862A] hover:bg-[#D4AF37] hover:text-black"
        >
          Ask about {productName.split(" ").slice(0, 3).join(" ")}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full bg-muted" />
          <Skeleton className="h-20 w-full bg-muted" />
        </div>
      ) : questions && questions.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {questions.map((q) => (
            <article key={q.id} className="rounded-xl border border-[#D4AF37]/25 bg-white p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-serif text-lg font-semibold text-[#D4AF37]" aria-hidden>Q.</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{q.name} · {formatDate(q.createdAt)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3 border-l-2 border-[#D4AF37]/50 pl-4">
                <span className="mt-0.5 font-serif text-lg font-semibold text-[#A8862A]" aria-hidden>A.</span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-muted-foreground">{q.answer}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-widest text-[#A8862A]">
                    LN Atelier{q.answeredAt ? ` · ${formatDate(q.answeredAt)}` : ""}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#D4AF37]/30 py-10 text-center text-sm text-muted-foreground">
          No questions yet — ask us anything about this piece and our karigars will answer.
        </p>
      )}

      <AskQuestionDialog slug={slug} open={askOpen} onOpenChange={setAskOpen} />
    </section>
  );
}

function AskQuestionDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setFields({});
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFields(data.fields ?? {});
        toast.error(data.error ?? "Could not submit your question");
        return;
      }
      toast.success(data.message ?? "Thank you — our atelier will answer shortly.");
      onOpenChange(false);
      setName("");
      setEmail("");
      setQuestion("");
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#D4AF37]/30 bg-[#FAF7F0]">
        <DialogHeader>
          <DialogTitle className="font-serif">Ask the atelier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Your name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
            {fields.name && <p className="mt-1 text-xs text-destructive">{fields.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
              Email <span className="normal-case tracking-normal opacity-70">(optional — for a personal reply)</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#D4AF37]/40 bg-white"
            />
            {fields.email && <p className="mt-1 text-xs text-destructive">{fields.email}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Your question</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="e.g. Can this be made in a size 12? How long would it take?"
              className="border-[#D4AF37]/40 bg-white"
            />
            {fields.question && <p className="mt-1 text-xs text-destructive">{fields.question}</p>}
          </div>
          <Button onClick={submit} disabled={sending} className="w-full bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
            {sending ? "Sending…" : "Send question"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Answers are published on this page after review. Personal details are never shown publicly.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
