import { db } from "@/lib/db";
import { handle, ok, badRequest, serverError } from "@/lib/api-utils";

/**
 * Creates a Razorpay payment order. Requires RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 * When credentials are absent the storefront falls back to WhatsApp checkout.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return ok({
        enabled: false,
        code: "RAZORPAY_NOT_CONFIGURED",
        error: "Online payments are not configured. Please use WhatsApp checkout.",
      });
    }

    const body = await req.json().catch(() => null);
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim().toUpperCase() : "";
    if (!orderNumber) return badRequest("orderNumber is required");

    const order = await db.order.findUnique({ where: { orderNumber } });
    if (!order) return badRequest("Order not found");
    if (order.paymentStatus === "PAID") return badRequest("Order is already paid");
    if (order.paymentMethod !== "RAZORPAY") return badRequest("This order is set for WhatsApp checkout");

    // Create order on Razorpay via REST API
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(order.total * 100), // paise
        currency: "INR",
        receipt: order.orderNumber,
        notes: { orderNumber: order.orderNumber, email: order.email },
      }),
    });
    if (!res.ok) {
      console.error("[razorpay] create failed", await res.text());
      return serverError("Payment gateway error. Please try WhatsApp checkout.");
    }
    const rzp = (await res.json()) as { id: string; amount: number; currency: string };

    await db.payment.create({
      data: {
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderId: rzp.id,
        amount: order.total,
        currency: "INR",
        status: "CREATED",
      },
    });

    return ok({
      enabled: true,
      razorpayOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      keyId, // publishable key id — safe to expose
      orderNumber: order.orderNumber,
      prefill: { name: order.customerName, email: order.email, contact: order.phone },
    });
  });
}
