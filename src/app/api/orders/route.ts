import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, isEmail, isNonEmpty, isPhone, sanitize, toAsciiDigits } from "@/lib/api-utils";
import { ADDRESS_MIN_LENGTH } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { formatINR } from "@/lib/format";
import { validateCoupon } from "@/lib/coupons";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

interface IncomingItem {
  productId?: unknown;
  variantId?: unknown;
  quantity?: unknown;
  engravingText?: unknown;
  engravingFont?: unknown;
}

function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `LN-${ymd}-${rand}`;
}

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`order:${clientIp(req)}`, 10, 10 * 60_000)) return tooMany();

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.items) || body.items.length === 0)
      return badRequest("Your cart is empty");

    const customerName = sanitize(body.customerName).slice(0, 80);
    const email = sanitize(body.email).toLowerCase().slice(0, 120);
    const phone = sanitize(body.phone).slice(0, 20);
    const address = sanitize(body.address).slice(0, 300);
    const city = sanitize(body.city).slice(0, 80);
    const state = sanitize(body.state).slice(0, 80);
    const pincode = toAsciiDigits(sanitize(body.pincode)).slice(0, 10);
    const notes = sanitize(body.notes).slice(0, 500);
    const giftWrap = !!body.giftWrap;
    const giftMessage = sanitize(body.giftMessage).slice(0, 200);
    const paymentMethod = body.paymentMethod === "RAZORPAY" ? "RAZORPAY" : "WHATSAPP";
    const couponCodeRaw = sanitize(body.couponCode).toUpperCase().slice(0, 30);

    const fields: Record<string, string> = {};
    if (!isNonEmpty(customerName, 80)) fields.customerName = "Full name is required";
    if (!isEmail(email)) fields.email = "Valid email is required";
    if (!isPhone(phone)) fields.phone = "Valid phone number is required";
    if (!isNonEmpty(address, 300) || address.length < ADDRESS_MIN_LENGTH)
      fields.address = "Please enter your full delivery address (house no., street, area)";
    if (!isNonEmpty(city, 80)) fields.city = "City is required";
    if (!isNonEmpty(state, 80)) fields.state = "State is required";
    if (!/^\d{6}$/.test(pincode)) fields.pincode = "6-digit PIN code required";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    // ---- Load settings for shipping/tax ----
    const settings = await db.storeSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) return badRequest("Store is not configured yet");
    const shippingFee = settings.shippingFee;
    const freeAbove = settings.freeShippingAbove;
    const taxRate = settings.taxRatePercent;

    // ---- Recalculate EVERYTHING server-side. Never trust the client. ----
    const ENGRAVING_FONTS = ["SERIF", "SCRIPT", "SANS"] as const;
    const incoming: { productId: string; variantId: string | null; quantity: number; engravingText: string; engravingFont: string }[] = [];
    for (const raw of body.items.slice(0, 30) as IncomingItem[]) {
      const productId = sanitize(raw.productId).slice(0, 40);
      const variantId = raw.variantId ? sanitize(raw.variantId).slice(0, 40) : null;
      const quantity = Math.trunc(Number(raw.quantity));
      const engravingText = sanitize(raw.engravingText).slice(0, 60);
      // Lettering style is chosen per piece; anything unknown falls back to classic serif.
      const engravingFont = ENGRAVING_FONTS.includes(raw.engravingFont as (typeof ENGRAVING_FONTS)[number])
        ? (raw.engravingFont as string)
        : "SERIF";
      if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 20)
        return badRequest("Invalid item quantity");
      if (engravingText && !/[A-Za-z0-9]/.test(engravingText))
        return badRequest("Engraving must contain letters or numbers");
      incoming.push({ productId, variantId, quantity, engravingText, engravingFont });
    }

    const productIds = [...new Set(incoming.map((i) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED" },
      include: { variants: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    type Line = {
      productId: string;
      variantId: string | null;
      name: string;
      sku: string;
      variantName: string | null;
      image: string | null;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      engravingText: string | null;
      engravingFont: string | null;
      stockSource: { kind: "product" | "variant"; stock: number; track: boolean };
    };

    const lines: Line[] = [];
    for (const item of incoming) {
      const p = productMap.get(item.productId);
      if (!p) return badRequest("Some items in your cart are no longer available");
      const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId && v.active) : null;
      if (item.variantId && !variant) return badRequest(`Selected option for "${p.name}" is unavailable`);

      const base = p.price + (variant?.priceDelta ?? 0);
      const discount = Math.min(Math.max(p.discountPercent, 0), 90);
      const unitPrice = Math.round(base * (1 - discount / 100));
      const images = JSON.parse(p.images || "[]") as string[];

      const track = variant ? true : p.trackInventory;
      const stock = variant ? variant.stock : p.stock;
      if (track && stock < item.quantity) {
        return badRequest(
          stock === 0
            ? `"${p.name}" is out of stock`
            : `Only ${stock} left of "${p.name}"${variant ? ` (${variant.name})` : ""}`
        );
      }

      lines.push({
        productId: p.id,
        variantId: variant?.id ?? null,
        name: p.name,
        sku: p.sku,
        variantName: variant?.name ?? null,
        image: images[0] ?? null,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        engravingText: null, // filled in below once engraving settings are known
        engravingFont: null,
        stockSource: { kind: variant ? "variant" : "product", stock, track },
      });
    }

    const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

    // ---- Coupon: authoritatively re-validated server-side ----
    let couponDiscount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCodeRaw) {
      const result = await validateCoupon(couponCodeRaw, subtotal);
      if (!result.valid || !result.coupon) return badRequest(result.error ?? "Coupon is not valid");
      couponDiscount = result.coupon.discountAmount;
      appliedCouponCode = result.coupon.code;
    }

    const shipping = subtotal >= freeAbove ? 0 : shippingFee;
    const tax = Math.round(((subtotal - couponDiscount) * taxRate) / 100);
    // Gift wrap, gift message and engraving fees are controlled by the atelier, never by the client.
    const giftWrapFee = giftWrap ? Math.max(0, settings.giftWrapFee ?? 0) : 0;
    const finalGiftMessage = giftWrap ? giftMessage : "";
    const engravingEnabled = settings.engravingEnabled !== false;
    // Per-piece engraving: each engraved unit is hand-chased by the karigar, and the
    // atelier prices each lettering hand separately (script's flowing curves take
    // longer than the classic serif). Fee = Σ per line (qty × fee-for-its-hand).
    let engravedPieces = 0;
    let engravingFee = 0;
    if (engravingEnabled) {
      // `lines` is built 1:1 from `incoming`, so index mapping is exact — matching by
      // product+variant+font would be ambiguous and could drop an inscription.
      const feeFor = (font: string): number => {
        const base = Math.max(0, settings.engravingFee ?? 0);
        if (font === "SCRIPT") return Math.max(0, settings.engravingFeeScript ?? base);
        if (font === "SANS") return Math.max(0, settings.engravingFeeSans ?? base);
        return base;
      };
      incoming.forEach((item, idx) => {
        if (item.engravingText) {
          const line = lines[idx];
          line.engravingText = item.engravingText;
          line.engravingFont = item.engravingFont;
          engravedPieces += line.quantity;
          engravingFee += line.quantity * feeFor(item.engravingFont);
        }
      });
    }
    const total = subtotal - couponDiscount + shipping + tax + giftWrapFee + engravingFee;

    // Signed-in customers get their orders linked to their account, so the
    // account area can list them without email verification.
    const session = await getSession();
    const userId = session?.sub ?? null;

    // ---- Atomic transaction: create order + decrement stock safely ----
    const orderNumber = generateOrderNumber();
    try {
      const order = await db.$transaction(async (tx) => {
        // Conditional decrements prevent overselling under concurrency
        for (const line of lines) {
          if (!line.stockSource.track) continue;
          if (line.stockSource.kind === "variant" && line.variantId) {
            const res = await tx.productVariant.updateMany({
              where: { id: line.variantId, stock: { gte: line.quantity } },
              data: { stock: { decrement: line.quantity } },
            });
            if (res.count === 0) throw new Error(`JUST_OUT:${line.name}`);
          } else {
            const res = await tx.product.updateMany({
              where: { id: line.productId, stock: { gte: line.quantity } },
              data: { stock: { decrement: line.quantity } },
            });
            if (res.count === 0) throw new Error(`JUST_OUT:${line.name}`);
          }
        }

        const created = await tx.order.create({
          data: {
            orderNumber,
            customerName,
            email,
            userId,
            phone,
            address,
            city,
            state,
            pincode,
            notes: notes || null,
            subtotal,
            couponCode: appliedCouponCode,
            couponDiscount,
            giftWrap,
            giftWrapFee,
            giftMessage: finalGiftMessage || null,
            engravingText: null, // per-piece inscriptions live on OrderItems now
            engravingFee,
            shipping,
            tax,
            total,
            status: "PLACED",
            paymentMethod,
            paymentStatus: "UNPAID",
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                name: l.name,
                sku: l.sku,
                variantName: l.variantName,
                image: l.image,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
                engravingText: l.engravingText,
                engravingFont: l.engravingFont,
              })),
            },
          },
          include: { items: true },
        });

          // Inventory movements + sales counters + coupon usage
          if (appliedCouponCode) {
            const inc = await tx.coupon.updateMany({
              where: {
                code: appliedCouponCode,
                active: true,
                OR: [{ usageLimit: null }, { usageCount: { lt: db.coupon.fields.usageLimit } }],
              },
              data: { usageCount: { increment: 1 } },
            });
            if (inc.count === 0) throw new Error("COUPON_LIMIT");
          }
          for (const line of lines) {
            if (line.stockSource.track) {
              await tx.inventoryMovement.create({
                data: {
                  productId: line.productId,
                  variantId: line.variantId,
                  delta: -line.quantity,
                  reason: "ORDER",
                  note: `Order ${orderNumber}`,
                  actor: "system:order",
                },
              });
            }
            await tx.product.update({
              where: { id: line.productId },
              data: { salesCount: { increment: line.quantity } },
            });
          }

          return created;
        });

      return ok({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          subtotal: order.subtotal,
          couponCode: order.couponCode,
          couponDiscount: order.couponDiscount,
          giftWrap: order.giftWrap,
          giftWrapFee: order.giftWrapFee,
          giftMessage: order.giftMessage,
          engravingText: order.engravingText,
          engravingFee: order.engravingFee,
          shipping: order.shipping,
          tax: order.tax,
          total: order.total,
          status: order.status,
          paymentMethod: order.paymentMethod,
          items: order.items.map((i) => ({
            name: i.name,
            sku: i.sku,
            variantName: i.variantName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            engravingText: i.engravingText,
            engravingFont: i.engravingFont,
          })),
          totalsText: {
            subtotal: formatINR(order.subtotal),
            shipping: order.shipping === 0 ? "Free" : formatINR(order.shipping),
            giftWrapFee: order.giftWrapFee > 0 ? formatINR(order.giftWrapFee) : "",
            engravingFee: order.engravingFee > 0 ? formatINR(order.engravingFee) : "",
            tax: formatINR(order.tax),
            total: formatINR(order.total),
          },
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("JUST_OUT:")) {
        return badRequest(`${err.message.replace("JUST_OUT:", "")} was just taken — someone got there first. Please refresh your cart.`);
      }
      if (err instanceof Error && err.message === "COUPON_LIMIT") {
        return badRequest("This coupon just reached its usage limit — please remove it and try again.");
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return badRequest("Could not place order. Please review your cart and try again.");
      }
      throw err;
    }
  });
}
