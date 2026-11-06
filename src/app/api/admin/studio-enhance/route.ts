import sharp from "sharp";
import { handle, ok, badRequest, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

/**
 * POST /api/admin/studio-enhance
 *
 * "Instant studio clean-up + upscale" — deterministic, AI-free photo
 * enhancement and resolution upscaling for jewellery product shots. Runs
 * entirely on the serverless function with sharp (no external service, no
 * API key, no quota), finishes in a couple of seconds and is available on
 * every deployment including the free Vercel tier — forever.
 *
 * The pipeline only touches *presentation* pixels — the piece itself is
 * never redrawn, reshaped or re-imagined:
 *   1. EXIF-safe rotation + flatten onto a clean catalogue white
 *   2. auto-levels (removes the grey haze from phone/gallery photos)
 *   3. gentle brightness + saturation lift so gold and gemstones pop
 *   4. scale 1×  → catalogue 1600 px, mild sharpening
 *      scale 2×  → Lanczos3 upscale to ≤3200 px + unsharp mask
 *      scale 4×  → Lanczos3 upscale to ≤3200 px + stronger unsharp mask
 *                  (marketplace-friendly: Amazon / Flipkart / Myntra minimums)
 *
 * Body: { image: dataUrl|httpUrl, scale?: "1"|"2"|"4", name?: string }
 * Returns: { image: "data:image/jpeg;base64,…", width, height, scale }
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_CHARS = 3_800_000;

type ScaleKey = "1" | "2" | "4";

// output caps and JPEG quality per scale — kept so a single enhanced photo
// stays comfortably inside the product-save request budget
const OUT_CAP: Record<ScaleKey, number> = { "1": 1600, "2": 3200, "4": 3200 };
const OUT_QUALITY: Record<ScaleKey, number> = { "1": 92, "2": 90, "4": 85 };

function looksLikeImageSource(s: string): boolean {
  if (/^https?:\/\//i.test(s)) return true;
  return /^data:image\/(png|jpe?g|webp|avif);base64,[A-Za-z0-9+/=\s]+$/.test(s);
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = (await req.json().catch(() => null)) as
      | { image?: unknown; scale?: unknown }
      | null;
    if (!body) return badRequest("Invalid JSON body");

    const rawImage = typeof body.image === "string" ? body.image.trim() : "";
    if (!rawImage) return badRequest("Validation failed", { image: "A source image is required" });
    if (rawImage.length > MAX_IMAGE_CHARS)
      return badRequest("Validation failed", { image: "Image is too large — please use a smaller photo (max ~2.5 MB)" });
    if (!looksLikeImageSource(rawImage))
      return badRequest("Validation failed", { image: "Image must be an http(s) URL or a base64 data URL" });

    const scale: ScaleKey = body.scale === "2" || body.scale === 2 ? "2" : body.scale === "4" || body.scale === 4 ? "4" : "1";

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
      // one decode pass that also normalises EXIF orientation, so the
      // dimensions we read below are the true post-rotation dimensions
      const oriented = await sharp(bytes, { failOn: "none" }).rotate().toBuffer();
      const meta = await sharp(oriented).metadata();
      const srcMax = Math.max(meta.width ?? 0, meta.height ?? 0);
      if (!srcMax) return badRequest("This image format could not be processed — please try a JPG, PNG or WEBP photo.");

      let pipeline = sharp(oriented, { failOn: "none" })
        .flatten({ background: "#FFFFFF" }) // PNG transparency → studio white
        .normalize() // auto-levels: kills grey haze, true whites
        .modulate({ brightness: 1.05, saturation: 1.1 }); // gentle gold/gem lift

      if (scale === "1") {
        pipeline = pipeline
          .resize({ width: OUT_CAP["1"], height: OUT_CAP["1"], fit: "inside", withoutEnlargement: true })
          .sharpen({ sigma: 1.1 }); // crisp catalogue look
      } else {
        // upscale: Lanczos3 resampling to the target, then an unsharp mask
        // tuned for upscaled edges (m1 protects flat backgrounds from
        // halos, m2 pushes real detail — facets, engraving, hallmarks)
        const target = Math.min(srcMax * Number(scale), OUT_CAP[scale]);
        pipeline = pipeline
          .resize({ width: target, height: target, fit: "inside", kernel: "lanczos3" })
          .sharpen({ sigma: scale === "4" ? 1.5 : 1.3, m1: 0.4, m2: 2.2 });
      }

      const { data: out, info } = await pipeline
        .jpeg({ quality: OUT_QUALITY[scale], mozjpeg: true, progressive: scale !== "1" })
        .toBuffer({ resolveWithObject: true });

      return ok({
        image: `data:image/jpeg;base64,${out.toString("base64")}`,
        width: info.width,
        height: info.height,
        scale,
      });
    } catch (e) {
      console.error("[studio-enhance] sharp failed:", e);
      return badRequest("This image format could not be processed — please try a JPG, PNG or WEBP photo.");
    }
  });
}
