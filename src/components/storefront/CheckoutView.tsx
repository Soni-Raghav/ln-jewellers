"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingBag, MessageCircle, CreditCard, CheckCircle2, ArrowLeft, ShieldCheck, Send, Ticket, Gift, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatINR, netPrice, waOrderMessage, engravingFontLabel } from "@/lib/format";
import type { CartItem, StoreSettingsDTO } from "@/lib/types";

interface PlacedOrder {
  orderNumber: string;
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  shipping: number;
  giftWrap: boolean;
  giftWrapFee: number;
  giftMessage: string | null;
  engravingFee: number;
  tax: number;
  total: number;
  items: { name: string; sku: string; variantName: string | null; quantity: number; lineTotal: number; engravingText?: string | null; engravingFont?: string | null }[];
}

interface AppliedCoupon {
  code: string;
  description: string | null;
  discountAmount: number;
}

export default function CheckoutView() {
  const cart = useApp((s) => s.cart);
  const clearCart = useApp((s) => s.clearCart);
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);

  const [form, setForm] = useState({ customerName: "", email: "", phone: "", address: "", city: "", state: "", pincode: "", notes: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"WHATSAPP" | "RAZORPAY">("WHATSAPP");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  if (placed) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-32 text-center">
        <span className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10">
          <CheckCircle2 className="h-10 w-10 text-[#A8862A]" strokeWidth={1.4} />
        </span>
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Order received</p>
        <h1 className="mt-3 font-serif text-4xl">Thank you, the atelier awaits</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your order <strong className="text-foreground">{placed.orderNumber}</strong> has been placed.
          {method === "WHATSAPP" && whatsappUrl
            ? " Now press send on WhatsApp so our concierge can confirm availability, payment and delivery personally."
            : " Our team will contact you shortly with payment and delivery details."}
        </p>
        {method === "WHATSAPP" && whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-8 text-base font-medium text-white transition-transform hover:scale-[1.02] hover:bg-[#1fb857]"
          >
            <MessageCircle className="h-5 w-5" /> Open WhatsApp & press send
          </a>
        )}
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-[#D4AF37]/25 bg-white p-6 text-left">
          <h2 className="font-serif text-lg">Order {placed.orderNumber}</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {placed.items.map((i, idx) => (
              <div key={idx}>
                <p className="flex justify-between gap-3 text-muted-foreground">
                  <span>{i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.quantity}</span>
                  <span className="shrink-0">{formatINR(i.lineTotal)}</span>
                </p>
                {i.engravingText && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#7a611f]">
                    <PenLine className="h-3 w-3" /> Engraved “{i.engravingText}”
                    <span className="rounded-full bg-[#D4AF37]/15 px-1.5 text-[9px] uppercase tracking-wider">{engravingFontLabel(i.engravingFont)}</span>
                  </p>
                )}
              </div>
            ))}
            <Separator className="my-2" />
            <p className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(placed.subtotal)}</span></p>
            {placed.couponDiscount > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span>Coupon {placed.couponCode}</span><span>−{formatINR(placed.couponDiscount)}</span></p>
            )}
            <p className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{placed.shipping === 0 ? "Free" : formatINR(placed.shipping)}</span></p>
            {placed.giftWrapFee > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span className="inline-flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Signature gift wrap</span><span>{formatINR(placed.giftWrapFee)}</span></p>
            )}
            {placed.engravingFee > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span className="inline-flex items-center gap-1"><PenLine className="h-3.5 w-3.5" /> Hand engraving</span><span>{formatINR(placed.engravingFee)}</span></p>
            )}
            <p className="flex justify-between text-muted-foreground"><span>GST</span><span>{formatINR(placed.tax)}</span></p>
            <p className="flex justify-between font-medium text-foreground"><span>Total</span><span>{formatINR(placed.total)}</span></p>
          </div>
          {placed.giftMessage && (
            <div className="mt-4 rounded-lg border border-[#D4AF37]/40 bg-[#FAF7F0] px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.35em] text-[#A8862A]">On the gift card</p>
              <p className="mt-1 font-serif text-sm italic leading-relaxed text-[#1C1A16]">“{placed.giftMessage}”</p>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" className="border-[#D4AF37]/50" onClick={() => navigate("track")}>Track this order</Button>
          <Button className="bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Continue shopping</Button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center px-4 pb-24 pt-40 text-center">
        <ShoppingBag className="mb-4 h-9 w-9 text-[#D4AF37]" strokeWidth={1.4} />
        <h1 className="font-serif text-3xl">Nothing to check out yet</h1>
        <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Explore the collection</Button>
      </div>
    );
  }

  const subtotal = cart.reduce((n, i) => n + netPrice(i.unitPrice, i.discountPercent) * i.quantity, 0);
  const shipping = settings ? (subtotal >= settings.freeShippingAbove ? 0 : settings.shippingFee) : 0;
  const taxRate = settings?.taxRatePercent ?? 3;
  const giftWrapFee = giftWrap ? (settings?.giftWrapFee ?? 0) : 0;
  const engravingEnabled = settings ? settings.engravingEnabled !== false : true;
  const engravedPieces = engravingEnabled ? cart.reduce((n, i) => n + (i.engravingText ? i.quantity : 0), 0) : 0;
  const engravingFee = engravedPieces * (settings?.engravingFee ?? 0);
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const tax = Math.round(((subtotal - couponDiscount) * taxRate) / 100);
  const total = subtotal - couponDiscount + shipping + tax + giftWrapFee + engravingFee;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponMsg(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponMsg({ tone: "err", text: data.error ?? "Could not check this coupon" });
        return;
      }
      if (!data.valid) {
        setCouponMsg({ tone: "err", text: data.error ?? "This coupon code isn't valid" });
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon(data.coupon);
      setCouponMsg({ tone: "ok", text: `${data.coupon.code} applied — you save ${formatINR(data.coupon.discountAmount)}` });
      toast.success(`${data.coupon.code} applied`);
    } catch {
      setCouponMsg({ tone: "err", text: "Network error — please try again" });
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMsg(null);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    setPlacing(true);
    setFields({});
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          couponCode: appliedCoupon?.code ?? "",
          giftWrap,
          giftMessage: giftWrap ? giftMessage.trim() : "",
          paymentMethod: method,
          items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, engravingText: i.engravingText ?? "", engravingFont: i.engravingFont ?? "" })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFields(data.fields ?? {});
        setError(data.error ?? "Could not place the order");
        toast.error(data.error ?? "Could not place the order");
        return;
      }
      const order: PlacedOrder = data.order;
      setPlaced(order);
      const url =
        method === "WHATSAPP" && settings
          ? waOrderMessage(
              settings as StoreSettingsDTO,
              order.orderNumber,
              cart,
              { subtotal: order.subtotal, shipping: order.shipping, tax: order.tax, total: order.total, couponCode: order.couponCode, discount: order.couponDiscount, giftWrap: order.giftWrap, giftWrapFee: order.giftWrapFee, giftMessage: order.giftMessage, engravingFee: order.engravingFee },
              { name: form.customerName, phone: form.phone, address: form.address, city: form.city, state: form.state, pincode: form.pincode }
            )
          : "";
      setWhatsappUrl(url);
      if (method === "WHATSAPP" && url) {
        window.open(url, "_blank");
      }
      clearCart();
    } catch {
      setError("Network error — please try again");
      toast.error("Network error — please try again");
    } finally {
      setPlacing(false);
    }
  };

  const tryRazorpay = async () => {
    const res = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview: true }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!data?.enabled) {
      toast.info("Online payments are being configured", {
        description: "Razorpay credentials aren't connected yet. WhatsApp checkout is fully available.",
      });
      setMethod("WHATSAPP");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <button onClick={() => navigate("cart")} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to bag
      </button>
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Almost yours</p>
        <h1 className="mt-2 font-serif text-4xl">Checkout</h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        {/* form */}
        <div className="space-y-8">
          <section className="rounded-xl border border-[#D4AF37]/25 bg-white p-6" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading" className="font-serif text-xl">Shipping details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={fields.customerName}>
                <Input value={form.customerName} onChange={set("customerName")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Ananya Sharma" autoComplete="name" />
              </Field>
              <Field label="Email" required error={fields.email}>
                <Input type="email" value={form.email} onChange={set("email")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Phone (WhatsApp preferred)" required error={fields.phone}>
                <Input value={form.phone} onChange={set("phone")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="+91 98XXX XXXXX" autoComplete="tel" />
              </Field>
              <Field label="PIN code" required error={fields.pincode}>
                <Input inputMode="numeric" value={form.pincode} onChange={set("pincode")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="400020" maxLength={6} autoComplete="postal-code" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Full address" required error={fields.address}>
                  <Textarea value={form.address} onChange={set("address")} rows={2} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Flat, building, street, landmark" autoComplete="street-address" />
                </Field>
              </div>
              <Field label="City" required error={fields.city}>
                <Input value={form.city} onChange={set("city")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Mumbai" autoComplete="address-level2" />
              </Field>
              <Field label="State" required error={fields.state}>
                <Input value={form.state} onChange={set("state")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Maharashtra" autoComplete="address-level1" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Order notes (optional)">
                  <Textarea value={form.notes} onChange={set("notes")} rows={2} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Gift wrap, engraving request, delivery timing…" />
                </Field>
              </div>
            </div>
          </section>

          {/* gift wrap + gift message */}
          <section className="rounded-xl border border-[#D4AF37]/25 bg-white p-6" aria-labelledby="gift-heading">
            <h2 id="gift-heading" className="font-serif text-xl">Finishing touches</h2>
            <label
              className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                giftWrap ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-border hover:border-[#D4AF37]/50"
              }`}
            >
              <Checkbox
                checked={giftWrap}
                onCheckedChange={(v) => setGiftWrap(v === true)}
                className="mt-0.5 border-[#D4AF37]/60 data-[state=checked]:border-[#D4AF37] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                aria-label="Add signature gift wrap"
              />
              <div className="flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Gift className="h-4 w-4 text-[#A8862A]" /> Signature gift wrap
                  <span className="ml-auto text-sm font-medium text-[#7a611f]">+{formatINR(settings?.giftWrapFee ?? 0)}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your piece arrives in our ivory linen box with a hand-tied gold ribbon, wax seal and a personalised note card — ready to gift, no price tags inside.
                </p>
              </div>
            </label>

            {/* gift-card message — appears once wrap is chosen */}
            {giftWrap && (
              <div className="mt-3 rounded-lg border border-[#D4AF37] bg-[#D4AF37]/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#A8862A]" />
                  <p className="font-medium">Message on the gift card</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">optional</span>
                </div>
                <div className="mt-3">
                  <Textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                    rows={3}
                    maxLength={200}
                    aria-label="Message on the gift card"
                    placeholder="e.g. For Amma — everything gold reminds me of you. Happy 60th."
                    className="border-[#D4AF37]/40 bg-white font-serif italic leading-relaxed"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Hand-written by our concierge on an ivory note card</span>
                    <span className={giftMessage.length >= 180 ? "font-medium text-[#7a611f]" : ""} aria-live="polite">{giftMessage.length}/200</span>
                  </div>
                </div>
                {/* live note-card preview */}
                {giftMessage.trim() && (
                  <div aria-hidden className="relative mt-3 overflow-hidden rounded-md border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF7F0] via-[#FBF6E9] to-[#F4EAD2] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <span aria-hidden className="absolute right-3 top-3 h-2 w-2 rotate-45 bg-[#D4AF37]/70" />
                    <p className="text-[9px] uppercase tracking-[0.35em] text-[#A8862A]">Gift card preview</p>
                    <p className="mt-1.5 break-words font-serif text-sm italic leading-relaxed text-[#1C1A16]">“{giftMessage.trim()}”</p>
                  </div>
                )}
              </div>
            )}

            {/* per-piece engraving — set on each product page, shown here so the guest can verify */}
            {engravingEnabled && (
              <div className={`mt-3 rounded-lg border p-4 ${cart.some((i: CartItem) => i.engravingText) ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <PenLine className="h-4 w-4 text-[#A8862A]" />
                  <p className="font-medium">Hand engraving by our master karigar</p>
                  {engravedPieces > 0 ? (
                    <span className="ml-auto text-sm font-medium text-[#7a611f]">
                      {engravedPieces} {engravedPieces === 1 ? "piece" : "pieces"} · {formatINR(engravingFee)}
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-muted-foreground">{settings ? `+${formatINR(settings.engravingFee)} / piece` : ""}</span>
                  )}
                </div>
                {cart.some((i: CartItem) => i.engravingText) ? (
                  <ul className="mt-3 space-y-2">
                    {cart.filter((i: CartItem) => i.engravingText).map((i: CartItem) => (
                      <li key={`${i.productId}-${i.variantId ?? "b"}-${i.engravingText}-${i.engravingFont ?? "SERIF"}`} className="flex items-center gap-2.5 rounded-md border border-[#D4AF37]/30 bg-white px-3 py-2">
                        <img src={i.image || "/images/brand/atelier.png"} alt="" className="h-8 w-8 rounded border border-border object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{i.name}{i.variantName ? ` · ${i.variantName}` : ""} × {i.quantity}</p>
                          <p className="truncate font-serif text-xs italic tracking-wider text-[#7a611f]">“{i.engravingText}”</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#D4AF37]/12 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#7a611f]">{engravingFontLabel(i.engravingFont)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    A name, date or promise — chased into the metal by hand. Add it from any product page under <span className="font-medium text-[#7a611f]">“Add hand engraving”</span>.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#D4AF37]/25 bg-white p-6" aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="font-serif text-xl">How would you like to order?</h2>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as "WHATSAPP" | "RAZORPAY")} className="mt-5 gap-4">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  method === "WHATSAPP" ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-border hover:border-[#D4AF37]/50"
                }`}
              >
                <RadioGroupItem value="WHATSAPP" className="mt-0.5" />
                <div>
                  <p className="flex items-center gap-2 font-medium"><MessageCircle className="h-4 w-4 text-[#128C4B]" /> Order via WhatsApp</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We create your order and pre-fill a WhatsApp message with everything — you review and press send. Our concierge confirms payment & delivery personally.
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  method === "RAZORPAY" ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-border hover:border-[#D4AF37]/50"
                }`}
                onClick={() => { setMethod("RAZORPAY"); tryRazorpay(); }}
              >
                <RadioGroupItem value="RAZORPAY" className="mt-0.5" />
                <div>
                  <p className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4 text-[#A8862A]" /> Pay online (Razorpay)</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    UPI, cards & netbanking via Razorpay. Secure signature-verified payments. {settings && !settings.razorpayEnabled && "· Currently being configured."}
                  </p>
                </div>
              </label>
            </RadioGroup>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#A8862A]" />
              Stock is reserved the moment your order is placed. No payment is taken until our concierge confirms your order.
            </div>
          </section>
        </div>

        {/* summary */}
        <aside className="h-fit rounded-xl border border-[#D4AF37]/25 bg-white p-6 lg:sticky lg:top-32">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#A8862A]">Almost yours</p>
          <h2 className="mt-1 font-serif text-xl">Your order</h2>
          <div className="mt-4 max-h-60 space-y-3 overflow-y-auto pr-1 scrollbar-elegant">
            {cart.map((item: CartItem) => {
              const unit = netPrice(item.unitPrice, item.discountPercent);
              return (
                <div key={`${item.productId}-${item.variantId ?? "b"}-${item.engravingText ?? ""}-${item.engravingFont ?? "SERIF"}`} className="flex items-center gap-3">
                  { }
                  <img src={item.image || "/images/brand/atelier.png"} alt={item.name} className="h-14 w-14 rounded-md border border-border object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-mono text-[10px]">{item.sku}</span>{item.variantName ? ` · ${item.variantName}` : ""} · Qty {item.quantity}</p>
                    {item.engravingText && (
                      <p className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/8 px-2 py-0.5 text-[10px] text-[#7a611f]">
                        <PenLine className="h-2.5 w-2.5 shrink-0" /> <span className="truncate font-serif italic tracking-wider">“{item.engravingText}”</span>
                        <span className="shrink-0 rounded-full bg-[#D4AF37]/15 px-1.5 text-[9px] uppercase tracking-wider">{engravingFontLabel(item.engravingFont)}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-sm">{formatINR(unit * item.quantity)}</p>
                </div>
              );
            })}
          </div>
          <Separator className="my-4" />
          <div className="text-sm">
            <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2"><span className="text-xs uppercase tracking-widest text-muted-foreground">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span></div>
            {couponDiscount > 0 && (
              <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2 text-[#7a611f]"><span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest"><Ticket className="h-3.5 w-3.5" /> {appliedCoupon?.code}</span><span className="font-medium">−{formatINR(couponDiscount)}</span></div>
            )}
            <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2"><span className="text-xs uppercase tracking-widest text-muted-foreground">Shipping</span><span className="font-medium">{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
            {giftWrapFee > 0 && (
              <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2 text-[#7a611f]"><span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest"><Gift className="h-3.5 w-3.5" /> Gift wrap</span><span className="font-medium">{formatINR(giftWrapFee)}</span></div>
            )}
            {engravingFee > 0 && (
              <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2 text-[#7a611f]"><span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest"><PenLine className="h-3.5 w-3.5" /> Engraving ×{engravedPieces}</span><span className="font-medium">{formatINR(engravingFee)}</span></div>
            )}
            <div className="flex items-baseline justify-between border-b border-[#D4AF37]/10 py-2"><span className="text-xs uppercase tracking-widest text-muted-foreground">GST ({taxRate}%)</span><span className="font-medium">{formatINR(tax)}</span></div>
            <div className="flex items-baseline justify-between pt-3"><span className="font-serif">Total</span><span className="font-serif text-xl text-[#0A0A0A]">{formatINR(total)}</span></div>
          </div>

          {/* coupon */}
          <div className="mt-5 rounded-lg border border-[#D4AF37]/30 bg-[#FAF7F0] p-3.5">
            <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-[#A8862A]">Have a coupon?</p>
            <div className="flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                placeholder="AURELIA10"
                disabled={!!appliedCoupon}
                className="h-10 border-[#D4AF37]/40 bg-white font-mono text-sm uppercase"
                aria-label="Coupon code"
              />
              {appliedCoupon ? (
                <Button variant="outline" size="sm" onClick={removeCoupon} className="h-10 shrink-0 border-destructive/40 text-destructive hover:bg-destructive hover:text-white">
                  Remove
                </Button>
              ) : (
                <Button size="sm" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()} className="h-10 shrink-0 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
                  {checkingCoupon ? "…" : "Apply"}
                </Button>
              )}
            </div>
            {couponMsg && (
              <p className={`mt-2 text-xs ${couponMsg.tone === "ok" ? "text-emerald-700" : "text-destructive"}`}>{couponMsg.text}</p>
            )}
            {!couponMsg && !appliedCoupon && (
              <p className="mt-2 text-[11px] text-muted-foreground">Launch offers: try <span className="font-mono">AURELIA10</span> on orders above ₹25,000.</p>
            )}
          </div>
          {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button onClick={placeOrder} disabled={placing} className="btn-shimmer mt-5 h-13 w-full bg-[#D4AF37] py-3.5 text-base font-medium text-black hover:bg-[#E6C87A]">
            {placing ? "Placing your order…" : method === "WHATSAPP" ? (<><Send className="mr-2 h-4 w-4" /> Place order & open WhatsApp</>) : "Place order"}
          </Button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            By placing this order you agree to our{" "}
            <button onClick={() => navigate("policy", { policy: "terms" })} className="underline underline-offset-2">Terms</button> and{" "}
            <button onClick={() => navigate("policy", { policy: "returns" })} className="underline underline-offset-2">Returns policy</button>.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-[#A8862A]">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
