"use client";

/**
 * AnnouncementBar — rotating luxury promo strip above the navbar.
 *
 * Messages:
 *  1. Evergreen trust line (BIS hallmark · free insured shipping · WhatsApp ordering)
 *  2. One line per active, non-exhausted coupon — with a "copy code" chip.
 *
 * Rotates every 5.5s (pauses on hover), static when the user prefers reduced motion.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, TicketPercent } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatINR } from "@/lib/format";
import type { PublicCouponDTO } from "@/lib/types";

interface Message {
  key: string;
  node: React.ReactNode;
}

function couponText(c: PublicCouponDTO): string {
  const off = c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;
  const min = c.minSubtotal > 0 ? ` orders above ${formatINR(c.minSubtotal)}` : " your first order";
  return `${off}${min}`;
}

export default function AnnouncementBar() {
  const settings = useApp((s) => s.settings);
  const [coupons, setCoupons] = useState<PublicCouponDTO[]>([]);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coupons/active")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setCoupons(d.coupons ?? []);
      })
      .catch(() => {
        /* announcement stays evergreen on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freeShip = settings ? settings.freeShippingAbove : 50000;

  const messages: Message[] = [
    {
      key: "evergreen",
      node: (
        <span>
          BIS Hallmarked · Free insured shipping above {formatINR(freeShip)} · Order on WhatsApp
        </span>
      ),
    },
    ...coupons.map((c) => ({
      key: `coupon-${c.code}`,
      node: (
        <span className="inline-flex flex-wrap items-center justify-center gap-2">
          <TicketPercent className="size-3.5 -translate-y-px" aria-hidden />
          <span>
            <span className="font-semibold text-[#F3E2B3]">{c.code}</span> · {couponText(c)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard
                .writeText(c.code)
                .then(() => toast.success(`Code ${c.code} copied — apply it at checkout`))
                .catch(() => toast.error("Could not copy the code"));
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 px-2.5 py-0.5 text-[9px] tracking-[0.2em] transition-colors hover:bg-[#D4AF37] hover:text-black"
            aria-label={`Copy coupon code ${c.code}`}
          >
            <Copy className="size-2.5" aria-hidden /> COPY CODE
          </button>
        </span>
      ),
    })),
  ];

  const tick = useCallback(() => {
    if (!pausedRef.current && messages.length > 1) {
      setIndex((i) => (i + 1) % messages.length);
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = setInterval(tick, 5500);
    return () => clearInterval(t);
  }, [messages.length, tick]);

  const current = messages[index % Math.max(messages.length, 1)];

  return (
    <div
      className="hidden bg-[#0A0A0A] text-[#E6C87A] sm:block"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      role="region"
      aria-label="Store announcements"
    >
      <div className="border-b border-[#D4AF37]/20 py-1.5 text-center text-[11px] uppercase tracking-[0.25em]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current?.key ?? "evergreen"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="px-4"
          >
            {current?.node}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
