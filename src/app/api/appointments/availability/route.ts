import { db } from "@/lib/db";
import { badRequest, handle, ok } from "@/lib/api-utils";
import { TIME_SLOTS, istToday } from "@/lib/appointments";

/**
 * GET /api/appointments/availability?date=YYYY-MM-DD
 * Public per-slot availability for the booking form. Pending + confirmed
 * appointments are counted against the atelier's capacity SEPARATELY for
 * atelier visits and video consultations — a busy video-call hour doesn't
 * crowd out guests in the atelier (and vice versa), so guests only see (and
 * pick) slots that can actually take them for the meeting type they chose.
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
      select: { appointmentVisitCapacity: true, appointmentVideoCapacity: true },
    });
    const capacities = {
      STORE_VISIT: Math.max(1, settings?.appointmentVisitCapacity ?? 2),
      VIDEO_CALL: Math.max(1, settings?.appointmentVideoCapacity ?? 2),
    };

    const booked = await db.appointment.groupBy({
      by: ["timeSlot", "type"],
      where: { date, status: { in: ["PENDING", "CONFIRMED"] } },
      _count: { _all: true },
    });
    const takenKey = (slot: string, type: string) => `${slot}::${type}`;
    const takenMap = new Map(booked.map((b) => [takenKey(b.timeSlot, b.type), b._count._all]));

    const slots = TIME_SLOTS.map((slot) => {
      const visitTaken = takenMap.get(takenKey(slot, "STORE_VISIT")) ?? 0;
      const videoTaken = takenMap.get(takenKey(slot, "VIDEO_CALL")) ?? 0;
      const visitRemaining = Math.max(0, capacities.STORE_VISIT - visitTaken);
      const videoRemaining = Math.max(0, capacities.VIDEO_CALL - videoTaken);
      return {
        slot,
        types: {
          STORE_VISIT: { remaining: visitRemaining, full: visitRemaining <= 0 },
          VIDEO_CALL: { remaining: videoRemaining, full: videoRemaining <= 0 },
        },
      };
    });

    return ok({ date, capacities, slots });
  });
}
