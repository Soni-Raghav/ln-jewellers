"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, ShieldCheck, Gem, ReceiptText, Lock } from "lucide-react";
import { formatINR, formatDate, engravingFontLabel } from "@/lib/format";

interface InvoiceOrder {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  couponCode?: string | null;
  couponDiscount?: number;
  giftWrap?: boolean;
  giftWrapFee?: number;
  giftMessage?: string | null;
  engravingText?: string | null;
  engravingFee?: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  items: {
    name: string;
    sku: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    engravingText?: string | null;
    engravingFont?: string | null;
  }[];
}

const BRAND_FALLBACK = {
  brandName: "LN Jewellers",
  tagline: "Handcrafted Luxury Jewelry",
  address: "LN Atelier, 12 Heritage Lane, Johari Bazaar, Jaipur 302003, Rajasthan, India",
  email: "hello@lnjewellers.com",
  phone: "+91 98765 43210",
};

/**
 * Dedicated tax-invoice view (#/invoice/LN-…).
 * The order API requires number + matching billing email, so a guest landing on
 * this URL directly (shared link, page reload) verifies with their email first.
 * Print/PDF via the browser — a print stylesheet strips everything but the sheet.
 */
export default function InvoiceView() {
  const navigate = useApp((s) => s.navigate);
  const params = useApp((s) => s.params);
  const settings = useApp((s) => s.settings);
  const user = useApp((s) => s.user);

  const [email, setEmail] = useState(params.orderEmail ?? "");
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (number: string, mail: string) => {
    if (!number.trim()) {
      setError("Please enter the email used at checkout");
      return;
    }
    // A signed-in member who owns the order may omit the email entirely —
    // the server recognises the session and skips verification.
    setLoading(true);
    setError("");
    try {
      const qs = mail.trim() ? `?email=${encodeURIComponent(mail.trim())}` : "";
      const res = await fetch(`/api/orders/${encodeURIComponent(number.trim().toUpperCase())}${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We couldn't find an invoice for those details");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load once when arriving with the number (hash) plus either the email
  // (state) or an owning session (restored asynchronously after mount).
  useEffect(() => {
    if (!order && params.orderNumber && (email || user) && !loading) {
      void load(params.orderNumber, email);
    }
  }, [params.orderNumber, email, user]);

  const brand = settings
    ? {
        brandName: settings.brandName || BRAND_FALLBACK.brandName,
        tagline: settings.tagline || BRAND_FALLBACK.tagline,
        address: settings.address || BRAND_FALLBACK.address,
        email: settings.email || BRAND_FALLBACK.email,
        phone: settings.phone || BRAND_FALLBACK.phone,
      }
    : BRAND_FALLBACK;

  // ---------- verification gate / loading ----------
  if (!order) {
    if (loading) {
      return (
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
          <Skeleton className="h-8 w-1/3 bg-muted" />
          <Skeleton className="mt-4 h-64 w-full bg-muted" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-32 sm:px-6">
        <header className="mb-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">LN Atelier</p>
          <h1 className="mt-2 font-serif text-4xl">Your Invoice</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            For your privacy, invoices unlock with the order number and the email used at checkout.
          </p>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(params.orderNumber || (document.getElementById("inv-num") as HTMLInputElement)?.value || "", email);
          }}
          className="rounded-xl border border-[#D4AF37]/25 bg-white p-6 sm:p-8"
        >
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Order number</Label>
              <Input
                id="inv-num"
                defaultValue={params.orderNumber ?? ""}
                placeholder="LN-20250101-XXXXX"
                className="border-[#D4AF37]/40 bg-[#FAF7F0] uppercase"
                readOnly={!!params.orderNumber}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Email used at checkout</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border-[#D4AF37]/40 bg-[#FAF7F0]"
                autoComplete="email"
              />
            </div>
          </div>
          {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="mt-5 h-12 w-full bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
            <ReceiptText className="mr-2 h-4 w-4" /> Open invoice
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Verified against the billing email — the same check that guards order tracking.
          </p>
        </form>
      </div>
    );
  }

  // ---------- the invoice sheet ----------
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <div className="invoice-sheet rounded-xl border border-[#D4AF37]/30 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(10,10,10,0.35)] sm:p-10">
        {/* letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#D4AF37] pb-6">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10" aria-hidden>
              <Gem className="h-5 w-5 text-[#A8862A]" strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-serif text-2xl font-semibold leading-tight text-[#1C1A16]">{brand.brandName}</p>
              <p className="text-xs text-[#5A544A]">{brand.tagline}</p>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-[#8A8375]">{brand.address}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Tax invoice</p>
            <p className="mt-1 font-mono text-sm text-[#1C1A16]">{order.orderNumber}</p>
            <p className="text-xs text-[#5A544A]">Issued {formatDate(order.createdAt)}</p>
            <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
              order.paymentStatus === "PAID" ? "bg-emerald-800/10 text-emerald-800" : "bg-[#D4AF37]/15 text-[#7a611f]"
            }`}>
              {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "REFUNDED" ? "Refunded" : "Payment pending"}
            </p>
          </div>
        </div>

        {/* bill-to / payment */}
        <div className="mt-6 grid gap-6 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-[#8A8375]">Billed to</p>
            <p className="font-medium text-[#1C1A16]">{order.customerName}</p>
            <p className="mt-0.5 leading-relaxed text-[#5A544A]">
              {order.address}
              <br />
              {order.city}, {order.state} – {order.pincode}
              <br />
              {order.phone} · {order.email}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-[#8A8375]">Payment & fulfilment</p>
            <p className="text-[#5A544A]">
              {order.paymentMethod === "WHATSAPP" ? "WhatsApp concierge" : "Online (Razorpay)"} · {order.paymentStatus}
            </p>
            <p className="mt-0.5 text-[#5A544A]">Order status: {order.status.replace("_", " ").toLowerCase()}</p>
            {order.notes && <p className="mt-2 italic leading-relaxed text-[#8A8375]">“{order.notes}”</p>}
          </div>
        </div>

        {/* items — rate column folds away on narrow phones (qty × rate is derivable
            from the amount, and the full grid returns on sm+ screens and in print) */}
        <div className="-mx-1 mt-8 overflow-x-auto px-1">
          <table className="mt-0 w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#D4AF37]/40 text-left text-[10px] uppercase tracking-[0.25em] text-[#A8862A]">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Piece</th>
                <th className="py-2 pr-2 text-center font-medium">Qty</th>
                <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell print:table-cell">Rate</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i, idx) => (
                <tr key={idx} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-2 text-xs text-[#8A8375]">{idx + 1}</td>
                  <td className="py-3 pr-2">
                    <p className="font-medium text-[#1C1A16]">{i.name}</p>
                    <p className="text-[11px] text-[#8A8375]">
                      SKU {i.sku}{i.variantName ? ` · ${i.variantName}` : ""}
                    </p>
                    {i.engravingText && (
                      <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/8 px-2 py-0.5 text-[10px] text-[#7a611f]">
                        <span className="shrink-0 uppercase tracking-wider">Engraved</span>
                        <span className="truncate font-serif italic tracking-wider">“{i.engravingText}”</span>
                        <span className="shrink-0 rounded-full bg-[#D4AF37]/15 px-1.5 text-[9px] uppercase tracking-wider">{engravingFontLabel(i.engravingFont)}</span>
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-center text-[#5A544A]">{i.quantity}</td>
                  <td className="hidden py-3 pr-2 text-right text-[#5A544A] sm:table-cell print:table-cell">{formatINR(i.unitPrice)}</td>
                  <td className="py-3 text-right font-medium text-[#1C1A16]">{formatINR(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
          <p className="flex justify-between text-[#5A544A]"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></p>
          {!!order.couponDiscount && order.couponDiscount > 0 && order.couponCode && (
            <p className="flex justify-between text-[#7a611f]"><span>Coupon {order.couponCode}</span><span>−{formatINR(order.couponDiscount)}</span></p>
          )}
          <p className="flex justify-between text-[#5A544A]"><span>Shipping</span><span>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</span></p>
          {!!order.giftWrap && !!order.giftWrapFee && order.giftWrapFee > 0 && (
            <p className="flex justify-between text-[#7a611f]"><span>Signature gift wrap</span><span>{formatINR(order.giftWrapFee)}</span></p>
          )}
          {!!order.engravingFee && order.engravingFee > 0 && (
            <p className="flex justify-between text-[#7a611f]"><span>Hand engraving</span><span>{formatINR(order.engravingFee)}</span></p>
          )}
          <p className="flex justify-between text-[#5A544A]"><span>GST</span><span>{formatINR(order.tax)}</span></p>
          <p className="flex justify-between border-t-2 border-[#D4AF37] pt-2 text-base font-medium text-[#1C1A16]">
            <span>Total</span><span className="font-serif text-lg">{formatINR(order.total)}</span>
          </p>
        </div>

        {/* gift card message */}
        {order.giftMessage && (
          <div className="relative mt-6 overflow-hidden rounded-lg border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF7F0] via-[#FBF6E9] to-[#F4EAD2] px-4 py-3">
            <span aria-hidden className="absolute right-3 top-3 h-2 w-2 rotate-45 bg-[#D4AF37]/70" />
            <p className="text-[9px] uppercase tracking-[0.35em] text-[#A8862A]">On the gift card</p>
            <p className="mt-1 font-serif text-sm italic leading-relaxed text-[#1C1A16]">“{order.giftMessage}”</p>
          </div>
        )}

        {/* assurances + signature */}
        <div className="mt-8 grid gap-6 border-t border-border pt-6 text-xs sm:grid-cols-2">
          <div className="space-y-2 text-[#5A544A]">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A8862A]" aria-hidden />
              Every piece is BIS 916 hallmarked and inspected under loupe before dispatch.
            </p>
            <p>Prices are inclusive of the GST shown above, as per Indian tax law. Crafted to order in Jaipur.</p>
          </div>
          <div className="sm:text-right">
            <p className="mb-6 text-[10px] uppercase tracking-[0.3em] text-[#8A8375]">For {brand.brandName}</p>
            <p className="mx-auto w-40 border-b border-[#B0A88F] sm:ml-auto" aria-hidden />
            <p className="mt-1.5 text-[#8A8375]">Client concierge</p>
          </div>
        </div>

        <p className="mt-6 border-t border-border pt-3 text-center text-[10px] leading-relaxed text-[#B0A88F]">
          This is a computer-generated invoice from {brand.brandName} · {brand.email} · {brand.phone}
        </p>
      </div>

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => window.print()} className="bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
          <Printer className="mr-2 h-4 w-4" /> Print / save as PDF
        </Button>
        <Button variant="outline" onClick={() => navigate("track")} className="border-[#D4AF37]/50 text-[#7a611f] hover:bg-[#D4AF37]/10">
          <ArrowLeft className="mr-2 h-4 w-4" /> Track this order
        </Button>
        <Button variant="outline" onClick={() => navigate("shop")} className="border-border">
          Continue shopping
        </Button>
      </div>
    </div>
  );
}
