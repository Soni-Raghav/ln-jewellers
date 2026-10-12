import { db } from "@/lib/db";
import { handle, ok, badRequest, notFound, tooMany, isNonEmpty, sanitize, isEmail } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Public Q&A list — only approved questions that already have an atelier answer. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const product = await db.product.findFirst({
      where: { OR: [{ slug, status: "PUBLISHED" }, { sku: slug, status: "PUBLISHED" }] },
      select: { id: true },
    });
    if (!product) return notFound("Product not found");

    const questions = await db.productQuestion.findMany({
      where: { productId: product.id, approved: true, answer: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, name: true, question: true, answer: true, createdAt: true, answeredAt: true },
    });

    return ok({ questions });
  });
}

/** Public question submission — stored unapproved & unanswered, moderated/answered by admin. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    if (!rateLimit(`question:${clientIp(req)}`, 5, 30 * 60_000)) return tooMany();

    const { slug } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const name = sanitize(body.name).slice(0, 80);
    const email = sanitize(body.email).slice(0, 160);
    const question = sanitize(body.question).slice(0, 600);

    const fields: Record<string, string> = {};
    if (!isNonEmpty(name, 80)) fields.name = "Please enter your name";
    if (email && !isEmail(email)) fields.email = "Please enter a valid email (or leave it blank)";
    if (!isNonEmpty(question, 600) || question.trim().length < 10) fields.question = "Your question must be 10–600 characters";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    const product = await db.product.findFirst({
      where: { OR: [{ slug, status: "PUBLISHED" }, { sku: slug, status: "PUBLISHED" }] },
      select: { id: true },
    });
    if (!product) return badRequest("Product not found");

    const created = await db.productQuestion.create({
      data: {
        productId: product.id,
        name,
        email: email || null,
        question,
        approved: false,
      },
    });

    return ok({
      success: true,
      id: created.id,
      message: "Thank you — our atelier will answer your question shortly.",
    });
  });
}
