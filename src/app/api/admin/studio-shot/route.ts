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
 * Providers (first match wins — set one on your deployment):
 *   1. GEMINI_API_KEY   → Google AI Studio image models (nano banana family).
 *                         Free key from https://aistudio.google.com/apikey —
 *                         works from any host incl. Vercel. (production path)
 *                         Supports both the classic "AIza…" keys and the newer
 *                         "AQ.…" key format. NOTE: Google has moved image
 *                         generation to the paid tier — free-tier keys get
 *                         quota errors with "limit: 0", surfaced to the admin
 *                         as an actionable "enable billing" message.
 *   2. Z_AI_CONFIG env  → the z-ai gateway, JSON { baseUrl, apiKey, token,
 *                         chatId, userId } (reachable from this dev sandbox).
 *   3. Local config     → .z-ai-config file chain (cwd → home → /etc) for dev.
 *
 * Body: { image: dataUrl|httpUrl, style: preset key, size?: string, name?: string }
 * Returns: { image: "data:image/png;base64,…", provider }
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
const ASPECT_BY_SIZE: Record<string, string> = {
  "1024x1024": "1:1",
  "864x1152": "3:4",
  "1152x864": "4:3",
  "1344x768": "16:9",
  "768x1344": "9:16",
};

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
  const envRaw = process.env.Z_AI_CONFIG?.trim();
  if (envRaw) {
    try {
      const c = JSON.parse(envRaw) as Partial<ZaiConfig>;
      if (c.baseUrl && c.apiKey) return c as ZaiConfig;
    } catch {
      console.error("[studio-shot] Z_AI_CONFIG env var is not valid JSON");
    }
  }
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

function parseDataUrl(s: string): { mime: string; base64: string } | null {
  const m = /^data:(image\/[a-z+]+);base64,([\s\S]+)$/i.exec(s);
  return m ? { mime: m[1].toLowerCase(), base64: m[2] } : null;
}

async function sourceToInline(
  rawImage: string
): Promise<{ mime: string; base64: string } | { error: string }> {
  if (rawImage.startsWith("data:")) {
    const parsed = parseDataUrl(rawImage);
    return parsed ?? { error: "Unsupported data URL" };
  }
  try {
    const res = await fetch(rawImage, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { error: "Could not fetch the source image — upload the photo directly instead." };
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0].toLowerCase();
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { mime: mime.startsWith("image/") ? mime : "image/jpeg", base64 };
  } catch {
    return { error: "Could not fetch the source image — upload the photo directly instead." };
  }
}

// ------------------------------------------------------------------ Gemini
// Image models to try, in order — Google renames/retires models for new
// accounts periodically, so we fall back across the current nano-banana
// family instead of hard-coding one name.
const GEMINI_IMAGE_MODELS = [
  process.env.GEMINI_IMAGE_MODEL, // explicit override always wins
  "gemini-2.5-flash-image", // nano banana (paid tier ≈ $0.04 / image)
  "gemini-3.1-flash-image", // newer flash image generation
  "gemini-3-pro-image-preview", // pro fallback
].filter((m): m is string => !!m?.trim());

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

async function generateWithGemini(
  prompt: string,
  src: { mime: string; base64: string },
  aspect: string
): Promise<{ image?: string; error?: string }> {
  const key = process.env.GEMINI_API_KEY as string;
  const url = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const buildBody = (withImageConfig: boolean) => ({
    contents: [
      {
        parts: [{ text: prompt }, { inlineData: { mimeType: src.mime, data: src.base64 } }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(withImageConfig ? { imageConfig: { aspectRatio: aspect } } : {}),
    },
  });

  let lastError =
    "The AI image service could not process this photo — please try a different or smaller image.";

  for (const model of GEMINI_IMAGE_MODELS) {
    let res: Response;
    try {
      res = await fetch(url(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(buildBody(true)),
        signal: AbortSignal.timeout(45_000),
      });
      // some API revisions reject imageConfig — retry without it
      if (res.status === 400) {
        const t = await res.clone().text();
        if (/imageConfig|aspect/i.test(t)) {
          res = await fetch(url(model), {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(buildBody(false)),
            signal: AbortSignal.timeout(45_000),
          });
        }
      }
    } catch (e) {
      const aborted = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
      console.error(`[studio-shot] gemini ${model} request failed:`, e);
      return {
        error: aborted
          ? "The studio render took too long — please try again."
          : "Could not reach the AI image service — please try again in a moment.",
      };
    }

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { candidates?: { content?: { parts?: GeminiPart[] } }[] }
        | null;
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
      const b64 = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
      const mime =
        imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? "image/png";
      if (!b64) {
        lastError = "The studio render came back empty — please try again.";
        continue;
      }
      return { image: `data:${mime};base64,${b64}` };
    }

    const errBody = (await res.text().catch(() => "")).slice(0, 600);
    console.error(`[studio-shot] gemini ${model} ${res.status}:`, errBody);

    // Terminal errors — trying other models will not help.
    if (res.status === 429) {
      return {
        error: /limit: 0/.test(errBody)
          ? "Google's free tier no longer includes image generation. Enable billing (pay-as-you-go, ≈ $0.04 per image) on the Google AI Studio project behind GEMINI_API_KEY to unlock AI scene shots — or use the Instant clean-up tab, which is always free."
          : "The AI service is rate-limited right now — please wait a minute and try again.",
      };
    }
    if (res.status === 401 || res.status === 403 || /API key not valid/i.test(errBody)) {
      return {
        error: "The configured GEMINI_API_KEY is not valid — please refresh it.",
      };
    }
    if (res.status === 400 && /User location is not supported/i.test(errBody)) {
      return {
        error:
          "The Gemini API is not available from this deployment's region — please move the deployment to a supported region.",
      };
    }

    // 404 / unknown-model / other 400s → fall through to the next candidate.
    lastError =
      res.status === 404
        ? "The AI image service could not process this photo — please try a different or smaller image."
        : res.status === 400
          ? "The AI image service rejected this request — please try a different or smaller image."
          : lastError;
  }
  return { error: lastError };
}

// ------------------------------------------------------------- z-ai gateway
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

async function generateWithZai(
  cfg: ZaiConfig,
  prompt: string,
  rawImage: string,
  size: string
): Promise<{ image?: string; error?: string }> {
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
      signal: AbortSignal.timeout(52_000),
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
    console.error("[studio-shot] gateway request failed:", e);
    return {
      error: aborted
        ? "The studio render took too long this time — please try again (a retry usually succeeds)."
        : "Could not reach the AI image service — please try again in a moment.",
    };
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
    return { error: friendly };
  }

  const json = (await res.json().catch(() => null)) as { data?: EditResponseItem[] } | null;
  const item = json?.data?.[0];
  const b64 = item?.base64 ?? item?.b64_json ?? (item?.url ? await downloadAsBase64(item.url) : undefined);
  if (!b64) return { error: "The studio render came back empty — please try again." };

  const mime = b64.startsWith("iVBOR")
    ? "image/png"
    : b64.startsWith("/9j/")
      ? "image/jpeg"
      : b64.startsWith("UklGR")
        ? "image/webp"
        : "image/png";
  return { image: `data:${mime};base64,${b64}` };
}

// ------------------------------------------------------------------- route
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

    // The design-preservation contract: everything about the piece stays
    // identical — only the photographic presentation is re-staged.
    const presentation = STYLES[styleKey];
    const prompt = [
      `Professional luxury jewellery catalogue studio photograph of EXACTLY this jewellery piece (${name}).`,
      "The jewellery's design, silhouette, pattern, engraving, gemstones, proportions and colours must remain 100% IDENTICAL to the input photo — do not redesign, add, remove, melt or restyle any part of the piece.",
      `Only change the photographic presentation: place the piece in ${presentation}.`,
      "Razor-sharp macro focus, true-to-life metal and gem colours, crisp realistic reflections, a soft natural shadow, ultra high-resolution catalogue quality.",
    ].join(" ");

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      const src = await sourceToInline(rawImage);
      if ("error" in src) return badRequest(src.error);
      const aspect = ASPECT_BY_SIZE[size] ?? "1:1";
      const out = await generateWithGemini(prompt, src, aspect);
      if (out.error) return badRequest(out.error);
      return ok({ image: out.image, provider: "gemini", style: styleKey, size });
    }

    const zaiCfg = resolveZaiConfig();
    if (zaiCfg) {
      const out = await generateWithZai(zaiCfg, prompt, rawImage, size);
      if (out.error) return badRequest(out.error);
      return ok({ image: out.image, provider: "zai-gateway", style: styleKey, size });
    }

    return badRequest(
      "AI studio is not configured on this deployment — add GEMINI_API_KEY (free at aistudio.google.com/apikey) and redeploy."
    );
  });
}
