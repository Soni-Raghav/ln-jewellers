import { db } from "@/lib/db";
import { handle, ok, unauthorized, notFound, badRequest, toInt } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.approved !== "boolean") return badRequest("approved boolean required");
    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) return notFound("Review not found");
    const review = await db.review.update({ where: { id }, data: { approved: body.approved } });
    await logAudit(admin.email, "REVIEW_MODERATE", "Review", id, { approved: body.approved });
    return ok({ success: true, review });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) return notFound("Review not found");
    await db.review.delete({ where: { id } });
    await logAudit(admin.email, "REVIEW_DELETE", "Review", id);
    return ok({ success: true });
  });
}
