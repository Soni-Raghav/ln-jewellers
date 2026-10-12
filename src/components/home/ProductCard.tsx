"use client";

/**
 * ProductCard — premium editorial product card for Aurelia Jewels.
 *
 * - Whole card navigates to the product view (or calls `onOpen`).
 * - Hover reveals a quick-add button (default/first available variant,
 *   unitPrice = price + variantDelta (pre-discount; cart math applies discountPercent).
 * - Discount badge, out-of-stock overlay, handmade "One of one" tag,
 *   wishlist heart, SKU micro-text, serif name, struck-through pricing,
 *   star rating and a stock line via `stockLabel`.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, ShoppingBag, Star } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/types";
import { useApp } from "@/lib/store";
import { formatINR, netPrice, stockLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Default variant = first with stock (when tracking), else first variant. */
function pickVariant(product: Product): ProductVariant | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  const available = variants.filter(
    (v) => !product.trackInventory || v.stock > 0
  );
  return available[0] ?? variants[0];
}

export interface ProductCardProps {
  product: Product;
  /** Overrides the default navigate-to-product behaviour. */
  onOpen?: () => void;
  className?: string;
}

export function ProductCard({ product, onOpen, className }: ProductCardProps) {
  const navigate = useApp((s) => s.navigate);
  const addToCart = useApp((s) => s.addToCart);
  const toggleWishlist = useApp((s) => s.toggleWishlist);
  const inWishlist = useApp((s) => s.inWishlist);
  // subscribe to the wishlist array so the heart re-renders when it changes
  useApp((s) => s.wishlist);

  const [imageFailed, setImageFailed] = useState(false);

  const variant = useMemo(() => pickVariant(product), [product]);
  const grossPrice = product.price + (variant?.priceDelta ?? 0);
  const displayPrice = netPrice(grossPrice, product.discountPercent);
  const maxStock = variant ? variant.stock : product.stock;
  const outOfStock = product.trackInventory && maxStock <= 0;
  const stock = stockLabel(
    product.stock,
    product.trackInventory,
    product.lowStockThreshold
  );
  const wished = inWishlist(product.id);
  const image = product.images?.[0] ?? "";

  const stockToneClass =
    stock.tone === "out"
      ? "text-red-700"
      : stock.tone === "low"
        ? "text-[#A16207]"
        : "text-foreground/50";

  const open = () => {
    if (onOpen) onOpen();
    else navigate("product", { slug: product.slug });
  };

  const handleQuickAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (outOfStock) return;
    addToCart({
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      image,
      unitPrice: grossPrice,
      discountPercent: product.discountPercent,
      quantity: 1,
      variantName: variant?.name ?? null,
      maxStock: Math.max(maxStock, 1),
    });
    toast.success(`${product.name} added to your bag`, {
      description: variant ? `${variant.name} · ${formatINR(displayPrice)}` : formatINR(displayPrice),
    });
  };

  const handleWishlist = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    toggleWishlist(product.id);
    toast.success(
      wished ? `${product.name} removed from wishlist` : `${product.name} saved to wishlist`
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col border border-[#D4AF37]/20 bg-card transition-all duration-300",
        "hover:border-[#D4AF37]/50 hover:shadow-[0_18px_44px_-18px_rgba(212,175,55,0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60",
        className
      )}
    >
      {/* ---------- image ---------- */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F1E8D2]">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#F1E8D2] via-[#E6C87A]/50 to-[#D4AF37]/40">
            <span className="font-serif text-5xl text-[#8A6D1F]/50">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* discount badge */}
        {product.discountPercent > 0 && (
          <span className="absolute left-3 top-3 bg-[#D4AF37] px-2 py-0.5 text-[11px] font-medium tracking-wide text-black shadow-sm">
            -{product.discountPercent}%
          </span>
        )}

        {/* handmade tag */}
        {product.handmade && (
          <span className="absolute bottom-3 left-3 border border-[#D4AF37]/60 bg-[#0A0A0A]/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#E6C87A] backdrop-blur-sm">
            One of one
          </span>
        )}

        {/* wishlist heart */}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={handleWishlist}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/85 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
        >
          <Heart
            className={cn(
              "size-4 transition",
              wished ? "fill-[#D4AF37] text-[#D4AF37]" : "text-neutral-600"
            )}
          />
        </button>

        {/* out-of-stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <span className="border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
              Out of stock
            </span>
          </div>
        )}

        {/* quick add (hover) */}
        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            disabled={outOfStock}
            onClick={handleQuickAdd}
            className="h-9 w-full border border-[#D4AF37]/40 bg-[#0A0A0A]/90 text-[#FAF7F0] backdrop-blur hover:bg-[#171717]"
          >
            <ShoppingBag className="size-3.5" />
            {outOfStock ? "Unavailable" : "Quick add"}
          </Button>
        </div>
      </div>

      {/* ---------- details ---------- */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {product.sku}
          </span>
          {typeof product.rating === "number" && (
            <span className="flex items-center gap-1 text-xs text-foreground/70">
              <Star className="size-3.5 fill-[#D4AF37] text-[#D4AF37]" />
              {product.rating.toFixed(1)}
              {product.reviewCount ? (
                <span className="text-foreground/40">({product.reviewCount})</span>
              ) : null}
            </span>
          )}
        </div>

        <h3 className="font-serif text-base leading-snug text-foreground md:text-lg">
          {product.name}
        </h3>

        {product.shortDescription ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {product.shortDescription}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-serif text-lg text-foreground">
              {formatINR(displayPrice)}
            </span>
            {product.discountPercent > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatINR(grossPrice)}
              </span>
            )}
          </div>
          <span className={cn("text-[10px] uppercase tracking-wider", stockToneClass)}>
            {stock.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
