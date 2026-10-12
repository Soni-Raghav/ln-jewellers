import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, unauthorized } from "@/lib/api-utils";
import { createSession, verifyPassword, logAudit } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sanitize } from "@/lib/api-utils";

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000)) return tooMany("Too many login attempts. Try again later.");

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");
    const email = sanitize(body.email).toLowerCase().slice(0, 120);
    const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
    if (!email || !password) return badRequest("Email and password are required");

    const user = await db.user.findUnique({ where: { email } });
    // Constant-ish response regardless of which factor failed
    if (!user || !user.active) return unauthorized("Invalid email or password");
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return unauthorized("Invalid email or password");

    await createSession(user);
    await logAudit(user.email, "AUTH_LOGIN", "User", user.id);

    return ok({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
}
