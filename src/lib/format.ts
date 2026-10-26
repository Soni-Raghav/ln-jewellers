import type { CartItem, EngravingFont, Product, StoreSettingsDTO } from "@/lib/types";

// ---------- Formatting ----------
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------- Engraving lettering styles ----------
// The karigar offers three hands. Script maps to system cursive faces so no
// webfont/network dependency is introduced (graceful fallback to `cursive`).
export const ENGRAVING_FONTS: Record<EngravingFont, { label: string; wa: string; sample: string; className: string; style?: React.CSSProperties }> = {
  SERIF: {
    label: "Classic Serif",
    wa: "classic serif",
    sample: "Aa",
    className: "font-serif italic uppercase tracking-[0.2em]",
  },
  SCRIPT: {
    label: "Elegant Script",
    wa: "elegant script",
    sample: "Aa",
    className: "text-xl",
    style: { fontFamily: "'Snell Roundhand', 'Savoye LET', 'Apple Chancery', 'Segoe Script', 'Brush Script MT', cursive" },
  },
  SANS: {
    label: "Modern Sans",
    wa: "modern sans",
    sample: "Aa",
    className: "font-sans uppercase tracking-[0.3em]",
  },
};

export const ENGRAVING_FONT_ORDER: EngravingFont[] = ["SERIF", "SCRIPT", "SANS"];

/** Per-hand engraving fee — the atelier prices each lettering style separately
 *  (script's flowing curves take the karigar longer than the classic serif hand).
 *  Falls back to the base fee when a style-specific fee is missing. */
export function engravingFeeFor(
  settings: Pick<StoreSettingsDTO, "engravingFee" | "engravingFeeScript" | "engravingFeeSans"> | null | undefined,
  font: EngravingFont | string | null | undefined
): number {
  const s = settings;
  if (!s) return 0;
  const base = Math.max(0, s.engravingFee ?? 0);
  switch (font) {
    case "SCRIPT":
      return Math.max(0, s.engravingFeeScript ?? base);
    case "SANS":
      return Math.max(0, s.engravingFeeSans ?? base);
    default:
      return base; // SERIF (and any legacy value) — classic hand
  }
}

/** Client-side engraving estimate across cart lines, honouring per-hand fees:
 *  every engraved unit is chased by hand, so the style's fee applies per piece. */
export function engravingTotals(
  items: Pick<CartItem, "engravingText" | "engravingFont" | "quantity">[],
  settings: Pick<StoreSettingsDTO, "engravingFee" | "engravingFeeScript" | "engravingFeeSans"> | null | undefined
): { pieces: number; fee: number } {
  let pieces = 0;
  let fee = 0;
  for (const it of items) {
    if (!it.engravingText) continue;
    pieces += it.quantity;
    fee += it.quantity * engravingFeeFor(settings, it.engravingFont ?? "SERIF");
  }
  return { pieces, fee };
}

/** Human label for a stored font value — unknown/legacy values fall back to classic serif. */
export function engravingFontLabel(font: string | null | undefined): string {
  const key = (font as EngravingFont) ?? "SERIF";
  return ENGRAVING_FONTS[key]?.label ?? ENGRAVING_FONTS.SERIF.label;
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Mon, 13 Oct 2026" — for appointment books and confirmations. */
export function formatLongDate(yyyyMmDd: string | Date): string {
  // Date-only strings must not shift with the local timezone.
  const d = typeof yyyyMmDd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)
    ? new Date(`${yyyyMmDd}T12:00:00`)
    : new Date(yyyyMmDd);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function netPrice(price: number, discountPercent: number): number {
  const d = Math.min(Math.max(discountPercent, 0), 90);
  return Math.round(price * (1 - d / 100));
}

// ---------- WhatsApp ----------
export function waLink(number: string, message: string): string {
  const digits = (number || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function waProductInquiry(
  settings: Pick<StoreSettingsDTO, "whatsappNumber">,
  product: Pick<Product, "name" | "sku" | "slug">,
  opts?: { variantName?: string | null; quantity?: number; price?: number }
): string {
  const lines = [
    `Hello ${"LN Jewellers"}! ◆`,
    ``,
    `I'm interested in this piece from your website:`,
    `• *${product.name}*`,
    `• SKU: ${product.sku}`,
  ];
  if (opts?.variantName) lines.push(`• Option: ${opts.variantName}`);
  if (opts?.quantity && opts.quantity > 1) lines.push(`• Quantity: ${opts.quantity}`);
  if (opts?.price) lines.push(`• Price: ${formatINR(opts.price)}`);
  lines.push(``, `Could you share availability and details?`);
  lines.push(``, `Product link: ${typeof window !== "undefined" ? window.location.origin + window.location.pathname + "#/product/" + product.slug : ""}`);
  return waLink(settings.whatsappNumber, lines.join("\n"));
}

export function waGeneralInquiry(
  settings: Pick<StoreSettingsDTO, "whatsappNumber"> & Partial<Pick<StoreSettingsDTO, "whatsappDefaultMessage">>
): string {
  // Store owners can set their own concierge opener (Admin → Store Settings →
  // Social & Reviews); empty falls back to the built-in greeting.
  const custom = (settings.whatsappDefaultMessage ?? "").trim();
  return waLink(
    settings.whatsappNumber,
    custom || `Hello LN Jewellers! ◆\n\nI'd love to know more about your handcrafted jewelry collections.`
  );
}

type WaTotals = {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode?: string | null;
  discount?: number;
  giftWrap?: boolean;
  giftWrapFee?: number;
  giftMessage?: string | null;
  engravingText?: string | null; // legacy order-level inscription
  engravingFee?: number;
  engravingFont?: string | null;
};

function waTotalsLines(totals: WaTotals): string[] {
  const lines = [
    `Subtotal: ${formatINR(totals.subtotal)}`,
  ];
  if (totals.discount && totals.discount > 0 && totals.couponCode) {
    lines.push(`Coupon (${totals.couponCode}): −${formatINR(totals.discount)}`);
  }
  lines.push(
    `Shipping: ${totals.shipping === 0 ? "Free" : formatINR(totals.shipping)}`
  );
  if (totals.giftWrap && totals.giftWrapFee && totals.giftWrapFee > 0) {
    lines.push(`Signature gift wrap: ${formatINR(totals.giftWrapFee)}`);
  }
  if (totals.engravingText && totals.engravingFee && totals.engravingFee > 0) {
    lines.push(`Engraving ("${totals.engravingText}" in ${engravingFontLabel(totals.engravingFont).toLowerCase()}): ${formatINR(totals.engravingFee)}`);
  } else if (!totals.engravingText && totals.engravingFee && totals.engravingFee > 0) {
    lines.push(`Hand engraving (per piece, as listed): ${formatINR(totals.engravingFee)}`);
  }
  lines.push(
    `GST (${3}%): ${formatINR(totals.tax)}`,
    `*Total: ${formatINR(totals.total)}*`
  );
  return lines;
}

export function waCartInquiry(
  settings: Pick<StoreSettingsDTO, "whatsappNumber">,
  items: CartItem[],
  totals: WaTotals
): string {
  const lines = [
    `Hello LN Jewellers! ◆`,
    ``,
    `I'd like to place an order / inquire about these pieces:`,
    ``,
  ];
  items.forEach((it, i) => {
    const variant = it.variantName ? ` (${it.variantName})` : "";
    lines.push(
      `${i + 1}. *${it.name}*${variant}\n   SKU: ${it.sku} · Qty: ${it.quantity} · ${formatINR(
        netPrice(it.unitPrice, it.discountPercent) * it.quantity
      )}`
    );
  });
  lines.push(``, ...waTotalsLines(totals), ``, `Please confirm availability and next steps. Thank you!`);
  return waLink(settings.whatsappNumber, lines.join("\n"));
}

export function waOrderMessage(
  settings: Pick<StoreSettingsDTO, "whatsappNumber">,
  orderNumber: string,
  items: CartItem[],
  totals: WaTotals,
  customer: { name: string; phone: string; address: string; city: string; state: string; pincode: string }
): string {
  const lines = [
    `Hello LN Jewellers! ◆`,
    ``,
    `I've just placed order *${orderNumber}* on your website and would like to confirm it:`,
    ``,
  ];
  items.forEach((it, i) => {
    const variant = it.variantName ? ` (${it.variantName})` : "";
    lines.push(`${i + 1}. ${it.name}${variant} × ${it.quantity} — ${formatINR(netPrice(it.unitPrice, it.discountPercent) * it.quantity)}`);
    if (it.engravingText)
      lines.push(`   ↳ engrave: “${it.engravingText}” in ${engravingFontLabel(it.engravingFont).toLowerCase()}`);
  });
  lines.push(
    ``,
    ...waTotalsLines(totals),
    ``,
    `Ship to:`,
    `${customer.name}, ${customer.phone}`,
    `${customer.address}, ${customer.city}, ${customer.state} – ${customer.pincode}`,
    ``,
    `Please confirm my order. Thank you!${totals.giftWrap ? " Please include the signature gift wrap." : ""}${totals.giftMessage ? ` Gift card: “${totals.giftMessage}”` : ""}${totals.engravingText ? ` Please engrave: “${totals.engravingText}”.` : ""}`
  );
  return waLink(settings.whatsappNumber, lines.join("\n"));
}

// ---------- Misc ----------
export function parseJsonArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function stockLabel(stock: number, track: boolean, threshold: number): { label: string; tone: "in" | "low" | "out" } {
  if (!track) return { label: "Made to order", tone: "in" };
  if (stock <= 0) return { label: "Out of stock", tone: "out" };
  if (stock <= threshold) return { label: `Only ${stock} left`, tone: "low" };
  return { label: "In stock", tone: "in" };
}
