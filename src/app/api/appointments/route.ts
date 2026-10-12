import { db } from "@/lib/db";
import { badRequest, handle, isEmail, isPhone, ok, sanitize, tooMany } from "@/lib/api-utils";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TIME_SLOTS, istToday } from "@/lib/appointments";

/**
 * POST /api/appointments — public booking request for a private atelier
 * viewing or a video consultation. Rate-limited, fully validated and
 * sanitized server-side; the atelier confirms each request personally.
 * Each slot holds at most StoreSettings.appointmentVisitCapacity (atelier
 * visits) or appointmentVideoCapacity (video calls) pending or confirmed
 * bookings — the atelier's book never overbooks.
 */

const TYPES = ["STORE_VISIT", "VIDEO_CALL"] as const;

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`appointments:${clientIp(req)}`, 5, 30 * 60 * 1000)) {
      return tooMany("Too many booking requests. Please try again in a little while or reach us on WhatsApp.");
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest("Invalid request body.");
    }

    const name = sanitize(body.name).slice(0, 80);
    const email = sanitize(body.email).slice(0, 120).toLowerCase();
    const phone = sanitize(body.phone).slice(0, 20);
    const type = sanitize(body.type).toUpperCase();
    const date = sanitize(body.date).slice(0, 10);
    const timeSlot = sanitize(body.timeSlot).slice(0, 20);
    const notes = sanitize(body.notes).slice(0, 500);

    const fields: Record<string, string> = {};
    if (name.length < 2) fields.name = "Please tell us your name.";
    if (!isEmail(email)) fields.email = "A valid email is required for the confirmation.";
    if (!isPhone(phone)) fields.phone = "Please add a phone number with country code, e.g. +91 98XXX XXXXX.";
    if (!TYPES.includes(type as (typeof TYPES)[number])) fields.type = "Choose an atelier visit or a video consultation.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      fields.date = "Pick a date for your visit.";
    } else if (date < istToday()) {
      fields.date = "Please pick today or a future date.";
    } else {
      // keep the horizon sensible — atelier opens the book ~90 days out
      const max = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (date > max) fields.date = "We open the appointment book about 90 days ahead — please pick a nearer date.";
    }
    if (!(TIME_SLOTS as readonly string[]).includes(timeSlot)) fields.timeSlot = "Choose one of the available time slots.";
    if (Object.keys(fields).length > 0) return badRequest("Please review the highlighted fields.", fields);

    // ---- Slot capacity per TYPE: the atelier's book never overbooks (server-side truth).
    // Visits and video calls have separate books — a busy video hour doesn't crowd out the atelier.
    const settings = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { appointmentVisitCapacity: true, appointmentVideoCapacity: true },
    });
    const capacity = Math.max(
      1,
      type === "VIDEO_CALL" ? (settings?.appointmentVideoCapacity ?? 2) : (settings?.appointmentVisitCapacity ?? 2)
    );
    const taken = await db.appointment.count({
      where: { date, timeSlot, type, status: { in: ["PENDING", "CONFIRMED"] } },
    });
    if (taken >= capacity) {
      return badRequest("That slot is fully booked — please choose another time.", {
        timeSlot: `${timeSlot} on ${date} is fully booked. Pick another slot or date — or message us on WhatsApp and we'll find room for you.`,
      });
    }

    const appointment = await db.appointment.create({
      data: { name, email, phone, type, date, timeSlot, notes: notes || null, status: "PENDING" },
      select: { id: true, date: true, timeSlot: true, type: true },
    });

    return ok({
      success: true,
      appointment: { ...appointment, typeLabel: appointment.type === "VIDEO_CALL" ? "Video consultation" : "Atelier visit" },
    });
  });
}
