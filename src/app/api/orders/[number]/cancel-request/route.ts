import { db } from "@/lib/db";
import { handle, ok, notFound, badRequest, sanitize } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Customer-initiated cancellation request (public).
 * Requires order number + matching email (same trust model as order tracking).
 * Only meaningful while the piece hasn't shipped: PLACED | CONFIRMED | IN_PRODUCTION.
 * The concierge approves (→ CANCELLED, restocks) or declines from the admin atelier.
 */
export async function POST(req: Request, ctx: { params: Promise<{ number: string }> }) {
  return handle(async () => {
    if (!rateLimit(`cancel-req:${clientIp(req)}`, 5, 30 * 60_000)) {
      return badRequest("Too many requests — please try again shortly");
    }

    const { number } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const email = sanitize(String(body.email || "")).toLowerCase();
    const reason = sanitize(String(body.reason || "")).slice(0, 300);
    if (!number || !email) return badRequest("Order number and email are required");
    if (reason.length < 4) {
      return badRequest("Please tell us briefly why you'd like to cancel", {
        reason: "Please share a short reason (at least 4 characters)",
      });
    }

    const order = await db.order.findUnique({ where: { orderNumber: number.toUpperCase() } });
    if (!order || order.email.toLowerCase() !== email)
      return notFound("We couldn't find an order with those details");

    if (order.status === "CANCELLED") return badRequest("This order is already cancelled");
    if (!["PLACED", "CONFIRMED", "IN_PRODUCTION"].includes(order.status))
      return badRequest("This order has already shipped — please message our concierge on WhatsApp");
    if (order.cancelRequested)
      return ok({ success: true, message: "Your cancellation request is already with our concierge." });

    const updated = await db.order.update({
      where: { id: order.id },
      data: { cancelRequested: true, cancelReason: reason, cancelRequestedAt: new Date() },
    });

    return ok({
      success: true,
      message: "Cancellation request received — our concierge will call you to confirm shortly.",
      cancelRequested: updated.cancelRequested,
      cancelRequestedAt: updated.cancelRequestedAt,
    });
  });
}
