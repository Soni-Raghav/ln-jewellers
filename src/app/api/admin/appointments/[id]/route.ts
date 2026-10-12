import { db } from "@/lib/db";
import { badRequest, handle, notFound, ok, sanitize, unauthorized } from "@/lib/api-utils";
import { logAudit, requireAdmin } from "@/lib/auth";

const STATUSES = ["PENDING", "CONFIRMED", "DECLINED", "COMPLETED"] as const;

/** PATCH /api/admin/appointments/[id] — move an appointment through the book. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) return notFound("Appointment not found.");

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest("Invalid request body.");
    }

    const status = sanitize(body.status).toUpperCase();
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return badRequest("Unknown appointment status.", { status: "Choose a valid status." });
    }

    const updated = await db.appointment.update({
      where: { id },
      data: { status },
    });

    await logAudit(admin.email, "APPOINTMENT_UPDATE", "Appointment", id, {
      from: existing.status,
      to: status,
      date: existing.date,
      slot: existing.timeSlot,
      customer: existing.email,
    });

    return ok({ success: true, appointment: updated });
  });
}

/** DELETE /api/admin/appointments/[id] — remove a booking from the book. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { id } = await ctx.params;
    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) return notFound("Appointment not found.");

    await db.appointment.delete({ where: { id } });
    await logAudit(admin.email, "APPOINTMENT_DELETE", "Appointment", id, {
      customer: existing.email,
      date: existing.date,
      slot: existing.timeSlot,
    });

    return ok({ success: true });
  });
}
