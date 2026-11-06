"use client";

/**
 * StudioShotDialog — AI "studio photoshoot" generator for the admin panel.
 *
 * Takes any jewellery photo (device upload, gallery image or URL) and produces
 * a professional studio product photograph of the SAME article — the prompt on
 * the server is engineered to keep the physical design of the piece identical
 * and only re-stage the presentation (background, lighting, focus).
 *
 * Flow: pick a look → Generate (15–50 s) → compare side-by-side →
 * add the render as a new gallery image or replace the original photo.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCcw, Sparkles, Wand2, WandSparkles, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api, errMsg, isAuthError } from "./api";

export type StudioStyleKey = "CLASSIC_WHITE" | "LUXURY_BLACK" | "MARBLE_SILK" | "BOUTIQUE_WARM" | "FLOAT_GOLD";

const STYLE_PRESETS: { key: StudioStyleKey; label: string; blurb: string; swatch: string }[] = [
  { key: "CLASSIC_WHITE", label: "Classic White", blurb: "Clean catalogue white, soft even light", swatch: "linear-gradient(150deg,#FFFFFF,#EDEDED)" },
  { key: "LUXURY_BLACK", label: "Luxury Black", blurb: "Dramatic spotlight on deep black", swatch: "linear-gradient(150deg,#3A3A3A,#0A0A0A)" },
  { key: "MARBLE_SILK", label: "Marble & Silk", blurb: "Ivory marble with flowing silk", swatch: "linear-gradient(150deg,#F7F1E5,#E5D9C3)" },
  { key: "BOUTIQUE_WARM", label: "Boutique Warm", blurb: "Velvet cushion, golden bokeh glow", swatch: "linear-gradient(150deg,#F3DFC0,#D9B57C)" },
  { key: "FLOAT_GOLD", label: "Float Gold", blurb: "Floating on a champagne-gold glow", swatch: "linear-gradient(150deg,#F6E7C6,#D4AF37)" },
];

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "Square 1:1" },
  { value: "864x1152", label: "Portrait 3:4" },
];

/** Source images are normalised before upload: anything larger than 1536 px
 *  is downscaled and re-encoded as JPEG so the request stays well inside the
 *  ~4.5 MB serverless body limit (a 12 MP phone photo would exceed it). */
const MAX_SRC_DIM = 1536;
const KEEP_ORIGINAL_CHARS = 900_000;

async function toDataUrl(src: string): Promise<string> {
  if (/^data:image\//i.test(src)) return compressDataUrl(src);
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not read the source image");
  const blob = await res.blob();
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the source image"));
    reader.readAsDataURL(blob);
  });
  return compressDataUrl(raw);
}

async function compressDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.length < KEEP_ORIGINAL_CHARS) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode the source image"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, MAX_SRC_DIM / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    if (scale === 1 && dataUrl.length < 2_200_000) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#FFFFFF"; // flatten any PNG transparency onto studio white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.92);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl; // best effort — the server still validates the final size
  }
}

interface StudioShotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Source image (data URL, /… path or full URL) */
  image: string;
  /** Piece name, woven into the generation prompt */
  productName: string;
  /** Called with the generated data URL once the user approves it */
  onUse: (dataUrl: string, mode: "add" | "replace") => void;
}

export default function StudioShotDialog({ open, onOpenChange, image, productName, onUse }: StudioShotDialogProps) {
  const [mode, setMode] = useState<"ai" | "instant">("ai");
  const [style, setStyle] = useState<StudioStyleKey>("CLASSIC_WHITE");
  const [size, setSize] = useState("1024x1024");
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset whenever a new source image is offered
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setAiUnavailable(false);
    setElapsed(0);
    setSource(image.startsWith("data:") ? image : null);
    if (!image.startsWith("data:")) {
      toDataUrl(image)
        .then(setSource)
        .catch(() => setError("Could not read the source image."));
    }
  }, [open, image]);

  function switchMode(next: "ai" | "instant") {
    if (generating || mode === next) return;
    setMode(next);
    setResult(null);
    setError(null);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function generate() {
    if (!source || generating) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    startTimer();
    try {
      if (mode === "instant") {
        const res = await api<{ image: string }>("/api/admin/studio-enhance", {
          method: "POST",
          body: JSON.stringify({ image: source }),
        });
        setResult(res.image);
        toast.success("Enhanced photo ready", { description: "Clean catalogue look — design untouched." });
      } else {
        const res = await api<{ image: string }>("/api/admin/studio-shot", {
          method: "POST",
          body: JSON.stringify({ image: source, style, size, name: productName }),
        });
        setResult(res.image);
        setAiUnavailable(false);
        toast.success("Studio shot ready", { description: "Compare it with the original below." });
      }
    } catch (e) {
      if (!isAuthError(e)) {
        const msg = errMsg(e);
        setError(msg);
        if (mode === "ai" && /reach the AI image service|not configured|free tier|billing/i.test(msg)) setAiUnavailable(true);
        toast.error(mode === "instant" ? "Enhance failed" : "Studio render failed", { description: msg });
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
    }
  }

  const active = STYLE_PRESETS.find((s) => s.key === style)!;

  return (
    <Dialog open={open} onOpenChange={(o) => !generating && onOpenChange(o)}>
      <DialogContent className="admin-scroll max-h-[92vh] overflow-y-auto border-[#EAE2D3] sm:max-w-3xl">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">
            {mode === "ai" ? "AI studio" : "Studio tools"}
          </p>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#1C1A16]">
            <Sparkles className="size-5 text-[#D4AF37]" aria-hidden /> Studio photoshoot
          </DialogTitle>
          <DialogDescription>
            {mode === "ai" ? (
              <>
                Re-photographs <span className="font-medium text-[#1C1A16]">{productName}</span> in a professional
                studio set-up — the physical design of the piece is preserved exactly, only the staging changes.
              </>
            ) : (
              <>
                Cleans up <span className="font-medium text-[#1C1A16]">{productName}</span> for catalogue use in about
                a second — no AI involved, so the design is guaranteed untouched.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ---------- mode switcher ---------- */}
        <div className="flex rounded-md border border-[#EAE2D3] p-0.5" role="tablist" aria-label="Studio mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ai"}
            onClick={() => switchMode("ai")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "ai" ? "bg-[#171717] text-white" : "text-[#5A544A] hover:bg-[#F3EFE5]"
            )}
          >
            <Sparkles className="size-3.5" aria-hidden /> AI scene <span className="hidden text-[10px] font-normal opacity-70 sm:inline">· full re-staging</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "instant"}
            onClick={() => switchMode("instant")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "instant" ? "bg-[#171717] text-white" : "text-[#5A544A] hover:bg-[#F3EFE5]"
            )}
          >
            <Zap className="size-3.5" aria-hidden /> Instant clean-up <span className="hidden text-[10px] font-normal opacity-70 sm:inline">· no AI, ~1s</span>
          </button>
        </div>

        {/* ---------- look picker (AI mode only) ---------- */}
        {mode === "ai" && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[#8A8375]">Choose the look</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setStyle(preset.key)}
                  aria-pressed={style === preset.key}
                  className={cn(
                    "group rounded-lg border p-2 text-left transition-all",
                    style === preset.key
                      ? "border-[#D4AF37] ring-1 ring-[#D4AF37]"
                      : "border-[#EAE2D3] hover:border-[#D4AF37]/60"
                  )}
                >
                  <span className="mb-1.5 block h-10 w-full rounded" style={{ background: preset.swatch }} aria-hidden />
                  <span className="block text-xs font-medium text-[#1C1A16]">{preset.label}</span>
                  <span className="block text-[10px] leading-snug text-[#B0A88F]">{preset.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mode === "ai" && (
            <div className="flex rounded-md border border-[#EAE2D3] p-0.5">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSize(opt.value)}
                  aria-pressed={size === opt.value}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs transition-colors",
                    size === opt.value ? "bg-[#171717] text-white" : "text-[#5A544A] hover:bg-[#F3EFE5]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <Button
            type="button"
            onClick={generate}
            disabled={generating || !source}
            className="bg-[#171717] text-white hover:bg-[#2A2824]"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> {mode === "instant" ? "Polishing…" : "Rendering…"} {elapsed}s
              </>
            ) : result ? (
              <>
                <RefreshCcw className="size-4" aria-hidden /> {mode === "instant" ? "Enhance again" : "Re-generate"}
              </>
            ) : (
              <>
                {mode === "instant" ? <WandSparkles className="size-4" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
                {mode === "instant" ? "Enhance photo" : "Generate studio shot"}
              </>
            )}
          </Button>
          <p className="text-[11px] text-[#B0A88F]">
            {generating
              ? mode === "instant"
                ? "Applying the studio clean-up…"
                : "Usually takes 15–50 seconds — keep this panel open."
              : mode === "instant"
                ? "White background, auto-levels, crisp macro sharpening — design untouched."
                : `${active.label} · ${active.blurb.toLowerCase()}`}
          </p>
        </div>

        {error && (
          <div role="alert" className="space-y-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-700">{error}</p>
            {aiUnavailable && (
              <p className="text-xs text-red-600/80">
                Tip: switch to <strong>Instant clean-up</strong> — it works without the AI service on every deployment.
                {/billing|free tier/i.test(error) && (
                  <>
                    {" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-800"
                    >
                      Enable billing in Google AI Studio →
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* ---------- comparison ---------- */}
        {(source || result || generating) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <figure className="space-y-1.5">
              <figcaption className="text-[10px] uppercase tracking-[0.25em] text-[#B0A88F]">Original photo</figcaption>
              <div className="aspect-square overflow-hidden rounded-lg border border-[#EAE2D3] bg-[#FBF9F4]">
                {source ? (                  <img src={source} alt="Original product photo" className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#B0A88F]">Reading image…</div>
                )}
              </div>
            </figure>
            <figure className="space-y-1.5">
              <figcaption className="text-[10px] uppercase tracking-[0.25em] text-[#B0A88F]">Studio render</figcaption>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-[#D4AF37]/40 bg-[#FBF9F4]">
                {generating ? (
                  <div className="grid h-full place-items-center gap-2 text-center">
                    <div>
                      <Loader2 className="mx-auto size-6 animate-spin text-[#D4AF37]" aria-hidden />
                      <p className="mt-2 text-xs text-[#8A8375]">
                        {mode === "instant" ? "Polishing the photo…" : "Setting up the lights…"} {elapsed}s
                      </p>
                    </div>
                  </div>
                ) : result ? (                  <img src={result} alt="Generated studio photograph" className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#B0A88F]">
                    {source
                      ? mode === "instant"
                        ? "Press Enhance for the instant clean-up"
                        : "Press Generate to stage the shoot"
                      : "—"}
                  </div>
                )}
              </div>
            </figure>
          </div>
        )}

        {/* ---------- actions ---------- */}
        {result && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#EAE2D3] pt-4">
            <Button
              type="button"
              onClick={() => {
                onUse(result, "add");
                onOpenChange(false);
              }}
              className="bg-[#171717] text-white hover:bg-[#2A2824]"
            >
              <Check className="size-4" aria-hidden /> Add as new image
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onUse(result, "replace");
                onOpenChange(false);
              }}
              className="border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10"
            >
              Replace original
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResult(null)}
              className="text-[#8A8375] hover:text-[#1C1A16]"
            >
              <X className="size-4" aria-hidden /> Discard
            </Button>
            <p className="text-[11px] italic text-[#B0A88F]">
              Not quite right? Re-generate — every render is a fresh take.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
