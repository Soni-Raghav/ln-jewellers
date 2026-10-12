import { db } from "@/lib/db";
import { handle, ok, unauthorized } from "@/lib/api-utils";
import { getSession } from "@/lib/auth";

/** Orders placed by the signed-in customer (no email verification needed). */
export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const orders = await db.order.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    });

    return ok({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        email: o.email,
        phone: o.phone,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        subtotal: o.subtotal,
        couponCode: o.couponCode,
        couponDiscount: o.couponDiscount,
        giftWrap: o.giftWrap,
        engravingFee: o.engravingFee,
        shipping: o.shipping,
        tax: o.tax,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
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
      })),
    });
  });
}
