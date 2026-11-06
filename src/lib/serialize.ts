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
}> & {
  // List endpoints select just {rating}; the detail endpoint includes full
  // approved review rows. Both must serialize through this function.
  reviews?: Array<Prisma.ProductGetPayload<{ include: { reviews: true } }>["reviews"][number] | { rating: number }>;
};

export function serializeProduct(p: ProductWithRelations): Product {
  const images = parseJsonArray<string>(p.images);
  const reviews = p.reviews ?? [];
  const rating = reviews.length
    ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
    : undefined;
  // Only the detail endpoint carries full review rows (they have a comment);
  // list endpoints get rating-only rows which must NOT leak as `reviews`.
  const detailed = reviews.length > 0 && "comment" in reviews[0];
  // model3dData (uploaded base64 GLB) must never travel through public JSON —
  // the product page fetches it on demand from /api/models/{id}.glb instead.
  const { model3dData: _drop, ...rest } = p as ProductWithRelations & { model3dData?: string | null };
  void _drop;
  return {
    ...rest,
    images,
    tags: parseJsonArray<string>(p.tags),
    rating,
    reviewCount: reviews.length,
    ...(detailed
      ? { reviews: reviews as unknown as Product["reviews"] }
      : { reviews: undefined }),
  } as unknown as Product;
}
