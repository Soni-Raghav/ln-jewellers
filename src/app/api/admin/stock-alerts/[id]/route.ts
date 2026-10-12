import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, notFound } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

/** PATCH — mark a stock alert as notified (concierge reached out to the customer). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const existing = await db.stockAlert.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
    if (!existing) return notFound("Stock alert not found");

    const updated = await db.stockAlert.update({
      where: { id },
      data: {
        notified: body.notified === false ? false : true,
        notifiedAt: body.notified === false ? null : new Date(),
      },
    });

    await logAudit(
      admin.email,
      body.notified === false ? "STOCK_ALERT_REOPENED" : "STOCK_ALERT_NOTIFIED",
      "StockAlert",
      id,
      { email: updated.email, product: existing.product.name }
    );

    return ok({ success: true, alert: updated });
  });
}

/** DELETE — remove a stock alert request. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const existing = await db.stockAlert.findUnique({ where: { id } });
    if (!existing) return notFound("Stock alert not found");

    await db.stockAlert.delete({ where: { id } });
    await logAudit(admin.email, "STOCK_ALERT_DELETE", "StockAlert", id, { email: existing.email });

    return ok({ success: true });
  });
}
