"use client";

/**
 * StudioShotDialog — one-click "Instant clean-up" for product photos.
 *
 * Takes any jewellery photo (device upload, gallery image or URL) and produces
 * a catalogue-ready version in about a second: white background, auto levels,
 * gentle colour lift and crisp macro sharpening — powered purely by the
 * server-side sharp pipeline (NO AI service involved), so the physical design
 * of the piece is guaranteed untouched.
 *
 * Flow: open → Enhance (~1 s) → compare side-by-side →
 * add the cleaned photo as a new gallery image or replace the original.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCcw, Sparkles, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg, isAuthError } from "./api";

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
  /** Piece name, shown in the dialog copy */
  productName: string;
  /** Called with the cleaned data URL once the user approves it */
  onUse: (dataUrl: string, mode: "add" | "replace") => void;
}

export default function StudioShotDialog({ open, onOpenChange, image, productName, onUse }: StudioShotDialogProps) {
  const [enhancing, setEnhancing] = useState(false);
  const [scale, setScale] = useState<"1" | "2" | "4">("1");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SCALE_OPTIONS: { value: "1" | "2" | "4"; label: string; hint: string }[] = [
    { value: "1", label: "Standard 1×", hint: "Catalogue 1600 px" },
    { value: "2", label: "Large 2×", hint: "Up to 3200 px" },
    { value: "4", label: "Max 4×", hint: "Marketplace-ready" },
  ];

  // Reset whenever a new source image is offered
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setDims(null);
    setElapsed(0);
    setSource(image.startsWith("data:") ? image : null);
    if (!image.startsWith("data:")) {
      toDataUrl(image)
        .then(setSource)
        .catch(() => setError("Could not read the source image."));
    }
  }, [open, image]);

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

  async function enhance() {
    if (!source || enhancing) return;
    setEnhancing(true);
    setError(null);
    setResult(null);
    setDims(null);
    startTimer();
    try {
      const res = await api<{ image: string; width?: number; height?: number; scale?: string }>(
        "/api/admin/studio-enhance",
        {
          method: "POST",
          body: JSON.stringify({ image: source, scale }),
        }
      );
      setResult(res.image);
      if (res.width && res.height) setDims({ w: res.width, h: res.height });
      toast.success("Cleaned-up photo ready", {
        description:
          res.width && res.height
            ? `Catalogue look at ${res.width} × ${res.height} px — design untouched.`
            : "Catalogue look — design untouched.",
      });
    } catch (e) {
      if (!isAuthError(e)) {
        const msg = errMsg(e);
        setError(msg);
        toast.error("Clean-up failed", { description: msg });
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setEnhancing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !enhancing && onOpenChange(o)}>
      <DialogContent className="admin-scroll max-h-[92vh] overflow-y-auto border-[#EAE2D3] sm:max-w-3xl">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">Studio tools</p>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#1C1A16]">
            <Sparkles className="size-5 text-[#D4AF37]" aria-hidden /> Studio clean-up
          </DialogTitle>
          <DialogDescription>
            Cleans up <span className="font-medium text-[#1C1A16]">{productName}</span> for catalogue use in about a
            second — no AI involved, so the design is guaranteed untouched.
          </DialogDescription>
        </DialogHeader>

        {/* ---------- output size ---------- */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8A8375]">Output size</p>
          <div className="grid grid-cols-3 gap-2">
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScale(opt.value)}
                aria-pressed={scale === opt.value}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-all",
                  scale === opt.value
                    ? "border-[#D4AF37] ring-1 ring-[#D4AF37]"
                    : "border-[#EAE2D3] hover:border-[#D4AF37]/60"
                )}
              >
                <span className="block text-xs font-medium text-[#1C1A16]">{opt.label}</span>
                <span className="block text-[10px] leading-snug text-[#B0A88F]">{opt.hint}</span>
              </button>
            ))}
          </div>
          {scale !== "1" && (
            <p className="text-[11px] text-[#8A8375]">
              Upscales with Lanczos3 resampling + unsharp mask — meets marketplace minimums (Amazon, Flipkart,
              Myntra). Larger files, same crisp piece.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={enhance}
            disabled={enhancing || !source}
            className="bg-[#171717] text-white hover:bg-[#2A2824]"
          >
            {enhancing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Polishing… {elapsed}s
              </>
            ) : result ? (
              <>
                <RefreshCcw className="size-4" aria-hidden /> Enhance again
              </>
            ) : (
              <>
                <WandSparkles className="size-4" aria-hidden /> Enhance photo
              </>
            )}
          </Button>
          <p className="text-[11px] text-[#B0A88F]">
            {enhancing
              ? scale !== "1"
                ? "Upscaling & polishing…"
                : "Applying the studio clean-up…"
              : scale === "1"
                ? "White background, auto-levels, crisp macro sharpening — design untouched."
                : "Larger resolution, white background, auto-levels, sharpened detail — design untouched."}
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ---------- comparison ---------- */}
        {(source || result || enhancing) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <figure className="space-y-1.5">
              <figcaption className="text-[10px] uppercase tracking-[0.25em] text-[#B0A88F]">Original photo</figcaption>
              <div className="aspect-square overflow-hidden rounded-lg border border-[#EAE2D3] bg-[#FBF9F4]">
                {source ? (
                  <img src={source} alt="Original product photo" className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#B0A88F]">Reading image…</div>
                )}
              </div>
            </figure>
            <figure className="space-y-1.5">
              <figcaption className="text-[10px] uppercase tracking-[0.25em] text-[#B0A88F]">
                Cleaned-up photo{dims ? ` · ${dims.w} × ${dims.h} px` : ""}
              </figcaption>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-[#D4AF37]/40 bg-[#FBF9F4]">
                {enhancing ? (
                  <div className="grid h-full place-items-center gap-2 text-center">
                    <div>
                      <Loader2 className="mx-auto size-6 animate-spin text-[#D4AF37]" aria-hidden />
                      <p className="mt-2 text-xs text-[#8A8375]">Polishing the photo… {elapsed}s</p>
                    </div>
                  </div>
                ) : result ? (
                  <img src={result} alt="Cleaned-up product photograph" className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#B0A88F]">
                    {source ? "Press Enhance for the instant clean-up" : "—"}
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
              Not quite right? Enhance again — every pass is a fresh take.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
