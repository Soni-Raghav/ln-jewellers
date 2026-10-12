import { db } from "@/lib/db";
import { badRequest, handle, ok } from "@/lib/api-utils";
import { TIME_SLOTS, istToday } from "@/lib/appointments";

/**
 * GET /api/appointments/availability?date=YYYY-MM-DD
 * Public per-slot availability for the booking form. Counts pending +
 * confirmed appointments against the atelier's per-slot capacity so guests
 * only see (and pick) slots that can actually take them.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const date = (searchParams.get("date") || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest("A valid date (YYYY-MM-DD) is required");
    }
    // The book is open from today (IST) to ~90 days out, matching POST validation.
    if (date < istToday()) {
      return badRequest("Pick today or a future date");
    }

    const settings = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { appointmentSlotCapacity: true },
    });
    const capacity = Math.max(1, settings?.appointmentSlotCapacity ?? 2);

    const booked = await db.appointment.groupBy({
      by: ["timeSlot"],
      where: { date, status: { in: ["PENDING", "CONFIRMED"] } },
      _count: { _all: true },
    });
    const takenMap = new Map(booked.map((b) => [b.timeSlot, b._count._all]));

    const slots = TIME_SLOTS.map((slot) => {
      const taken = takenMap.get(slot) ?? 0;
      const remaining = Math.max(0, capacity - taken);
      return { slot, remaining, full: remaining <= 0 };
    });

    return ok({ date, capacity, slots });
  });
}
