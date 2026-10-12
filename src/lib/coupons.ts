import { db } from "@/lib/db";

export interface ValidatedCoupon {
  code: string;
  description: string | null;
  type: string;
  value: number;
  discountAmount: number;
}

/**
 * Authoritative coupon validation. Returns the computed discount or a reason.
 * The order API calls this again server-side — the client can never dictate discounts.
 */
export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<{ valid: boolean; error?: string; coupon?: ValidatedCoupon }> {
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { valid: false, error: "This coupon code isn't valid" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    return { valid: false, error: "This coupon has expired" };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
    return { valid: false, error: "This coupon has reached its usage limit" };
  if (subtotal < coupon.minSubtotal)
    return {
      valid: false,
      error: `Coupon needs a minimum subtotal of ₹${coupon.minSubtotal.toLocaleString("en-IN")}`,
    };

  let discountAmount =
    coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : Math.round(coupon.value);
  if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  discountAmount = Math.min(discountAmount, subtotal); // never exceed subtotal

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.value,
      discountAmount,
    },
  };
}
