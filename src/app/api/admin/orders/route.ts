import { db } from "@/lib/db";
import { handle, ok, unauthorized, toInt, sanitize } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { searchParams } = new URL(req.url);
    const q = sanitize(searchParams.get("q") || "").slice(0, 80);
    const status = searchParams.get("status") || "";
    const page = Math.max(1, toInt(searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get("pageSize"), 15)));

    const where: Prisma.OrderWhereInput = {};
    if (status && ["PLACED", "CONFIRMED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"].includes(status))
      where.status = status;
    if (q) where.OR = [{ orderNumber: { contains: q } }, { customerName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }];

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
    ]);

    return ok({
      items: orders,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
