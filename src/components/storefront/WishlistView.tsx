"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import ProductCard from "@/components/home/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatINR, netPrice, waLink } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function WishlistView() {
  const wishlist = useApp((s) => s.wishlist);
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const shareOnWhatsApp = () => {
    if (items.length === 0 || !settings) return;
    const lines = [
      `Hello LN Jewellers! ◆`,
      ``,
      `Here's my wishlist — could you share availability and current making times?`,
      ``,
      ...items.slice(0, 12).map((p, i) => `${i + 1}. *${p.name}* — ${formatINR(netPrice(p.price, p.discountPercent))}`),
      ``,
      `Sent from my wishlist on your website.`,
    ];
    window.open(waLink(settings.whatsappNumber, lines.join("\n")), "_blank", "noopener");
  };

  const wishlistText = () => {
    const list = items
      .slice(0, 12)
      .map((p, i) => `${i + 1}. ${p.name} — ${formatINR(netPrice(p.price, p.discountPercent))}`)
      .join("\n");
    const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#/wishlist` : "";
    return `My LN Jewellers wishlist ✨\n\n${list}\n\n${url}`;
  };

  /** Native share sheet (mobile) with graceful clipboard fallback on desktop. */
  const shareList = async () => {
    if (items.length === 0) return;
    const text = wishlistText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "My LN Jewellers wishlist", text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return; // user closed the sheet
        // fall through to clipboard on any share failure
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Wishlist copied to clipboard", { description: "Paste it in a chat with someone special." });
    } catch {
      toast.error("Could not copy — please try again");
    }
  };

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
        {items.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button
              onClick={shareOnWhatsApp}
              className="h-11 bg-[#25D366] px-5 text-white hover:bg-[#1fb857]"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Ask concierge on WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={shareList}
              className="h-11 border-[#D4AF37]/50 text-[#7a611f] hover:bg-[#D4AF37]/10 hover:text-[#7a611f]"
            >
              <Share2 className="mr-2 h-4 w-4" /> Share list
            </Button>
          </div>
        )}
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
          <span aria-hidden className="mb-5 h-2.5 w-2.5 rotate-45 border border-[#D4AF37] bg-[#D4AF37]/30" />
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
