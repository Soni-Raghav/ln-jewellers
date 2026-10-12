import { db } from "@/lib/db";
import { handle, ok, badRequest, toInt, sanitize } from "@/lib/api-utils";
import { serializeProduct } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const q = sanitize(searchParams.get("q") || "").slice(0, 100);
    const category = searchParams.get("category") || "";
    const collection = searchParams.get("collection") || "";
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, toInt(searchParams.get("page"), 1));
    const pageSize = Math.min(48, Math.max(1, toInt(searchParams.get("pageSize"), 12)));
    const minPrice = toInt(searchParams.get("minPrice"), 0);
    const maxPrice = toInt(searchParams.get("maxPrice"), 10_000_000);
    const inStockOnly = searchParams.get("inStock") === "true";
    const featured = searchParams.get("featured") === "true";
    const bestSeller = searchParams.get("bestSeller") === "true";
    const trending = searchParams.get("trending") === "true";
    const handmade = searchParams.get("handmade") === "true";
    const ids = searchParams.get("ids") || "";

    const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { description: { contains: q } },
        { material: { contains: q } },
        { shortDescription: { contains: q } },
      ];
    }
    if (category) where.category = { slug: category };
    if (collection) where.collection = { slug: collection };
    if (featured) where.featured = true;
    if (bestSeller) where.bestSeller = true;
    if (trending) where.trending = true;
    if (handmade) where.handmade = true;
    if (inStockOnly) where.stock = { gt: 0 };
    if (ids) where.id = { in: ids.split(",").filter(Boolean).slice(0, 100) };
    // price filters apply to base price
    if (minPrice > 0 || maxPrice < 10_000_000) {
      where.price = { gte: minPrice, lte: maxPrice };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    switch (sort) {
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "popular":
        orderBy = [{ salesCount: "desc" }, { bestSeller: "desc" }];
        break;
      case "featured":
        orderBy = [{ featured: "desc" }, { createdAt: "desc" }];
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          collection: true,
          variants: { where: { active: true }, orderBy: { createdAt: "asc" } },
          reviews: { where: { approved: true }, select: { rating: true } },
        },
      }),
    ]);

    return ok({
      items: products.map(serializeProduct),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
