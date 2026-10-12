import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV export of all orders (with line-item summary). Admin-only. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const orders = await db.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const rows: string[] = [
      [
        "OrderNumber", "Date", "Status", "PaymentMethod", "PaymentStatus",
        "Customer", "Email", "Phone",
        "Address", "City", "State", "Pincode",
        "Items", "Subtotal", "Coupon", "CouponDiscount",
        "GiftWrap", "GiftWrapFee", "GiftMessage", "Engraving", "EngravingFee",
        "Shipping", "Tax", "Total",
      ].join(","),
    ];

    for (const o of orders) {
      const itemSummary = o.items
        .map((i) => `${i.sku}${i.variantName ? ` (${i.variantName})` : ""}${i.engravingText ? ` [engrave: ${i.engravingText}]` : ""} x${i.quantity}`)
        .join(" | ");
      rows.push(
        [
          o.orderNumber,
          o.createdAt.toISOString(),
          o.status,
          o.paymentMethod,
          o.paymentStatus,
          csvCell(o.customerName),
          csvCell(o.email),
          csvCell(o.phone),
          csvCell(o.address),
          csvCell(o.city),
          csvCell(o.state),
          csvCell(o.pincode),
          csvCell(itemSummary),
          o.subtotal,
          o.couponCode ?? "",
          o.couponDiscount,
          o.giftWrap ? "yes" : "no",
          o.giftWrapFee,
          csvCell(o.giftMessage ?? ""),
          csvCell(o.engravingText ?? ""),
          o.engravingFee,
          o.shipping,
          o.tax,
          o.total,
        ].join(",")
      );
    }

    await logAudit(admin.email, "ORDERS_EXPORT", "Order", undefined, { count: orders.length });

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
