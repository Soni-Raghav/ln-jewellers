import { NextResponse } from "next/server";

// ---------- Response helpers ----------
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, fields }, { status: 400 });
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Insufficient permissions") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function tooMany(message = "Too many requests. Please try again later.") {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

// Centralized handler wrapper — never leaks stack traces in production
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api-error]", err);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: isDev ? String((err as Error)?.message ?? err) : "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------- Validation helpers ----------
export function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isNonEmpty(v: unknown, max = 500): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
}

export function isPhone(v: unknown): v is string {
  return typeof v === "string" && /^[+\d][\d\s\-()]{6,18}$/.test(v.trim());
}

export function toInt(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? Math.trunc(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function toFloat(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Strip control chars / trim; basic sanitization for stored strings. */
export function sanitize(v: unknown): string {
  if (typeof v !== "string") return "";
   
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
