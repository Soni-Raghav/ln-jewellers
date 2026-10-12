import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, notFound } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

const ORDER_STATUSES = ["PLACED", "CONFIRMED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID", "REFUNDED"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const order = await db.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return notFound("Order not found");

    const data: Record<string, string> = {};
    if (body.status !== undefined) {
      if (!ORDER_STATUSES.includes(body.status)) return badRequest("Invalid order status");
      data.status = body.status;
    }
    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus)) return badRequest("Invalid payment status");
      data.paymentStatus = body.paymentStatus;
    }
    if (Object.keys(data).length === 0) return badRequest("Nothing to update");

    const updated = await db.order.update({ where: { id }, data });

    // Restock inventory when an order is cancelled
    if (data.status === "CANCELLED" && order.status !== "CANCELLED") {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } }).catch(() => null);
          } else {
            const p = await tx.product.findUnique({ where: { id: item.productId } });
            if (p?.trackInventory) {
              await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
            }
          }
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              delta: item.quantity,
              reason: "CANCEL",
              note: `Order ${order.orderNumber} cancelled`,
              actor: admin.email,
            },
          });
          await tx.product.update({ where: { id: item.productId }, data: { salesCount: { decrement: item.quantity } } }).catch(() => null);
        }
      });
    }

    await logAudit(admin.email, "ORDER_UPDATE", "Order", id, { from: order.status, to: data.status, paymentStatus: data.paymentStatus });
    return ok({ success: true, order: updated });
  });
}
