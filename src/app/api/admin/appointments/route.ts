import { db } from "@/lib/db";
import { handle, ok, sanitize, toInt, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/admin/appointments — paginated appointment book with summary
 * counts. filter: all | pending | confirmed | declined | completed |
 * today. q searches name / email / phone / notes.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const url = new URL(req.url);
    const q = sanitize(url.searchParams.get("q")).slice(0, 80);
    const filter = url.searchParams.get("filter") ?? "all";
    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(5, toInt(url.searchParams.get("pageSize"), 12)));

    // "today" is evaluated in IST so the book matches the atelier's calendar
    const istToday = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const where: Record<string, unknown> = {};
    if (filter === "pending") where.status = "PENDING";
    if (filter === "confirmed") where.status = "CONFIRMED";
    if (filter === "declined") where.status = "DECLINED";
    if (filter === "completed") where.status = "COMPLETED";
    if (filter === "today") where.date = istToday;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const [items, total, pendingCount, todayCount, upcomingCount] = await Promise.all([
      db.appointment.findMany({
        where,
        orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.appointment.count({ where }),
      db.appointment.count({ where: { status: "PENDING" } }),
      db.appointment.count({ where: { date: istToday, status: { in: ["PENDING", "CONFIRMED"] } } }),
      db.appointment.count({
        where: { date: { gte: istToday }, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
    ]);

    return ok({ items, total, page, pageSize, pendingCount, todayCount, upcomingCount });
  });
}
