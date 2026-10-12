import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, notFound } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body?.status || !["NEW", "IN_PROGRESS", "RESOLVED"].includes(body.status))
      return badRequest("Invalid inquiry status");
    const existing = await db.contactInquiry.findUnique({ where: { id } });
    if (!existing) return notFound("Inquiry not found");
    const inquiry = await db.contactInquiry.update({ where: { id }, data: { status: body.status } });
    await logAudit(admin.email, "INQUIRY_UPDATE", "ContactInquiry", id, { status: body.status });
    return ok({ success: true, inquiry });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const existing = await db.contactInquiry.findUnique({ where: { id } });
    if (!existing) return notFound("Inquiry not found");
    await db.contactInquiry.delete({ where: { id } });
    await logAudit(admin.email, "INQUIRY_DELETE", "ContactInquiry", id);
    return ok({ success: true });
  });
}
