import { db } from "@/lib/db";
import { handle, ok, notFound, badRequest, sanitize } from "@/lib/api-utils";
import { getSession } from "@/lib/auth";

/**
 * Order tracking. Two ways in:
 *  - order number + matching billing email (guest flow), or
 *  - a signed-in session that owns the order (account flow — no email needed).
 */
export async function GET(req: Request, ctx: { params: Promise<{ number: string }> }) {
  return handle(async () => {
    const { number } = await ctx.params;
    if (!number) return badRequest("Order number and email are required");

    const session = await getSession();
    const order = await db.order.findUnique({
      where: { orderNumber: number.toUpperCase() },
      include: { items: true },
    });
    if (!order) return notFound("We couldn't find an order with those details");

    const isOwner = !!session && order.userId === session.sub;
    if (!isOwner) {
      const { searchParams } = new URL(req.url);
      const email = sanitize(searchParams.get("email") || "").toLowerCase();
      if (!email) return badRequest("Order number and email are required");
      if (order.email.toLowerCase() !== email) return notFound("We couldn't find an order with those details");
    }

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
        giftMessage: order.giftMessage,
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
          engravingText: i.engravingText,
          engravingFont: i.engravingFont,
        })),
      },
    });
  });
}
