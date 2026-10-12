import { db } from "@/lib/db";
import { handle, ok, badRequest, notFound, unauthorized, sanitize } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

/** PATCH /api/admin/questions/:id — answer, edit answer, approve/unapprove */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const existing = await db.productQuestion.findUnique({ where: { id } });
    if (!existing) return notFound("Question not found");

    const data: { answer?: string | null; answeredAt?: Date | null; approved?: boolean } = {};

    if ("answer" in body) {
      const answer = sanitize(body.answer).slice(0, 2000);
      if (answer.trim().length === 0) {
        data.answer = null;
        data.answeredAt = null;
      } else {
        data.answer = answer;
        data.answeredAt = new Date();
      }
    }
    if ("approved" in body) data.approved = Boolean(body.approved);

    const question = await db.productQuestion.update({ where: { id }, data });

    if (data.answer !== undefined && data.answer) {
      await logAudit(admin.email, "QUESTION_ANSWER", "ProductQuestion", id, { productId: existing.productId, preview: data.answer.slice(0, 80) });
    }
    if (data.approved !== undefined) {
      await logAudit(admin.email, data.approved ? "QUESTION_APPROVE" : "QUESTION_UNAPPROVE", "ProductQuestion", id, { productId: existing.productId });
    }

    return ok({ success: true, question: { id: question.id, answer: question.answer, approved: question.approved, answeredAt: question.answeredAt } });
  });
}

/** DELETE /api/admin/questions/:id */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const existing = await db.productQuestion.findUnique({ where: { id } });
    if (!existing) return notFound("Question not found");

    await db.productQuestion.delete({ where: { id } });
    await logAudit(admin.email, "QUESTION_DELETE", "ProductQuestion", id, { productId: existing.productId, preview: existing.question.slice(0, 60) });
    return ok({ success: true });
  });
}
