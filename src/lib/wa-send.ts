import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/auth";
import { normalizeWaDigits, waCustomerLink, waOrderUpdateMessage, type OrderUpdateKind, type WaOrderUpdate } from "@/lib/format";

/**
 * Server-side WhatsApp sending via the Meta WhatsApp Cloud API.
 *
 * Why: wa.me links can only PREFILL a message — a human still has to press
 * send. The Cloud API lets the STORE deliver the message itself with one click
 * (admin) or fully automatically (order confirmations), without any device.
 *
 * Configuration lives in StoreSettings (admin → Settings → WhatsApp Cloud API)
 * with an environment fallback, so nothing is sent to the browser. When the
 * API is not configured (or Meta rejects the send), every caller receives a
 * wa.me fallback URL so the store can still reach the customer the old way.
 */

const GRAPH_VERSION = "v21.0";
const SEND_TIMEOUT_MS = 10_000;

export interface WaCloudConfig {
  token: string;
  phoneId: string;
}

type SettingsWithWa = {
  waCloudToken: string;
  waCloudPhoneId: string;
  waAutoConfirm: boolean;
};

/** Resolve Cloud API credentials: DB settings first, then environment. */
export function resolveWaCloudConfig(settings?: Partial<SettingsWithWa> | null): WaCloudConfig | null {
  const token = (settings?.waCloudToken || process.env.WHATSAPP_CLOUD_TOKEN || "").trim();
  const phoneId = (settings?.waCloudPhoneId || process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

export type WaSendOutcome =
  | { status: "sent"; via: "cloud"; waMessageId: string }
  | { status: "fallback"; fallbackUrl: string; reason: string }
  | { status: "error"; reason: string; fallbackUrl: string };

/**
 * Send a free-text WhatsApp message through the Cloud API.
 * Free-form text can only be delivered inside the 24-hour customer-service
 * window (i.e. after the customer messaged, or for template-free utility text
 * that Meta may reject outside the window — the caller then falls back).
 */
export async function sendWaText(
  config: WaCloudConfig,
  toPhone: string,
  message: string
): Promise<WaSendOutcome> {
  const to = normalizeWaDigits(toPhone);
  const fallbackUrl = waCustomerLink(toPhone, message);
  if (!to || to.length < 8) return { status: "error", reason: "The customer phone number is not valid for WhatsApp.", fallbackUrl };
  if (!message.trim()) return { status: "error", reason: "The message is empty.", fallbackUrl };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: message.slice(0, 4096) },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const payload = (await res.json().catch(() => null)) as
      | { messages?: { id: string }[]; error?: { message?: string; code?: number } }
      | null;

    if (res.ok && payload?.messages?.[0]?.id) {
      return { status: "sent", via: "cloud", waMessageId: payload.messages[0].id };
    }
    const reason = payload?.error?.message || `Meta API responded ${res.status}`;
    return { status: "fallback", fallbackUrl, reason };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network error contacting Meta";
    return { status: "fallback", fallbackUrl, reason };
  }
}

/** Shape both the admin API and the auto-confirmation feed in. */
export interface WaOrderLike extends WaOrderUpdate {
  phone: string;
}

/** Build the message for a journey stage and send it from the atelier. */
export async function sendOrderUpdate(
  order: WaOrderLike,
  kind: OrderUpdateKind,
  settings?: Partial<SettingsWithWa> | null
): Promise<WaSendOutcome> {
  const config = resolveWaCloudConfig(settings ?? undefined);
  const message = waOrderUpdateMessage(kind, order);
  if (!config) {
    return { status: "fallback", fallbackUrl: waCustomerLink(order.phone, message), reason: "WhatsApp Cloud API is not connected in Settings." };
  }
  const outcome = await sendWaText(config, order.phone, message);

  // Audit trail — the atelier can see what was delivered and how.
  await logAudit("system:whatsapp", kind === "RECEIVED" ? "WA_ORDER_AUTO_CONFIRM" : "WA_ORDER_UPDATE", "Order", order.orderNumber, {
    kind,
    outcome: outcome.status,
    reason: "reason" in outcome ? outcome.reason : undefined,
    waMessageId: outcome.status === "sent" ? outcome.waMessageId : undefined,
  }).catch(() => {});

  return outcome;
}

/**
 * Fire-and-forget-safe automatic "order received" confirmation to the customer
 * the moment an order is placed. Never throws; silently no-ops when the Cloud
 * API is not connected or the auto-confirm switch is off.
 */
export async function autoConfirmOrder(
  order: WaOrderLike,
  settings: SettingsWithWa | null | undefined
): Promise<WaSendOutcome | null> {
  try {
    if (!settings?.waAutoConfirm) return null;
    const fresh = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { waAutoConfirm: true, waCloudToken: true, waCloudPhoneId: true },
    });
    const effective = fresh ?? settings;
    if (!effective.waAutoConfirm) return null;
    if (!resolveWaCloudConfig(effective)) return null; // not connected — checkout copy already covers this
    return await sendOrderUpdate(order, "RECEIVED", effective);
  } catch {
    return null; // a failed confirmation must never break the order response
  }
}
