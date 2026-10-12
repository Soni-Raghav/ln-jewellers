"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, MessageCircle, ArrowRight, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatINR, netPrice, waCartInquiry } from "@/lib/format";

export default function CartView() {
  const cart = useApp((s) => s.cart);
  const updateQuantity = useApp((s) => s.updateQuantity);
  const removeFromCart = useApp((s) => s.removeFromCart);
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);

  if (cart.length === 0) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center px-4 pb-24 pt-40 text-center">
        <ShoppingBag className="mb-4 h-9 w-9 text-[#D4AF37]" strokeWidth={1.4} />
        <h1 className="font-serif text-3xl">Your bag is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Fill it with something that will still be loved in fifty years.
        </p>
        <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>
          Explore the collection
        </Button>
      </div>
    );
  }

  const subtotal = cart.reduce((n, i) => n + netPrice(i.unitPrice, i.discountPercent) * i.quantity, 0);
  const shipping = settings ? (subtotal >= settings.freeShippingAbove ? 0 : settings.shippingFee) : 0;
  const taxRate = settings?.taxRatePercent ?? 3;
  const tax = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + shipping + tax;
  const freeGap = settings ? Math.max(0, settings.freeShippingAbove - subtotal) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Your Selection</p>
        <h1 className="mt-2 font-serif text-4xl">The Shopping Bag</h1>
      </header>

      {freeGap > 0 && settings && (
        <div className="mx-auto mb-8 flex max-w-3xl items-center gap-3 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm">
          <Truck className="h-4 w-4 shrink-0 text-[#A8862A]" />
          <p>
            Add <strong>{formatINR(freeGap)}</strong> more to unlock <strong>free insured shipping</strong>.
          </p>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* items */}
        <div className="divide-y divide-border rounded-xl border border-[#D4AF37]/25 bg-white">
          {cart.map((item) => {
            const unit = netPrice(item.unitPrice, item.discountPercent);
            return (
              <div key={`${item.productId}-${item.variantId ?? "base"}`} className="flex gap-4 p-4 sm:gap-6 sm:p-6">
                <button onClick={() => navigate("product", { slug: item.slug })} className="shrink-0 overflow-hidden rounded-lg border border-border">
                  { }
                  <img src={item.image || "/images/brand/atelier.png"} alt={item.name} className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button onClick={() => navigate("product", { slug: item.slug })} className="block truncate font-serif text-lg hover:text-[#A8862A]">
                        {item.name}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.sku}{item.variantName ? ` · ${item.variantName}` : ""}
                      </p>
                      {item.discountPercent > 0 && (
                        <p className="mt-0.5 text-xs text-[#A8862A]">{item.discountPercent}% off applied</p>
                      )}
                    </div>
                    <button
                      onClick={() => { removeFromCart(item.productId, item.variantId); toast.info(`${item.name} removed`); }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${item.name} from bag`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div className="flex items-center rounded-lg border border-[#D4AF37]/40">
                      <button onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)} className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground" aria-label="Decrease quantity">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => { updateQuantity(item.productId, item.variantId, item.quantity + 1); if (item.quantity >= item.maxStock) toast.info(`Only ${item.maxStock} available`); }}
                        className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="font-serif text-lg">{formatINR(unit * item.quantity)}</p>
                  </div>
                  {item.maxStock <= 3 && (
                    <p className="mt-1 text-xs text-[#A16207]">Only {item.maxStock} left in stock</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* summary */}
        <aside className="h-fit rounded-xl border border-[#D4AF37]/25 bg-white p-6 lg:sticky lg:top-32">
          <h2 className="font-serif text-xl">Order Summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="font-medium">{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({taxRate}%)</span><span className="font-medium">{formatINR(tax)}</span></div>
            <Separator className="bg-border" />
            <div className="flex justify-between text-base"><span className="font-serif">Total</span><span className="font-serif text-xl text-[#0A0A0A]">{formatINR(total)}</span></div>
          </div>
          <Button onClick={() => navigate("checkout")} className="mt-6 h-12 w-full bg-[#D4AF37] text-base font-medium text-black hover:bg-[#E6C87A]">
            Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {settings && (
            <a
              href={waCartInquiry(settings, cart, { subtotal, shipping, tax, total })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#25D366]/50 bg-[#25D366]/5 text-sm font-medium text-[#128C4B] transition-colors hover:bg-[#25D366]/15"
            >
              <MessageCircle className="h-4 w-4" /> Ask about these pieces on WhatsApp
            </a>
          )}
          <Button variant="ghost" className="mt-3 w-full text-muted-foreground" onClick={() => navigate("shop")}>
            Continue shopping
          </Button>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Prices locked at order confirmation · Insured shipping · Signature on delivery
          </p>
        </aside>
      </div>
    </div>
  );
}
