import { db } from "@/lib/db";
import { handle, ok, unauthorized, sanitize, toInt } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/stock-alerts — paginated back-in-stock requests with product info. */
export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const url = new URL(req.url);
    const q = sanitize(url.searchParams.get("q")).slice(0, 80);
    const filter = url.searchParams.get("filter") ?? "all"; // all | pending | notified
    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(5, toInt(url.searchParams.get("pageSize"), 12)));

    const where: Record<string, unknown> = {};
    if (filter === "pending") where.notified = false;
    if (filter === "notified") where.notified = true;
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { phone: { contains: q } },
        { product: { is: { name: { contains: q } } } },
        { product: { is: { sku: { contains: q } } } },
      ];
    }

    const [items, total, pendingCount] = await Promise.all([
      db.stockAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, name: true, sku: true, slug: true, images: true, stock: true, trackInventory: true } },
        },
      }),
      db.stockAlert.count({ where }),
      db.stockAlert.count({ where: { notified: false } }),
    ]);

    return ok({
      items: items.map((a) => ({
        id: a.id,
        email: a.email,
        phone: a.phone,
        notified: a.notified,
        notifiedAt: a.notifiedAt,
        createdAt: a.createdAt,
        product: {
          id: a.product.id,
          name: a.product.name,
          sku: a.product.sku,
          slug: a.product.slug,
          image: (() => {
            try {
              return (JSON.parse(a.product.images) as string[])[0] ?? "";
            } catch {
              return "";
            }
          })(),
          stock: a.product.stock,
          trackInventory: a.product.trackInventory,
        },
      })),
      total,
      page,
      pageSize,
      pendingCount,
    });
  });
}
