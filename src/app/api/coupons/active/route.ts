import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-utils";

/**
 * Public: currently promotable coupons for the announcement bar.
 * Only exposes code/type/value/minSubtotal/description for ACTIVE, unexpired,
 * non-exhausted coupons — no internal fields.
 */
export async function GET() {
  return handle(async () => {
    const now = new Date();
    const coupons = await db.coupon.findMany({
      where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { code: true, type: true, value: true, minSubtotal: true, description: true },
    });

    // Filter out usage-limit-exhausted coupons
    const usable: typeof coupons = [];
    for (const c of coupons) {
      const coupon = await db.coupon.findUnique({ where: { code: c.code }, select: { usageCount: true, usageLimit: true } });
      if (coupon && coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) continue;
      usable.push(c);
    }

    return ok({ coupons: usable });
  });
}
