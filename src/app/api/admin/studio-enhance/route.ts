import sharp from "sharp";
import { handle, ok, badRequest, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/**
 * POST /api/admin/studio-enhance
 *
 * "Instant studio clean-up" — deterministic, AI-free photo enhancement for
 * jewellery product shots. Runs entirely on the serverless function with
 * sharp (no external service, no API key), finishes in well under a second
 * and is available on every deployment including the free Vercel tier.
 *
 * The pipeline only touches *presentation* pixels — the piece itself is
 * never redrawn, reshaped or re-imagined:
 *   1. EXIF-safe rotation + flatten onto a clean catalogue white
 *   2. auto-levels (removes the grey haze from phone/gallery photos)
 *   3. gentle brightness + saturation lift so gold and gemstones pop
 *   4. macro-grade sharpening
 *
 * Body: { image: dataUrl|httpUrl, name?: string }
 * Returns: { image: "data:image/jpeg;base64,…" }
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_CHARS = 3_800_000;
const OUT_MAX_DIM = 1600;

function looksLikeImageSource(s: string): boolean {
  if (/^https?:\/\//i.test(s)) return true;
  return /^data:image\/(png|jpe?g|webp|avif);base64,[A-Za-z0-9+/=\s]+$/.test(s);
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
    if (!body) return badRequest("Invalid JSON body");

    const rawImage = typeof body.image === "string" ? body.image.trim() : "";
    if (!rawImage) return badRequest("Validation failed", { image: "A source image is required" });
    if (rawImage.length > MAX_IMAGE_CHARS)
      return badRequest("Validation failed", { image: "Image is too large — please use a smaller photo (max ~2.5 MB)" });
    if (!looksLikeImageSource(rawImage))
      return badRequest("Validation failed", { image: "Image must be an http(s) URL or a base64 data URL" });

    // decode the source (data URL or remote URL) into bytes
    let bytes: Buffer;
    if (rawImage.startsWith("data:")) {
      bytes = Buffer.from(rawImage.slice(rawImage.indexOf(",") + 1), "base64");
    } else {
      try {
        const res = await fetch(rawImage, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return badRequest("Could not fetch the source image — upload the photo directly instead.");
        bytes = Buffer.from(await res.arrayBuffer());
      } catch {
        return badRequest("Could not fetch the source image — upload the photo directly instead.");
      }
    }
    if (bytes.length === 0) return badRequest("The source image is empty.");
    if (bytes.length > 8_000_000)
      return badRequest("Image is too large to process — please use a photo under 8 MB.");

    try {
      const out = await sharp(bytes, { failOn: "none" })
        .rotate() // honour EXIF orientation
        .resize({ width: OUT_MAX_DIM, height: OUT_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#FFFFFF" }) // PNG transparency → studio white
        .normalize() // auto-levels: kills grey haze, true whites
        .modulate({ brightness: 1.05, saturation: 1.1 }) // gentle gold/gem lift
        .sharpen({ sigma: 1.1 }) // crisp catalogue look
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

      return ok({ image: `data:image/jpeg;base64,${out.toString("base64")}` });
    } catch (e) {
      console.error("[studio-enhance] sharp failed:", e);
      return badRequest("This image format could not be processed — please try a JPG, PNG or WEBP photo.");
    }
  });
}
