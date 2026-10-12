import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, isNonEmpty, sanitize, toInt } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Public review submission — stored unapproved, moderated by admin. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`review:${clientIp(req)}`, 5, 30 * 60_000)) return tooMany();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const productId = sanitize(body.productId).slice(0, 40);
    const name = sanitize(body.name).slice(0, 80);
    const rating = toInt(body.rating, 0);
    const title = sanitize(body.title).slice(0, 120);
    const comment = sanitize(body.comment).slice(0, 2000);

    const fields: Record<string, string> = {};
    if (!productId) fields.productId = "Missing product";
    if (!isNonEmpty(name, 80)) fields.name = "Please enter your name";
    if (rating < 1 || rating > 5) fields.rating = "Rating must be 1–5";
    if (!isNonEmpty(comment, 2000) || comment.length < 10) fields.comment = "Review must be 10–2000 characters";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    const product = await db.product.findFirst({ where: { id: productId, status: "PUBLISHED" } });
    if (!product) return badRequest("Product not found");

    const review = await db.review.create({
      data: { productId, name, rating, title: title || null, comment, approved: false },
    });

    return ok({ success: true, id: review.id, message: "Thank you for your review — it will appear after moderation." });
  });
}
