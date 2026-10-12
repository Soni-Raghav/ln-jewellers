import { db } from "@/lib/db";
import { handle, ok, unauthorized, notFound } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/coupons/:id/orders — orders that used this coupon code. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const coupon = await db.coupon.findUnique({ where: { id }, select: { code: true } });
    if (!coupon) return notFound("Coupon not found");

    const orders = await db.order.findMany({
      where: { couponCode: coupon.code },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        email: true,
        subtotal: true,
        couponDiscount: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    return ok({
      coupon: { id, code: coupon.code },
      orders,
      count: orders.length,
      savedTotal: orders.reduce((n, o) => n + o.couponDiscount, 0),
    });
  });
}
