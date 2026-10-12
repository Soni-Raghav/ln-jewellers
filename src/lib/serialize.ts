import { parseJsonArray } from "@/lib/format";
import type { Prisma } from "@prisma/client";
import type { Product } from "@/lib/types";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    collection: true;
    variants: true;
    reviews: { where: { approved: true }, select: { rating: true } };
  };
}>;

export function serializeProduct(p: ProductWithRelations): Product {
  const images = parseJsonArray<string>(p.images);
  const reviews = p.reviews ?? [];
  const rating = reviews.length
    ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
    : undefined;
  return {
    ...p,
    images,
    tags: parseJsonArray<string>(p.tags),
    rating,
    reviewCount: reviews.length,
    reviews: undefined,
  } as unknown as Product;
}
