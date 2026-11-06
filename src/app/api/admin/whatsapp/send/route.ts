import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, sanitize } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";
import { sendOrderUpdate, sendWaText, resolveWaCloudConfig } from "@/lib/wa-send";
import { waCustomerLink } from "@/lib/format";
import type { OrderUpdateKind } from "@/lib/format";

const KINDS: OrderUpdateKind[] = ["RECEIVED", "CONFIRMED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"];

/**
 * POST /api/admin/whatsapp/send
 * Single-click concierge send: the server delivers the WhatsApp update to the
 * customer through the Cloud API. When the API is not connected (or Meta
 * rejects), the response carries a wa.me fallbackUrl so the admin panel can
 * open WhatsApp with the same message pre-filled — nothing is ever lost.
 *
 * Body: { orderId, kind } — template message for an order's journey stage
 *    or { phone, message } — free-text note to any customer
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const orderId = sanitize(body.orderId).slice(0, 40);
    const freeMessage = sanitize(body.message).slice(0, 2000);
    const freePhone = sanitize(body.phone).slice(0, 20);
    const kind = KINDS.includes(body.kind) ? (body.kind as OrderUpdateKind) : null;

    if (!orderId && !(freePhone && freeMessage)) {
      return badRequest("Provide an order with a template kind, or a phone and a message");
    }

    const settings = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { waCloudToken: true, waCloudPhoneId: true, waAutoConfirm: true, googleReviewUrl: true },
    });

    let outcome;
    let orderNumber = "";

    if (orderId) {
      const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) return badRequest("Order not found");
      orderNumber = order.orderNumber;
      outcome = await sendOrderUpdate(
        {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          phone: order.phone,
          items: order.items.map((it) => ({ name: it.name, variantName: it.variantName, quantity: it.quantity, lineTotal: it.lineTotal })),
          total: order.total,
          paymentStatus: order.paymentStatus,
          googleReviewUrl: settings?.googleReviewUrl ?? null,
        },
        kind ?? "RECEIVED",
        settings
      );
    } else {
      const config = resolveWaCloudConfig(settings);
      if (!config) {
        outcome = { status: "fallback" as const, fallbackUrl: waCustomerLink(freePhone, freeMessage), reason: "WhatsApp Cloud API is not connected in Settings." };
      } else {
        outcome = await sendWaText(config, freePhone, freeMessage);
      }
    }

    await logAudit(admin.email, "WA_MANUAL_SEND", "Order", orderNumber || freePhone, {
      kind: kind ?? "custom",
      outcome: outcome.status,
      reason: "reason" in outcome ? outcome.reason : undefined,
    });

    if (outcome.status === "sent") {
      return ok({ delivered: true, via: "cloud", waMessageId: outcome.waMessageId, orderNumber });
    }
    if (outcome.status === "fallback") {
      return ok({ delivered: false, fallbackUrl: outcome.fallbackUrl, reason: outcome.reason, orderNumber });
    }
    return ok({ delivered: false, error: outcome.reason, fallbackUrl: outcome.fallbackUrl, orderNumber });
  });
}
