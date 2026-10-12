"use client";

import { useEffect, useState } from "react";

// ---------- Error shape ----------
export interface ApiErrorShape {
  status: number;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

// ---------- Global 401 handling ----------
// AdminView registers a handler so ANY admin API returning 401 drops the
// whole dashboard back to the login card.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

// ---------- Fetch wrapper ----------
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Network error — please check your connection and try again.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. CSV export) — treat as null
  }

  if (!res.ok) {
    const payload = data as { error?: string; fields?: Record<string, string> } | null;
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(
      res.status,
      payload?.error || `Request failed (${res.status})`,
      payload?.fields
    );
  }

  return data as T;
}

export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}

// ---------- Query string helper ----------
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v).trim());
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- Debounce hook ----------
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ---------- Known product image library ----------
export const PRODUCT_IMAGE_LIBRARY: string[] = [
  "/images/products/ring-solitaire.png",
  "/images/products/ring-heritage.png",
  "/images/products/ring-minimal.png",
  "/images/products/necklace-pendant.png",
  "/images/products/necklace-choker.png",
  "/images/products/necklace-bridal.png",
  "/images/products/earrings-stud.png",
  "/images/products/earrings-jhumka.png",
  "/images/products/earrings-hoops.png",
  "/images/products/bangle-classic.png",
  "/images/products/bracelet-chain.png",
  "/images/products/pendant-handmade.png",
];

// ---------- Shared small labels ----------
export const PRODUCT_STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;
export const ORDER_STATUSES = ["PLACED", "CONFIRMED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PAID", "REFUNDED"] as const;
export const INQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
export const MOVEMENT_REASONS = ["RESTOCK", "MANUAL_ADJUST", "RETURN", "CANCEL"] as const;

export function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
