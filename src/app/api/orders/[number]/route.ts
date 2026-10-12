import { db } from "@/lib/db";
import { handle, ok, notFound, badRequest, sanitize } from "@/lib/api-utils";

/** Order tracking: requires order number + matching email. */
export async function GET(req: Request, ctx: { params: Promise<{ number: string }> }) {
  return handle(async () => {
    const { number } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const email = sanitize(searchParams.get("email") || "").toLowerCase();
    if (!number || !email) return badRequest("Order number and email are required");

    const order = await db.order.findUnique({
      where: { orderNumber: number.toUpperCase() },
      include: { items: true },
    });
    if (!order || order.email.toLowerCase() !== email) return notFound("We couldn't find an order with those details");

    return ok({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        notes: order.notes,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        giftWrap: order.giftWrap,
        giftWrapFee: order.giftWrapFee,
        engravingText: order.engravingText,
        engravingFee: order.engravingFee,
        cancelRequested: order.cancelRequested,
        cancelReason: order.cancelReason,
        cancelRequestedAt: order.cancelRequestedAt,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((i) => ({
          name: i.name,
          sku: i.sku,
          variantName: i.variantName,
          image: i.image,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
      },
    });
  });
}
