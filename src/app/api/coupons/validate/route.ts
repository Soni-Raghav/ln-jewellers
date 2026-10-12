import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, sanitize } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { validateCoupon } from "@/lib/coupons";

/**
 * POST /api/coupons/validate { code, subtotal }
 * Preliminary client-side check. The order API re-validates authoritatively.
 */
export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`coupon:${clientIp(req)}`, 12, 10 * 60_000)) return tooMany();

    const body = await req.json().catch(() => null);
    const code = sanitize(body?.code).toUpperCase().slice(0, 30);
    const subtotal = Number(body?.subtotal);
    if (!code) return badRequest("Enter a coupon code");
    if (!Number.isFinite(subtotal) || subtotal < 0) return badRequest("Invalid subtotal");

    const result = await validateCoupon(code, subtotal);
    if (!result.valid || !result.coupon) return ok({ valid: false, error: result.error });

    return ok({ valid: true, coupon: result.coupon });
  });
}
