import crypto from "crypto";
import { db } from "@/lib/db";
import { handle, ok, badRequest, serverError } from "@/lib/api-utils";

/** Verifies Razorpay signature server-side before marking an order paid. */
export async function POST(req: Request) {
  return handle(async () => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return ok({ enabled: false, code: "RAZORPAY_NOT_CONFIGURED", error: "Online payments are not configured." });
    }

    const body = await req.json().catch(() => null);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return badRequest("Missing payment verification fields");
    }

    const payment = await db.payment.findFirst({
      where: { providerOrderId: razorpay_order_id },
      include: { order: true },
    });
    if (!payment) return badRequest("Payment record not found");
    if (payment.status === "VERIFIED" || payment.order.paymentStatus === "PAID")
      return ok({ success: true, alreadyProcessed: true, orderNumber: payment.order.orderNumber }); // idempotent

    // Validate amount matches our order total
    const expectedAmount = Math.round(payment.order.total * 100);
    if (payment.amount && Math.round(payment.amount * 100) !== expectedAmount) {
      return badRequest("Payment amount mismatch");
    }

    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(razorpay_signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawPayload: JSON.stringify(body).slice(0, 4000) } });
      return badRequest("Payment signature verification failed");
    }

    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          status: "VERIFIED",
          providerPaymentId: razorpay_payment_id,
          signature: razorpay_signature,
          rawPayload: JSON.stringify(body).slice(0, 4000),
        },
      }),
      db.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      }),
    ]);

    return ok({ success: true, orderNumber: payment.order.orderNumber });
  });
}
