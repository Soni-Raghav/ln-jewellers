import { db } from "@/lib/db";
import { handle, ok, notFound } from "@/lib/api-utils";
import { serializeProduct } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const include = {
      category: true,
      collection: true,
      variants: { where: { active: true }, orderBy: { createdAt: "asc" } },
      reviews: {
        where: { approved: true },
        orderBy: { createdAt: "desc" as const },
        take: 20,
      },
    } satisfies Prisma.ProductInclude;

    const product = await db.product.findFirst({
      where: { OR: [{ slug, status: "PUBLISHED" }, { sku: slug, status: "PUBLISHED" }] },
      include,
    });
    if (!product) return notFound("Product not found");

    // Related products: same category, exclude self
    const related = await db.product.findMany({
      where: { status: "PUBLISHED", categoryId: product.categoryId, id: { not: product.id } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        category: true,
        collection: true,
        variants: { where: { active: true } },
        reviews: { where: { approved: true }, select: { rating: true } },
      },
    });

    return ok({ product: serializeProduct(product), related: related.map(serializeProduct) });
  });
}
