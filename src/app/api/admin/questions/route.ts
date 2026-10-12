import { db } from "@/lib/db";
import { handle, ok, unauthorized, sanitize, toInt } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/** GET /api/admin/questions?q=&filter=all|pending|answered&page=1&pageSize=12 */
export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const url = new URL(req.url);
    const q = sanitize(url.searchParams.get("q") ?? "").slice(0, 80);
    const filter = url.searchParams.get("filter") ?? "all";
    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get("pageSize"), 12)));

    const where: Prisma.ProductQuestionWhereInput = {};
    if (filter === "pending") where.approved = false;
    if (filter === "answered") where.answer = { not: null };
    if (q) {
      where.OR = [
        { question: { contains: q } },
        { name: { contains: q } },
        { product: { is: { name: { contains: q } } } },
        { product: { is: { sku: { contains: q } } } },
      ];
    }

    const [total, questions] = await Promise.all([
      db.productQuestion.count({ where }),
      db.productQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { id: true, name: true, slug: true, sku: true, images: true } } },
      }),
    ]);

    return ok({
      items: questions.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        question: item.question,
        answer: item.answer,
        approved: item.approved,
        createdAt: item.createdAt,
        answeredAt: item.answeredAt,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          sku: item.product.sku,
          image: (() => {
            try {
              const arr = JSON.parse(item.product.images);
              return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : "";
            } catch {
              return "";
            }
          })(),
        },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
