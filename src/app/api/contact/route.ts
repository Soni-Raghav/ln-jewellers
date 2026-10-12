import { db } from "@/lib/db";
import { handle, ok, badRequest, tooMany, isEmail, isNonEmpty, isPhone, sanitize } from "@/lib/api-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000)) return tooMany();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const name = sanitize(body.name).slice(0, 80);
    const email = sanitize(body.email).toLowerCase().slice(0, 120);
    const phone = sanitize(body.phone).slice(0, 20);
    const subject = sanitize(body.subject).slice(0, 120);
    const message = sanitize(body.message).slice(0, 3000);

    const fields: Record<string, string> = {};
    if (!isNonEmpty(name, 80)) fields.name = "Please enter your name";
    if (!isEmail(email)) fields.email = "Please enter a valid email";
    if (phone && !isPhone(phone)) fields.phone = "Please enter a valid phone number";
    if (!isNonEmpty(subject, 120)) fields.subject = "Please enter a subject";
    if (!isNonEmpty(message, 3000) || message.length < 10) fields.message = "Message must be 10–3000 characters";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    // naive spam filter: link-heavy messages
    const linkCount = (message.match(/https?:\/\//g) || []).length;
    if (linkCount > 3) return badRequest("Message flagged as spam. Please remove excess links.");

    const inquiry = await db.contactInquiry.create({
      data: { name, email, phone: phone || null, subject, message },
    });

    return ok({ success: true, id: inquiry.id, message: "Thank you! Our concierge team will reach out within 24 hours." });
  });
}
