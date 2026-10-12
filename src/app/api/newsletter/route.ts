import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, isEmail, sanitize } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`newsletter:${clientIp(req)}`, 6, 10 * 60_000)) return tooMany();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");
    const email = sanitize(body.email).toLowerCase().slice(0, 120);
    if (!isEmail(email)) return badRequest("Validation failed", { email: "Please enter a valid email" });

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email },
      update: { active: true },
    });

    return ok({ success: true, message: "Welcome to the LN Jewellers circle — first access to new collections awaits." });
  });
}
