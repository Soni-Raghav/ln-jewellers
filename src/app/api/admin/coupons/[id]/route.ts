import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, notFound, toFloat, toInt } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) return notFound("Coupon not found");

    const data: Record<string, unknown> = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.value !== undefined) {
      const value = toFloat(body.value, NaN);
      if (!Number.isFinite(value) || value <= 0) return badRequest("Value must be positive");
      data.value = value;
    }
    if (body.minSubtotal !== undefined) data.minSubtotal = Math.max(0, toFloat(body.minSubtotal, 0));
    if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 200) : null;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit ? Math.max(1, toInt(body.usageLimit, 0)) : null;

    const coupon = await db.coupon.update({ where: { id }, data });
    await logAudit(admin.email, "COUPON_UPDATE", "Coupon", id, { code: existing.code, fields: Object.keys(data) });
    return ok({ success: true, coupon });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) return notFound("Coupon not found");
    await db.coupon.delete({ where: { id } });
    await logAudit(admin.email, "COUPON_DELETE", "Coupon", id, { code: existing.code });
    return ok({ success: true });
  });
}
