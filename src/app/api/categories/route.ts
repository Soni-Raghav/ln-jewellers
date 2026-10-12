import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-utils";

export async function GET() {
  return handle(async () => {
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      },
    });
    return ok({
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        image: c.image,
        order: c.order,
        active: c.active,
        productCount: c._count.products,
      })),
    });
  });
}
