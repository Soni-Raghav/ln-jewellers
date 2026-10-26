import { db } from "@/lib/db";
import { handle, ok, unauthorized, badRequest, toFloat, sanitize } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const settings = await db.storeSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) return ok({ settings: null });
    const { faq, instagramGallery, testimonials, ...rest } = settings;
    return ok({ settings: { ...rest, faq: JSON.parse(faq || "[]"), instagramGallery: JSON.parse(instagramGallery || "[]"), testimonials: JSON.parse(testimonials || "[]") } });
  });
}

const STRING_FIELDS = [
  "brandName", "tagline", "whatsappNumber", "email", "phone", "address", "businessHours",
  "instagramUrl", "facebookUrl", "pinterestUrl", "youtubeUrl",
  "aboutStory", "missionVision", "shippingPolicy", "returnsPolicy", "privacyPolicy", "termsPolicy",
  // round 14 — hero + announcement + connectivity + SEO
  "heroEyebrow", "heroTitle", "heroHighlight", "heroSubtitle", "heroCtaLabel",
  "announcementText",
  "googleReviewUrl", "googleMapsUrl", "googleRating", "whatsappDefaultMessage",
  "seoTitle", "seoDescription", "ogImageUrl",
] as const;

// Server-side hygiene: per-field maximum lengths (announcement/SEO short, hero copy
// medium, URLs long). Anything unlisted falls back to the default 300.
const STRING_MAX: Record<string, number> = {
  announcementText: 200,
  seoTitle: 200,
  seoDescription: 200,
  heroEyebrow: 300,
  heroTitle: 300,
  heroHighlight: 300,
  heroSubtitle: 300,
  heroCtaLabel: 300,
  googleReviewUrl: 500,
  googleMapsUrl: 500,
  ogImageUrl: 500,
  googleRating: 10,
  whatsappDefaultMessage: 500,
};

// Homepage section + connectivity toggles (round 14).
const BOOLEAN_FIELDS = [
  "whatsappFloatEnabled", "instagramFeedEnabled", "announcementEnabled",
  "showCollectionsSection", "showCategoriesSection", "showNewArrivals", "showBestSellers",
  "showTrending", "showHandmade", "showTestimonials", "showNewsletter",
] as const;

export async function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const data: Record<string, unknown> = {};
    for (const f of STRING_FIELDS) {
      if (body[f] !== undefined) {
        const max = STRING_MAX[f] ?? (f.includes("Policy") || f.includes("Story") || f.includes("Vision") ? 8000 : 300);
        data[f] = sanitize(body[f]).slice(0, max);
      }
    }
    for (const f of BOOLEAN_FIELDS) {
      if (body[f] !== undefined) data[f] = !!body[f];
    }
    if (body.googleReviewCount !== undefined) {
      data.googleReviewCount = Math.min(100000, Math.max(0, Math.round(toFloat(body.googleReviewCount, 0))));
    }
    if (body.shippingFee !== undefined) data.shippingFee = Math.max(0, toFloat(body.shippingFee, 199));
    if (body.freeShippingAbove !== undefined) data.freeShippingAbove = Math.max(0, toFloat(body.freeShippingAbove, 50000));
    if (body.taxRatePercent !== undefined) data.taxRatePercent = Math.min(28, Math.max(0, toFloat(body.taxRatePercent, 3)));
    if (body.giftWrapFee !== undefined) data.giftWrapFee = Math.max(0, toFloat(body.giftWrapFee, 500));
    if (body.engravingEnabled !== undefined) data.engravingEnabled = !!body.engravingEnabled;
    if (body.engravingFee !== undefined) data.engravingFee = Math.max(0, toFloat(body.engravingFee, 1500));
    if (body.engravingFeeScript !== undefined) data.engravingFeeScript = Math.max(0, toFloat(body.engravingFeeScript, 2500));
    if (body.engravingFeeSans !== undefined) data.engravingFeeSans = Math.max(0, toFloat(body.engravingFeeSans, 1800));
    if (body.appointmentVisitCapacity !== undefined) data.appointmentVisitCapacity = Math.min(10, Math.max(1, Math.round(toFloat(body.appointmentVisitCapacity, 2))));
    if (body.appointmentVideoCapacity !== undefined) data.appointmentVideoCapacity = Math.min(10, Math.max(1, Math.round(toFloat(body.appointmentVideoCapacity, 2))));
    if (body.razorpayEnabled !== undefined) data.razorpayEnabled = !!body.razorpayEnabled;
    if (body.faq !== undefined) {
      const faq = Array.isArray(body.faq)
        ? body.faq.slice(0, 20).map((x: { q?: unknown; a?: unknown }) => ({ q: sanitize(x.q).slice(0, 300), a: sanitize(x.a).slice(0, 2000) }))
        : null;
      if (faq) data.faq = JSON.stringify(faq);
    }
    if (body.instagramGallery !== undefined) {
      const gallery = Array.isArray(body.instagramGallery)
        ? body.instagramGallery.slice(0, 12).map((s: unknown) => sanitize(s).slice(0, 300)).filter(Boolean)
        : null;
      if (gallery) data.instagramGallery = JSON.stringify(gallery);
    }
    if (body.testimonials !== undefined) {
      const t = Array.isArray(body.testimonials)
        ? body.testimonials.slice(0, 12).map((x: { name?: unknown; location?: unknown; text?: unknown; rating?: unknown }) => ({
            name: sanitize(x.name).slice(0, 80),
            location: sanitize(x.location).slice(0, 80),
            text: sanitize(x.text).slice(0, 600),
            rating: Math.min(5, Math.max(1, toFloat(x.rating, 5))),
          }))
        : null;
      if (t) data.testimonials = JSON.stringify(t);
    }

    const settings = await db.storeSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    await logAudit(admin.email, "SETTINGS_UPDATE", "StoreSettings", "singleton", { fields: Object.keys(data) });
    const { faq, instagramGallery, testimonials, ...rest } = settings;
    return ok({ success: true, settings: { ...rest, faq: JSON.parse(faq || "[]"), instagramGallery: JSON.parse(instagramGallery || "[]"), testimonials: JSON.parse(testimonials || "[]") } });
  });
}
