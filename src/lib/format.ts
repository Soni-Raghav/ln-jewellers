import type { CartItem, Product, StoreSettingsDTO } from "@/lib/types";

// ---------- Formatting ----------
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-IN", {
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
    `Hello ${"Aurelia Jewels"}! ◆`,
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

export function waGeneralInquiry(settings: Pick<StoreSettingsDTO, "whatsappNumber">): string {
  return waLink(
    settings.whatsappNumber,
    `Hello Aurelia Jewels! ◆\n\nI'd love to know more about your handcrafted jewelry collections.`
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
  engravingText?: string | null;
  engravingFee?: number;
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
    lines.push(`Engraving ("${totals.engravingText}"): ${formatINR(totals.engravingFee)}`);
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
    `Hello Aurelia Jewels! ◆`,
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
    `Hello Aurelia Jewels! ◆`,
    ``,
    `I've just placed order *${orderNumber}* on your website and would like to confirm it:`,
    ``,
  ];
  items.forEach((it, i) => {
    const variant = it.variantName ? ` (${it.variantName})` : "";
    lines.push(`${i + 1}. ${it.name}${variant} × ${it.quantity} — ${formatINR(netPrice(it.unitPrice, it.discountPercent) * it.quantity)}`);
  });
  lines.push(
    ``,
    ...waTotalsLines(totals),
    ``,
    `Ship to:`,
    `${customer.name}, ${customer.phone}`,
    `${customer.address}, ${customer.city}, ${customer.state} – ${customer.pincode}`,
    ``,
    `Please confirm my order. Thank you!${totals.giftWrap ? " Please include the signature gift wrap." : ""}${totals.engravingText ? ` Please engrave: \u201c${totals.engravingText}\u201d.` : ""}`
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
