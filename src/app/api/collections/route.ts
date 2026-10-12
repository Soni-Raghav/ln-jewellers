import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-utils";

export async function GET() {
  return handle(async () => {
    const collections = await db.collection.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      },
    });
    return ok({
      collections: collections.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        story: c.story,
        image: c.image,
        featured: c.featured,
        active: c.active,
        productCount: c._count.products,
      })),
    });
  });
}
