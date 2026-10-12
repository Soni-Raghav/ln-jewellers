import { db } from "@/lib/db";
import { handle, ok, unauthorized, toInt } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, toInt(searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get("pageSize"), 15)));
    const [total, items] = await Promise.all([
      db.contactInquiry.count(),
      db.contactInquiry.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return ok({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  });
}
