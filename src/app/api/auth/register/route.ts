import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, isEmail, isNonEmpty, sanitize } from "@/lib/api-utils";
import { createSession, hashPassword, logAudit } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * Customer self-service registration (the admin account is created by the
 * seed script only — this endpoint always creates role CUSTOMER).
 */
export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`register:${clientIp(req)}`, 5, 30 * 60_000))
      return tooMany("Too many sign-up attempts. Please try again later.");

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const name = sanitize(body.name).slice(0, 80);
    const email = sanitize(body.email).toLowerCase().slice(0, 120);
    const phone = sanitize(body.phone).slice(0, 20);
    const password = typeof body.password === "string" ? body.password : "";
    const confirm = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    const fields: Record<string, string> = {};
    if (!isNonEmpty(name, 80) || name.length < 2) fields.name = "Please tell us your full name";
    if (!isEmail(email)) fields.email = "A valid email is required";
    if (password.length < 8) fields.password = "Password must be at least 8 characters";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      fields.password = "Password must contain at least one letter and one number";
    if (confirm !== password) fields.confirmPassword = "Passwords do not match";
    if (Object.keys(fields).length) return badRequest("Please review the highlighted fields", fields);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { name, email, phone: phone || null, passwordHash, role: "CUSTOMER" },
    });

    await createSession(user);
    await logAudit(email, "AUTH_REGISTER", "User", user.id);

    return ok({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
}
