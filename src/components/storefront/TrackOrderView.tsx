"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, CheckCircle2, Circle, Clock, Truck, Factory, Home, ReceiptText, Gift, PenLine, XCircle, X } from "lucide-react";
import { formatINR, formatDate, engravingFontLabel } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface TrackedOrder {
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
  cancelRequested?: boolean;
  cancelReason?: string | null;
  cancelRequestedAt?: string | null;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  items: { name: string; sku: string; variantName: string | null; image: string | null; quantity: number; lineTotal: number; engravingText?: string | null; engravingFont?: string | null }[];
}

const STAGES = [
  { key: "PLACED", label: "Order placed", icon: CheckCircle2 },
  { key: "CONFIRMED", label: "Confirmed", icon: Circle },
  { key: "IN_PRODUCTION", label: "In production", icon: Factory },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: Home },
];

export default function TrackOrderView() {
  const navigate = useApp((s) => s.navigate);
  const user = useApp((s) => s.user);
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFields, setCancelFields] = useState<Record<string, string>>({});
  const [cancelSending, setCancelSending] = useState(false);

  const track = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!orderNumber.trim() || !email.trim()) {
      setError("Please enter both your order number and email");
      return;
    }
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber.trim().toUpperCase())}?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Order not found");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const stageIdx = order ? Math.max(0, STAGES.findIndex((s) => s.key === order.status)) : -1;
  const cancelled = order?.status === "CANCELLED";
  const cancelEligible =
    !!order &&
    !cancelled &&
    !order.cancelRequested &&
    ["PLACED", "CONFIRMED", "IN_PRODUCTION"].includes(order.status);

  const submitCancelRequest = async () => {
    if (!order) return;
    setCancelSending(true);
    setCancelFields({});
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: order.email, reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelFields(data.fields ?? {});
        toast.error(data.error ?? "Could not submit your request");
        return;
      }
      toast.success(data.message ?? "Cancellation request received");
      setCancelDialogOpen(false);
      setCancelReason("");
      setOrder((prev) =>
        prev ? { ...prev, cancelRequested: true, cancelReason: prev.cancelReason ?? cancelReason, cancelRequestedAt: new Date().toISOString() } : prev
      );
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setCancelSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:px-6">
      {/* Print-only invoice letterhead (visible only when printing) */}
      {order && (
        <div className="print-invoice hidden">
          <div className="flex items-start justify-between border-b-2 border-[#D4AF37] pb-4">
            <div>
              <p className="font-serif text-2xl font-semibold">LN Jewellers</p>
              <p className="text-xs text-[#5A544A]">Handcrafted 22K &amp; 18K gold jewelry · Jaipur, India</p>
              <p className="text-xs text-[#5A544A]">hello@lnjewellers.com · +91 98765 43210</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#A8862A]">Tax invoice</p>
              <p className="font-mono text-sm">{order.orderNumber}</p>
              <p className="text-xs text-[#5A544A]">{formatDate(order.createdAt)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Billed to</p>
              <p className="font-medium text-[#1C1A16]">{order.customerName}</p>
              <p className="text-[#5A544A]">{order.address}</p>
              <p className="text-[#5A544A]">{order.city}, {order.state} – {order.pincode}</p>
              <p className="text-[#5A544A]">{order.phone}</p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Payment</p>
              <p className="text-[#5A544A]">{order.paymentMethod === "WHATSAPP" ? "WhatsApp concierge" : "Online (Razorpay)"} · {order.paymentStatus}</p>
            </div>
          </div>
        </div>
      )}
      <header className="mb-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Where is my jewelry?</p>
        <h1 className="mt-2 font-serif text-4xl">Track Your Order</h1>
      </header>

      <form onSubmit={track} className="rounded-xl border border-[#D4AF37]/25 bg-white p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Order number</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="LN-20250101-XXXXX" className="border-[#D4AF37]/40 bg-[#FAF7F0] uppercase" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Email used at checkout</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="border-[#D4AF37]/40 bg-[#FAF7F0]" />
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-5 h-12 w-full bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
          {loading ? "Looking for your order…" : "Track order"}
        </Button>
      </form>

      {loading && (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-2/3 bg-muted" />
          <Skeleton className="h-20 w-full bg-muted" />
          <Skeleton className="h-20 w-full bg-muted" />
        </div>
      )}

      {order && (
        <section className="mt-8 rounded-xl border border-[#D4AF37]/25 bg-white p-6 sm:p-8" aria-label="Order details">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">{order.orderNumber}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)} · {order.paymentMethod === "WHATSAPP" ? "WhatsApp checkout" : "Online payment"}</p>
            </div>
            <span className={`rounded-full px-3.5 py-1.5 text-xs font-medium uppercase tracking-widest ${
              cancelled ? "bg-destructive/10 text-destructive" : "bg-[#D4AF37]/15 text-[#7a611f]"
            }`}>
              {order.status.replace("_", " ")} · {order.paymentStatus}
            </span>
          </div>

          {/* timeline */}
          {!cancelled && (
            <ol className="mt-8 flex items-start justify-between">
              {STAGES.map((s, i) => {
                const done = i <= stageIdx;
                const active = i === stageIdx;
                return (
                  <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
                    {i > 0 && (
                      <span className={`absolute right-1/2 top-5 h-0.5 w-full ${i <= stageIdx ? "bg-[#D4AF37]" : "bg-border"}`} aria-hidden />
                    )}
                    <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 ${
                      done ? "border-[#D4AF37] bg-[#D4AF37] text-black" : "border-border bg-white text-muted-foreground"
                    } ${active && i === stageIdx ? "ring-4 ring-[#D4AF37]/25" : ""}`}>
                      <s.icon className={`h-4 w-4 ${done && s.key === "PLACED" ? "fill-black/0" : ""}`} strokeWidth={1.8} />
                    </span>
                    <span className={`mt-2 text-[11px] ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {cancelled && (
            <p className="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              This order was cancelled. If you were charged, our team will confirm your refund via WhatsApp.
            </p>
          )}
          {order.cancelRequested && !cancelled && (
            <div className="mt-6 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3" role="status">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <XCircle className="h-4 w-4 shrink-0" /> Cancellation requested
                {order.cancelRequestedAt && (
                  <span className="text-xs font-normal text-amber-700/80">· {formatDate(order.cancelRequestedAt)}</span>
                )}
              </p>
              {order.cancelReason && (
                <p className="mt-1 text-xs italic text-amber-700">“{order.cancelReason}”</p>
              )}
              <p className="mt-1 text-xs leading-relaxed text-amber-700/90">
                Your request is with our concierge — we&apos;ll call to confirm. Your piece stays reserved for you until
                then; no charge is made until production begins.
              </p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                { }
                <img src={i.image || "/images/brand/atelier.png"} alt={i.name} className="h-14 w-14 rounded-md border border-border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.sku}{i.variantName ? ` · ${i.variantName}` : ""} · Qty {i.quantity}</p>
                  {(i.engravingText) && (
                    <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/8 px-2 py-0.5 text-[11px] text-[#7a611f]">
                      <PenLine className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate font-serif italic tracking-wider">“{i.engravingText}”</span>
                      <span className="shrink-0 rounded-full bg-[#D4AF37]/15 px-1.5 text-[9px] uppercase tracking-wider">{engravingFontLabel(i.engravingFont)}</span>
                    </p>
                  )}
                </div>
                <p className="text-sm font-medium">{formatINR(i.lineTotal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
            <p className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></p>
            {!!order.couponDiscount && order.couponDiscount > 0 && order.couponCode && (
              <p className="flex justify-between text-[#7a611f]"><span>Coupon {order.couponCode}</span><span>−{formatINR(order.couponDiscount)}</span></p>
            )}
            <p className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</span></p>
            {!!order.giftWrap && !!order.giftWrapFee && order.giftWrapFee > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span className="inline-flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Signature gift wrap</span><span>{formatINR(order.giftWrapFee)}</span></p>
            )}
            {!!order.engravingText && !!order.engravingFee && order.engravingFee > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span className="inline-flex items-center gap-1"><PenLine className="h-3.5 w-3.5" /> Engraving “{order.engravingText}”</span><span>{formatINR(order.engravingFee)}</span></p>
            )}
            {!order.engravingText && !!order.engravingFee && order.engravingFee > 0 && (
              <p className="flex justify-between text-[#7a611f]"><span className="inline-flex items-center gap-1"><PenLine className="h-3.5 w-3.5" /> Hand engraving</span><span>{formatINR(order.engravingFee)}</span></p>
            )}
            <p className="flex justify-between text-muted-foreground"><span>GST</span><span>{formatINR(order.tax)}</span></p>
            <p className="flex justify-between text-base font-medium"><span>Total</span><span className="font-serif text-lg">{formatINR(order.total)}</span></p>
          </div>
          {order.engravingText && (
            <p className="mt-3 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-3 py-2 text-sm text-[#7a611f]">
              <span className="inline-flex flex-wrap items-center gap-1.5"><PenLine className="h-3.5 w-3.5 shrink-0" /> Hand-engraving request: <span className="font-serif italic tracking-wider">“{order.engravingText}”</span> — our karigar confirms placement before crafting.</span>
            </p>
          )}
          {order.giftMessage && (
            <div className="relative mt-3 overflow-hidden rounded-lg border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF7F0] via-[#FBF6E9] to-[#F4EAD2] px-4 py-3">
              <span aria-hidden className="absolute right-3 top-3 h-2 w-2 rotate-45 bg-[#D4AF37]/70" />
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.35em] text-[#A8862A]"><Gift className="h-3 w-3" /> On the gift card</p>
              <p className="mt-1 font-serif text-sm italic leading-relaxed text-[#1C1A16]">“{order.giftMessage}”</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3 print:hidden">
            <Button
              variant="outline"
              onClick={() => navigate("invoice", { orderNumber: order.orderNumber, orderEmail: order.email })}
              className="border-[#D4AF37]/50 text-[#7a611f] hover:bg-[#D4AF37]/10 hover:text-[#7a611f]"
            >
              <ReceiptText className="mr-2 h-4 w-4" /> View / print invoice
            </Button>
            {cancelEligible && (
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <XCircle className="mr-2 h-4 w-4" /> Request cancellation
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate("shop")}
              className="border-border text-foreground hover:bg-[#D4AF37]/10"
            >
              Continue shopping
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground print:hidden">
            <Clock className="h-3.5 w-3.5" /> Questions about this order? Message us on WhatsApp — concierge replies within business hours.
          </p>
        </section>
      )}

      {!order && !loading && (
        <div className="mt-8 rounded-xl border border-dashed border-[#D4AF37]/30 bg-white/50 p-6 text-center text-sm text-muted-foreground">
          <PackageSearch className="mx-auto mb-2 h-6 w-6 text-[#D4AF37]" />
          Your order number is in the confirmation shown after checkout (it starts with <span className="font-mono">LN-</span>).
        </div>
      )}

      {/* request-cancellation dialog */}
      {order && (
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="border-[#D4AF37]/30 bg-[#FAF7F0] sm:max-w-md">
            <DialogHeader>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">Change of heart?</p>
              <DialogTitle className="font-serif">Request cancellation of {order.orderNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tell us briefly why — our concierge will call to confirm before anything is changed. Orders already in
                production may involve making charges as per our policy.
              </p>
              <div>
                <label htmlFor="cancel-reason" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Reason *
                </label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Gift date changed, found another piece…"
                  rows={3}
                  maxLength={300}
                  className="border-[#D4AF37]/40 bg-white"
                />
                {cancelFields.reason && <p className="mt-1 text-xs text-destructive">{cancelFields.reason}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => void submitCancelRequest()}
                  disabled={cancelSending}
                  className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                >
                  <XCircle className="mr-2 h-4 w-4" /> {cancelSending ? "Sending…" : "Submit request"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCancelDialogOpen(false)}
                  className="h-11 border-border text-foreground hover:bg-[#D4AF37]/10"
                >
                  <X className="mr-1.5 h-4 w-4" /> Keep order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="mt-8 text-center">
        <Button variant="ghost" onClick={() => navigate("contact")} className="text-[#A8862A] hover:bg-[#D4AF37]/10">
          Can&apos;t find your order? Contact us
        </Button>
      </div>
    </div>
  );
}
