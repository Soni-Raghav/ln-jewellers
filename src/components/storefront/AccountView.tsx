"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  Gem,
  Heart,
  Lock,
  Package,
  PenLine,
  Phone,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { formatINR, formatDate, waLink, engravingFontLabel } from "@/lib/format";
import type { AuthUser } from "@/lib/types";

interface AccountOrderItem {
  name: string;
  sku: string;
  variantName: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  engravingText: string | null;
  engravingFont: string | null;
}

interface AccountOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  giftWrap: boolean;
  engravingFee: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  items: AccountOrderItem[];
}

const STEPS = ["PLACED", "CONFIRMED", "IN_PRODUCTION", "SHIPPED", "DELIVERED"] as const;

function statusBadge(status: string) {
  if (status === "CANCELLED") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
        Cancelled
      </Badge>
    );
  }
  if (status === "DELIVERED") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Delivered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] text-[11px] text-[#8A6D1D]">
      {status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function paymentBadge(status: string) {
  if (status === "PAID") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Paid
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
      Unpaid
    </Badge>
  );
}

export default function AccountView() {
  const user = useApp((s) => s.user);
  const openAuth = useApp((s) => s.openAuth);
  const navigate = useApp((s) => s.navigate);

  // ---- Signed-out gate ----
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-36 text-center sm:px-6">
        <span className="mx-auto grid h-14 w-14 rotate-45 place-items-center border border-[#D4AF37]/60 bg-[#D4AF37]/5">
          <Lock className="h-6 w-6 -rotate-45 text-[#8A6D1F]" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-serif text-3xl text-foreground">Your private salon</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Sign in to follow every order, inscription and heirloom you have entrusted to LN Jewellers — all in one quiet place.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => openAuth("login")}
            className="btn-shimmer h-12 min-w-44 bg-[#D4AF37] px-6 text-[13px] font-semibold uppercase tracking-[0.2em] text-black hover:bg-[#E6C87A]"
          >
            <UserRound className="mr-2 h-4 w-4" /> Sign In
          </Button>
          <Button
            onClick={() => openAuth("register")}
            variant="outline"
            className="h-12 min-w-44 border-[#D4AF37]/50 px-6 text-[13px] uppercase tracking-[0.2em] text-[#8A6D1F] hover:bg-[#D4AF37]/10"
          >
            Create Account
          </Button>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Prefer to keep it casual?{" "}
          <button onClick={() => navigate("track")} className="text-[#8A6D1F] underline-offset-2 hover:underline">
            Track an order with its number
          </button>
        </p>
      </div>
    );
  }

  // AccountDashboard remounts per user (keyed above), so its fetch effect
  // runs once per session identity with no reset needed.
  return <AccountDashboard key={user.id} user={user} />;
}

function AccountDashboard({ user }: { user: AuthUser }) {
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);

  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/orders")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setOrders(d.orders ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user.name.trim().split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      {/* header */}
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#8A6D1F]">My Account</p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">
          Namaste, <span className="italic text-[#8A6D1F]">{firstName}</span>
        </h1>
        <div className="mx-auto mt-4 flex items-center justify-center gap-3" aria-hidden>
          <span className="h-px w-16 bg-[#D4AF37]/50" />
          <Gem className="h-3.5 w-3.5 rotate-45 text-[#D4AF37]" />
          <span className="h-px w-16 bg-[#D4AF37]/50" />
        </div>
      </header>

      {/* profile card */}
      <section aria-label="Profile" className="mx-auto mt-10 max-w-2xl rounded-xl border border-[#D4AF37]/25 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 font-serif text-xl text-[#8A6D1F]">
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl text-foreground">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
              <Heart className="mr-1 h-3 w-3" /> Member
            </Badge>
            <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
              {user.role === "ADMIN" ? "Atelier Admin" : "Client"}
            </Badge>
          </div>
        </div>
        <p className="mt-4 border-t border-[#D4AF37]/15 pt-3 text-xs leading-relaxed text-muted-foreground">
          Concierge care on every order — reach the atelier anytime on WhatsApp for sizing, engraving or gifting advice.
        </p>
      </section>

      {/* orders */}
      <section aria-label="Order history" className="mt-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#8A6D1F]">Order History</p>
            <h2 className="mt-1 font-serif text-2xl text-foreground">Your pieces & their journeys</h2>
          </div>
          <Button
            onClick={() => navigate("shop")}
            variant="outline"
            className="hidden h-10 border-[#D4AF37]/50 text-[#8A6D1F] hover:bg-[#D4AF37]/10 sm:inline-flex"
          >
            <ShoppingBag className="mr-2 h-4 w-4" /> Explore the Atelier
          </Button>
        </div>

        {orders === null && !failed && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-44 bg-muted" />
                  <Skeleton className="h-5 w-20 bg-muted" />
                </div>
                <Skeleton className="mt-4 h-4 w-2/3 bg-muted" />
                <Skeleton className="mt-2 h-4 w-1/3 bg-muted" />
              </div>
            ))}
          </div>
        )}

        {failed && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            We could not load your orders just now.{" "}
            <button onClick={() => navigate("home")} className="underline underline-offset-2">
              Return home
            </button>{" "}
            and try again in a moment.
          </div>
        )}

        {orders !== null && !failed && orders.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#D4AF37]/40 bg-[#FAF7F0] p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-[#D4AF37]" strokeWidth={1.5} />
            <p className="mt-4 font-serif text-xl text-foreground">No orders yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              When you place your first order it will appear here — from the workshop bench to your doorstep.
            </p>
            <Button
              onClick={() => navigate("shop")}
              className="btn-shimmer mt-6 h-11 bg-[#D4AF37] px-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-black hover:bg-[#E6C87A]"
            >
              Begin Your Collection
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {(orders ?? []).map((o) => {
            const isOpen = expanded === o.id;
            const cancelled = o.status === "CANCELLED";
            const stepIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);
            return (
              <motion.article
                key={o.id}
                layout
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
                  cancelled ? "border-red-200" : "border-[#D4AF37]/25"
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-[#D4AF37]/[0.04]"
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold tracking-wide text-foreground">{o.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)}{" "}
                      {o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "piece" : "pieces"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">{statusBadge(o.status)}{paymentBadge(o.paymentStatus)}</div>
                  <p className="font-serif text-lg text-[#8A6D1F]">{formatINR(o.total)}</p>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-[#D4AF37]/15 px-5 pb-5 pt-4">
                    {/* journey */}
                    {!cancelled ? (
                      <ol className="mb-5 flex flex-wrap items-center gap-y-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {STEPS.map((s, i) => {
                          const done = stepIdx >= i;
                          return (
                            <li key={s} className="flex items-center">
                              <span className={`inline-flex items-center gap-1.5 ${done ? "font-semibold text-[#8A6D1F]" : ""}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-[#D4AF37]" : "bg-[#D8D2C4]"}`} />
                                {s.replace(/_/g, " ")}
                              </span>
                              {i < STEPS.length - 1 && <span className={`mx-2 h-px w-5 sm:w-8 ${done && stepIdx > i ? "bg-[#D4AF37]" : "bg-[#E5E0D2]"}`} />}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="mb-4 text-xs text-red-600">This order was cancelled — the concierge will assist with any questions.</p>
                    )}

                    {/* items */}
                    <ul className="space-y-3">
                      {o.items.map((it, idx) => (
                        <li key={idx} className="flex items-center gap-3 rounded-lg border border-border/70 bg-[#FAF7F0] p-3">
                          <img
                            src={it.image || "/images/brand/atelier.png"}
                            alt={it.name}
                            className="h-14 w-14 rounded-md border border-border object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-[15px] text-foreground">{it.name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {it.sku}
                              {it.variantName ? ` · ${it.variantName}` : ""} · Qty {it.quantity}
                            </p>
                            {it.engravingText && (
                              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/[0.07] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[#8A6D1F]">
                                <PenLine className="h-3 w-3" /> {it.engravingText}
                                {it.engravingFont && it.engravingFont !== "SERIF" ? ` · ${engravingFontLabel(it.engravingFont)}` : ""}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground">{formatINR(it.lineTotal)}</p>
                        </li>
                      ))}
                    </ul>

                    {/* totals */}
                    <dl className="mt-4 space-y-1 border-t border-dashed border-[#D4AF37]/25 pt-3 text-sm text-muted-foreground">
                      <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(o.subtotal)}</dd></div>
                      {o.couponDiscount > 0 && (
                        <div className="flex justify-between text-[#7A5E14]"><dt>Coupon {o.couponCode}</dt><dd>−{formatINR(o.couponDiscount)}</dd></div>
                      )}
                      <div className="flex justify-between"><dt>Shipping</dt><dd>{o.shipping === 0 ? "Free" : formatINR(o.shipping)}</dd></div>
                      {o.engravingFee > 0 && (
                        <div className="flex justify-between"><dt>Hand engraving</dt><dd>{formatINR(o.engravingFee)}</dd></div>
                      )}
                      <div className="flex justify-between"><dt>GST</dt><dd>{formatINR(o.tax)}</dd></div>
                      <div className="flex justify-between border-t border-[#D4AF37]/25 pt-2 font-serif text-base text-foreground">
                        <dt>Total</dt><dd>{formatINR(o.total)}</dd>
                      </div>
                    </dl>

                    {/* actions */}
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Button
                        onClick={() => navigate("invoice", { orderNumber: o.orderNumber, orderEmail: o.email })}
                        variant="outline"
                        className="h-10 border-[#D4AF37]/50 text-[12px] uppercase tracking-[0.15em] text-[#8A6D1F] hover:bg-[#D4AF37]/10"
                      >
                        View Invoice
                      </Button>
                      <a
                        href={waLink(
                          settings?.whatsappNumber || "919876543210",
                          `Hello LN Jewellers! ◆ I would like to ask about my order ${o.orderNumber}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center rounded-md border border-[#D4AF37]/50 px-4 text-[12px] uppercase tracking-[0.15em] text-[#8A6D1F] transition-colors hover:bg-[#D4AF37]/10"
                      >
                        <Phone className="mr-2 h-4 w-4" /> WhatsApp Concierge
                      </a>
                    </div>
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>

        {orders !== null && orders.length > 0 && (
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> Insured, tracked shipping on every order — questions? The concierge is one WhatsApp away.
          </p>
        )}
      </section>
    </div>
  );
}
