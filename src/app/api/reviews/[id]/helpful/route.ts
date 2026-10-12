import { db } from "@/lib/db";
import { handle, ok, notFound, tooMany } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** "Was this helpful?" vote — increments the counter on an approved review.
 *  Repeat-voting is discouraged client-side (localStorage) and rate-limited
 *  server-side per IP; a social-proof counter doesn't need stronger guarantees. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (!rateLimit(`helpful:${clientIp(_req)}`, 30, 10 * 60_000)) return tooMany();

    const { id } = await ctx.params;
    const review = await db.review.findUnique({ where: { id }, select: { id: true, approved: true } });
    if (!review || !review.approved) return notFound("Review not found");

    const updated = await db.review.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
      select: { helpfulCount: true },
    });

    return ok({ success: true, helpfulCount: updated.helpfulCount });
  });
}
