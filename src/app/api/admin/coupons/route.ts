import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, sanitize, toFloat, toInt } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const [coupons, savings, orderCounts, revenue] = await Promise.all([
      db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
      db.order.groupBy({ by: ["couponCode"], where: { couponCode: { not: null } }, _sum: { couponDiscount: true } }),
      db.order.groupBy({ by: ["couponCode"], where: { couponCode: { not: null } }, _count: { _all: true } }),
      db.order.groupBy({ by: ["couponCode"], where: { couponCode: { not: null }, status: { not: "CANCELLED" } }, _sum: { total: true } }),
    ]);
    const grantedMap = new Map(savings.map((s) => [s.couponCode, s._sum.couponDiscount ?? 0]));
    const countMap = new Map(orderCounts.map((c) => [c.couponCode, c._count._all]));
    const revenueMap = new Map(revenue.map((r) => [r.couponCode, r._sum.total ?? 0]));
    return ok({
      items: coupons.map((c) => ({
        ...c,
        granted: grantedMap.get(c.code) ?? 0,
        orderCount: countMap.get(c.code) ?? 0,
        revenue: revenueMap.get(c.code) ?? 0,
      })),
      activeCount: coupons.filter((c) => c.active).length,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const code = sanitize(body.code).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
    const type = body.type === "FLAT" ? "FLAT" : "PERCENT";
    const value = toFloat(body.value, NaN);
    const minSubtotal = Math.max(0, toFloat(body.minSubtotal, 0));
    const maxDiscount = body.maxDiscount ? Math.max(1, toFloat(body.maxDiscount, 0)) : null;
    const usageLimit = body.usageLimit ? Math.max(1, toInt(body.usageLimit, 0)) : null;
    const description = sanitize(body.description).slice(0, 200) || null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const fields: Record<string, string> = {};
    if (code.length < 3) fields.code = "Code must be 3–30 letters/numbers";
    if (!Number.isFinite(value) || value <= 0) fields.value = "Value must be positive";
    if (type === "PERCENT" && value > 90) fields.value = "Percent coupons cap at 90";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    const dup = await db.coupon.findUnique({ where: { code } });
    if (dup) return badRequest("Validation failed", { code: "This code already exists" });

    const coupon = await db.coupon.create({
      data: { code, description, type, value, minSubtotal, maxDiscount, usageLimit, expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null, active: true },
    });
    await logAudit(admin.email, "COUPON_CREATE", "Coupon", coupon.id, { code, type, value });
    return ok({ success: true, coupon });
  });
}
