import { db } from "@/lib/db";
import { handle, ok, badRequest, sanitize, isEmail } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Public back-in-stock signup for a sold-out piece.
 * Accepts an email (required) + optional phone, rate-limited per IP.
 * Re-subscribing the same email for the same product resets the notified flag
 * so the concierge can ping the customer again on the next restock.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    if (!rateLimit(`stock-alert:${clientIp(req)}`, 6, 30 * 60_000)) {
      return badRequest("Too many requests — please try again a little later.");
    }

    const { slug } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const email = sanitize(body.email).slice(0, 160).toLowerCase();
    const phone = sanitize(body.phone).slice(0, 24);

    const fields: Record<string, string> = {};
    if (!isEmail(email)) fields.email = "Please enter a valid email address";
    if (phone && !/^[+\d][\d\s-]{6,20}$/.test(phone)) fields.phone = "Please enter a valid phone number";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    const product = await db.product.findFirst({
      where: { OR: [{ slug, status: "PUBLISHED" }, { sku: slug, status: "PUBLISHED" }] },
      select: { id: true, name: true },
    });
    if (!product) return badRequest("Product not found");

    await db.stockAlert.upsert({
      where: { productId_email: { productId: product.id, email } },
      create: { productId: product.id, email, phone: phone || null },
      update: { notified: false, notifiedAt: null, ...(phone ? { phone } : {}) },
    });

    return ok({
      success: true,
      message: `You're on the list — we'll email you the moment “${product.name}” returns.`,
    });
  });
}
