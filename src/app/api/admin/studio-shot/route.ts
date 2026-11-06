import ZAI from "z-ai-web-dev-sdk";
import { handle, ok, badRequest, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/**
 * POST /api/admin/studio-shot
 *
 * AI "Studio Photoshoot" generator — turns any jewellery photo (device upload,
 * gallery image or an external URL) into a professional studio product shot of
 * the SAME article. The prompt is engineered so the physical design of the
 * piece is preserved exactly; only the presentation (background, lighting,
 * focus) is re-staged.
 *
 * Body: { image: dataUrl|httpUrl, style: preset key, size?: string, name?: string }
 * Returns: { image: "data:image/png;base64,…" }
 */

export const runtime = "nodejs";
export const maxDuration = 60; // generation typically takes 15–50 s

const STYLES: Record<string, string> = {
  CLASSIC_WHITE:
    "a pure seamless white studio background, soft even high-key lighting, a gentle natural floor reflection",
  LUXURY_BLACK:
    "a deep charcoal-black luxury background with a dramatic spotlight and elegant golden rim lighting",
  MARBLE_SILK:
    "an ivory marble pedestal with flowing silk fabric behind it, warm golden ambient light",
  BOUTIQUE_WARM:
    "a warm cream boutique scene with the piece resting on a velvet display cushion, soft golden bokeh",
  FLOAT_GOLD:
    "a floating composition over a soft champagne-gold gradient background with a subtle radiant glow",
};

const SIZES = new Set(["1024x1024", "864x1152", "1152x864", "1344x768", "768x1344"]);

// request bodies on Vercel serverless are capped ~4.5 MB — stay well inside it
const MAX_IMAGE_CHARS = 3_800_000;

function looksLikeImageSource(s: string): boolean {
  if (/^https?:\/\//i.test(s)) return true;
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s);
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = (await req.json().catch(() => null)) as
      | { image?: unknown; style?: unknown; size?: unknown; name?: unknown }
      | null;
    if (!body) return badRequest("Invalid JSON body");

    const rawImage = typeof body.image === "string" ? body.image.trim() : "";
    if (!rawImage) return badRequest("Validation failed", { image: "A source image is required" });
    if (rawImage.length > MAX_IMAGE_CHARS)
      return badRequest("Validation failed", { image: "Image is too large — please use a smaller photo (max ~2.5 MB)" });
    if (!looksLikeImageSource(rawImage))
      return badRequest("Validation failed", { image: "Image must be an http(s) URL or a base64 data URL" });

    const styleKey = typeof body.style === "string" && STYLES[body.style] ? body.style : "CLASSIC_WHITE";
    const size = typeof body.size === "string" && SIZES.has(body.size) ? body.size : "1024x1024";
    const name = typeof body.name === "string" ? body.name.slice(0, 120) : "this jewellery piece";

    const presentation = STYLES[styleKey];

    // The design-preservation contract: everything about the piece stays
    // identical — only the photographic presentation is re-staged.
    const prompt = [
      `Professional luxury jewellery catalogue studio photograph of EXACTLY this jewellery piece (${name}).`,
      "The jewellery's design, silhouette, pattern, engraving, gemstones, proportions and colours must remain 100% IDENTICAL to the input photo — do not redesign, add, remove, melt or restyle any part of the piece.",
      `Only change the photographic presentation: place the piece in ${presentation}.`,
      "Razor-sharp macro focus, true-to-life metal and gem colours, crisp realistic reflections, a soft natural shadow, ultra high-resolution catalogue quality.",
    ].join(" ");

    const zai = await ZAI.create();
    const response = await zai.images.generations.edit({
      prompt,
      images: [{ url: rawImage }],
      size,
    });

    const b64 = response?.data?.[0]?.base64;
    if (!b64) return badRequest("The studio render came back empty — please try again.");

    return ok({ image: `data:image/png;base64,${b64}`, style: styleKey, size });
  });
}
