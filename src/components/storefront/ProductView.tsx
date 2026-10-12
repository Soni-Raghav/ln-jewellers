"use client";

import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck, Star, Sparkles, Hammer, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, netPrice, stockLabel, waProductInquiry, formatDate } from "@/lib/format";
import type { Product, Paginated } from "@/lib/types";
import RecentlyViewed, { pushRecent } from "@/components/storefront/RecentlyViewed";

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
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      setImgIdx(0);
      setQty(1);
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

  const handleAdd = (thenCheckout = false) => {
    if (!product || outOfStock) return;
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
    });
    toast.success(`${product.name} added to your bag`, { description: `${qty} × ${formatINR(display)}` });
    if (thenCheckout) navigate("checkout");
  };

  const handleShare = async () => {
    if (!product) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `${product.name} — Aurelia Jewels`, url });
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
        brand: { "@type": "Brand", name: "Aurelia Jewels" },
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
          <div className="relative overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-white">
            { }
            <img
              key={product.images?.[imgIdx] ?? imgIdx}
              src={product.images?.[imgIdx] || "/images/brand/atelier.png"}
              alt={`${product.name} — view ${imgIdx + 1}`}
              className="img-enter aspect-[4/5] w-full object-cover"
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
          </div>
          {product.images && product.images.length > 1 && (
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

          {/* variants */}
          {product.variants.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#A8862A]">Choose option</p>
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
          <div className="mt-7 flex flex-wrap items-stretch gap-3">
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
              disabled={outOfStock}
              className="h-11 flex-1 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717] sm:flex-none sm:px-8"
            >
              <ShoppingBag className="mr-2 h-4 w-4" /> {outOfStock ? "Out of stock" : "Add to bag"}
            </Button>
            <Button
              onClick={() => handleAdd(true)}
              disabled={outOfStock}
              className="h-11 flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C87A] sm:flex-none sm:px-8"
            >
              Buy now
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 border-[#D4AF37]/40" onClick={() => toggleWishlist(product.id)} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}>
              <Heart className={`h-4 w-4 ${wished ? "fill-[#D4AF37] text-[#D4AF37]" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 border-[#D4AF37]/40" onClick={handleShare} aria-label="Share product">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

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
                <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm">
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
                      <div key={k as string} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-medium">{v}</dd>
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
              <figure key={r.id} className="flex flex-col rounded-xl border border-[#D4AF37]/25 bg-white p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-border"}`} />
                  ))}
                </div>
                {r.title && <figcaption className="mt-3 font-serif text-lg">{r.title}</figcaption>}
                <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">“{r.comment}”</blockquote>
                <p className="mt-4 text-xs text-muted-foreground">{r.name} · {formatDate(r.createdAt)}</p>
              </figure>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#D4AF37]/30 py-10 text-center text-sm text-muted-foreground">
            No reviews yet — be the first to share your experience with this piece.
          </p>
        )}
      </section>

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
    </div>
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
