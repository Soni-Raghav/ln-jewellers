import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SECRET = process.env.AUTH_SECRET || "aurelia-dev-secret-change-in-production-9f2c";
export const SESSION_COOKIE = "aurelia_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "CUSTOMER";
  iat: number;
  exp: number;
}

// ---------- Password ----------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------- JWT (HMAC-SHA256, no external deps) ----------
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = b64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const [h, b, s] = token.split(".");
    if (!h || !b || !s) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
    const a = Buffer.from(s);
    const e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const payload = JSON.parse(Buffer.from(b, "base64url").toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Session helpers ----------
export async function createSession(user: { id: string; email: string; name: string; role: string }) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Require an authenticated admin; returns session or null. */
export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function logAudit(
  actor: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: unknown
) {
  try {
    await db.auditLog.create({
      data: {
        actor,
        action,
        entity,
        entityId: entityId ?? null,
        details: details ? JSON.stringify(details).slice(0, 2000) : null,
      },
    });
  } catch {
    // audit logging must never break the request
  }
}
