import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
 * Credentials: the z-ai gateway config is resolved from
 *   1. `Z_AI_CONFIG` env var (JSON: { baseUrl, apiKey, token, chatId, userId })
 *      — the way it is provisioned on Vercel / other serverless hosts;
 *   2. the local `.z-ai-config` file chain (cwd → home → /etc) for dev.
 * The z-ai SDK itself cannot be used on serverless because it only reads the
 * config from the filesystem, which is why this route talks to the gateway
 * directly with the exact same request shape (`images: [{ url }]`).
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

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  chatId?: string;
  userId?: string;
}

/** Resolve the z-ai gateway configuration from env or the local config files. */
function resolveZaiConfig(): ZaiConfig | null {
  // 1) Serverless / production: full JSON config provided via env
  const envRaw = process.env.Z_AI_CONFIG?.trim();
  if (envRaw) {
    try {
      const c = JSON.parse(envRaw) as Partial<ZaiConfig>;
      if (c.baseUrl && c.apiKey) return { ...c, baseUrl: c.baseUrl, apiKey: c.apiKey };
    } catch {
      console.error("[studio-shot] Z_AI_CONFIG env var is not valid JSON");
    }
  }
  // 2) Local dev: same file chain the z-ai SDK uses
  for (const p of [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.homedir(), ".z-ai-config"),
    "/etc/.z-ai-config",
  ]) {
    try {
      const c = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<ZaiConfig>;
      if (c.baseUrl && c.apiKey) return c as ZaiConfig;
    } catch {
      /* try next location */
    }
  }
  return null;
}

function looksLikeImageSource(s: string): boolean {
  if (/^https?:\/\//i.test(s)) return true;
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s);
}

interface EditResponseItem {
  url?: string;
  b64_json?: string;
  base64?: string;
}

async function downloadAsBase64(url: string): Promise<string> {
  // NOTE: deliberately no auth headers — the render is served from a
  // short-lived signed URL that rejects requests carrying them.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the rendered image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
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

    const cfg = resolveZaiConfig();
    if (!cfg) {
      console.error("[studio-shot] no z-ai configuration found (set Z_AI_CONFIG env on this deployment)");
      return badRequest(
        "AI studio is not configured on this deployment — add the Z_AI_CONFIG environment variable and redeploy."
      );
    }

    const presentation = STYLES[styleKey];

    // The design-preservation contract: everything about the piece stays
    // identical — only the photographic presentation is re-staged.
    const prompt = [
      `Professional luxury jewellery catalogue studio photograph of EXACTLY this jewellery piece (${name}).`,
      "The jewellery's design, silhouette, pattern, engraving, gemstones, proportions and colours must remain 100% IDENTICAL to the input photo — do not redesign, add, remove, melt or restyle any part of the piece.",
      `Only change the photographic presentation: place the piece in ${presentation}.`,
      "Razor-sharp macro focus, true-to-life metal and gem colours, crisp realistic reflections, a soft natural shadow, ultra high-resolution catalogue quality.",
    ].join(" ");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "X-Z-AI-From": "Z",
    };
    if (cfg.chatId) headers["X-Chat-Id"] = cfg.chatId;
    if (cfg.userId) headers["X-User-Id"] = cfg.userId;
    if (cfg.token) headers["X-Token"] = cfg.token;

    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/images/generations/edit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt, images: [{ url: rawImage }], size }),
        signal: AbortSignal.timeout(52_000), // stay inside the 60 s function cap
      });
    } catch (e) {
      const aborted = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
      console.error("[studio-shot] gateway request failed:", e);
      return badRequest(
        aborted
          ? "The studio render took too long this time — please try again (a retry usually succeeds)."
          : "Could not reach the AI image service — please try again in a moment."
      );
    }

    if (!res.ok) {
      const errBody = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[studio-shot] gateway ${res.status}:`, errBody);
      const friendly =
        res.status === 401 || res.status === 403
          ? "The AI service rejected the configured credentials — please refresh the Z_AI_CONFIG environment variable."
          : res.status === 429
            ? "The AI service is rate-limited right now — please wait a minute and try again."
            : "The AI image service could not process this photo — please try a different or smaller image.";
      return badRequest(friendly);
    }

    const json = (await res.json().catch(() => null)) as { data?: EditResponseItem[] } | null;
    const item = json?.data?.[0];
    const b64 = item?.base64 ?? item?.b64_json ?? (item?.url ? await downloadAsBase64(item.url) : undefined);
    if (!b64) return badRequest("The studio render came back empty — please try again.");

    // the gateway may return PNG, JPEG or WEBP — label the data URL correctly
    const mime = b64.startsWith("iVBOR")
      ? "image/png"
      : b64.startsWith("/9j/")
        ? "image/jpeg"
        : b64.startsWith("UklGR")
          ? "image/webp"
          : "image/png";

    return ok({ image: `data:${mime};base64,${b64}`, style: styleKey, size });
  });
}
