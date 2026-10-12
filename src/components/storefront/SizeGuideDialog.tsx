"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { waGeneralInquiry } from "@/lib/format";

// ---------- Data ----------
// Indian (BIS) standard ring sizes: circumference steps of +1.25 mm from 41.5 mm.
// US equivalent derived from the US standard diameter chart: US ≈ (Indian + 3) / 2.
const RING_SIZES = [
  { indian: 5, us: 4, dia: 14.8, circ: 46.5 },
  { indian: 6, us: 4.5, dia: 15.2, circ: 47.8 },
  { indian: 7, us: 5, dia: 15.6, circ: 49.0 },
  { indian: 8, us: 5.5, dia: 16.0, circ: 50.3 },
  { indian: 9, us: 6, dia: 16.4, circ: 51.5 },
  { indian: 10, us: 6.5, dia: 16.8, circ: 52.8 },
  { indian: 11, us: 7, dia: 17.2, circ: 54.0 },
  { indian: 12, us: 7.5, dia: 17.6, circ: 55.3 },
  { indian: 13, us: 8, dia: 18.0, circ: 56.6 },
  { indian: 14, us: 8.5, dia: 18.4, circ: 57.8 },
  { indian: 15, us: 9, dia: 18.8, circ: 59.1 },
];

const BANGLE_SIZES = [
  { size: "2.2", fit: "XS", dia: "55 – 56 mm", wrist: "Very slender" },
  { size: "2.4", fit: "S", dia: "60 – 61 mm", wrist: "Slim" },
  { size: "2.6", fit: "M", dia: "65 – 66 mm", wrist: "Average" },
  { size: "2.8", fit: "L", dia: "70 – 71 mm", wrist: "Fuller" },
  { size: "2.10", fit: "XL", dia: "75 – 76 mm", wrist: "Broad" },
];

const CHAIN_LENGTHS = [
  { len: "14 in", name: "Choker", sits: "Snug around the neck" },
  { len: "16 in", name: "Princess", sits: "Just below the collarbone — our most-loved length" },
  { len: "18 in", name: "Matinee", sits: "At or just above the neckline" },
  { len: "20 in", name: "Opera", sits: "Below the neckline — elegant over kurtas" },
  { len: "24 in", name: "Rope", sits: "Down to the sternum — layered statement" },
];

type GuideId = "ring" | "bangle" | "chain";

function guideForCategory(categorySlug?: string): GuideId[] {
  if (categorySlug === "rings") return ["ring"];
  if (categorySlug === "bracelets-bangles") return ["bangle"];
  if (categorySlug === "necklaces") return ["chain"];
  return ["ring", "bangle", "chain"];
}

export default function SizeGuideDialog({
  categorySlug,
  categoryName,
}: {
  categorySlug?: string;
  categoryName?: string;
}) {
  const [open, setOpen] = useState(false);
  const settings = useApp((s) => s.settings);
  const waHref = settings ? waGeneralInquiry(settings) : "#";
  const guides = guideForCategory(categorySlug);
  const [tab, setTab] = useState<GuideId>(guides[0]);
  const tabs: { id: GuideId; label: string }[] = [
    { id: "ring", label: "Ring sizes" },
    { id: "bangle", label: "Bangle sizes" },
    { id: "chain", label: "Chain lengths" },
  ];
  const active = guides.includes(tab) ? tab : guides[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A8862A] underline decoration-[#D4AF37]/40 underline-offset-4 transition-colors hover:text-[#7A5E14] hover:decoration-[#D4AF37]"
          aria-label="Open size guide"
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden /> Size guide
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[#D4AF37]/30 bg-[#FAF7F0] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Size guide</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {categoryName ? `Sizing for ${categoryName.toLowerCase()} — ` : ""}measure at home in a minute. Still unsure? Our atelier confirms every size on WhatsApp before your piece is dispatched.
          </DialogDescription>
        </DialogHeader>

        {guides.length > 1 && (
          <div className="flex gap-1.5" role="tablist" aria-label="Size guide sections">
            {tabs
              .filter((t) => guides.includes(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active === t.id
                      ? "border-[#D4AF37] bg-[#0A0A0A] text-[#E6C87A]"
                      : "border-[#D4AF37]/30 bg-white text-muted-foreground hover:border-[#D4AF37]"
                  )}
                >
                  {t.label}
                </button>
              ))}
          </div>
        )}

        {active === "ring" && (
          <div>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Indian to US ring size conversion</caption>
              <thead>
                <tr className="border-b border-[#D4AF37]/40 text-left text-[10px] uppercase tracking-widest text-[#A8862A]">
                  <th className="py-2 font-medium">Indian</th>
                  <th className="py-2 font-medium">US</th>
                  <th className="py-2 font-medium">Diameter</th>
                  <th className="py-2 font-medium">Circumference</th>
                </tr>
              </thead>
              <tbody>
                {RING_SIZES.map((r) => (
                  <tr key={r.indian} className="border-b border-[#EAE2D3]/70 transition-colors hover:bg-[#D4AF37]/[0.06]">
                    <td className="py-1.5 font-serif font-medium">{r.indian}</td>
                    <td className="py-1.5 text-muted-foreground">{r.us}</td>
                    <td className="py-1.5 text-muted-foreground">{r.dia} mm</td>
                    <td className="py-1.5 text-muted-foreground">{r.circ} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 rounded-lg border border-[#D4AF37]/25 bg-white p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">How to measure</p>
              <p>
                Wrap a thin strip of paper snugly around the base of your finger, mark where it meets, and measure the
                length in mm — that is your circumference. Match it above. Measure at the end of the day when fingers
                are warm and largest.
              </p>
            </div>
          </div>
        )}

        {active === "bangle" && (
          <div>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Indian bangle size chart</caption>
              <thead>
                <tr className="border-b border-[#D4AF37]/40 text-left text-[10px] uppercase tracking-widest text-[#A8862A]">
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 font-medium">Fit</th>
                  <th className="py-2 font-medium">Inner diameter</th>
                  <th className="py-2 font-medium">Wrist</th>
                </tr>
              </thead>
              <tbody>
                {BANGLE_SIZES.map((b) => (
                  <tr key={b.size} className="border-b border-[#EAE2D3]/70 transition-colors hover:bg-[#D4AF37]/[0.06]">
                    <td className="py-1.5 font-serif font-medium">{b.size}&quot;</td>
                    <td className="py-1.5 text-muted-foreground">{b.fit}</td>
                    <td className="py-1.5 text-muted-foreground">{b.dia}</td>
                    <td className="py-1.5 text-muted-foreground">{b.wrist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 rounded-lg border border-[#D4AF37]/25 bg-white p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">How to measure</p>
              <p>
                Take a bangle that already fits you and measure its inner diameter across the widest point. No bangle at
                hand? Touch your thumb to the base of your little finger and measure around the widest part of the hand
                at the knuckles with a soft tape — that circumference ÷ 3.14 gives your bangle diameter.
              </p>
            </div>
          </div>
        )}

        {active === "chain" && (
          <div>
            <ul className="divide-y divide-[#EAE2D3]/70 overflow-hidden rounded-lg border border-[#EAE2D3] bg-white">
              {CHAIN_LENGTHS.map((c) => (
                <li key={c.len} className="flex items-baseline gap-4 px-4 py-3 transition-colors hover:bg-[#D4AF37]/[0.06]">
                  <span className="w-16 shrink-0 font-serif text-base font-medium">{c.len}</span>
                  <span className="w-20 shrink-0 text-xs uppercase tracking-widest text-[#A8862A]">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.sits}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-[#D4AF37]/25 bg-white p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">How to measure</p>
              <p>
                Cut a length of string, drape it to where you would like the necklace to fall, then measure it flat. For
                pendants, 16–18 in keeps the piece visible above most necklines.
              </p>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Need a size we do not list, or a bespoke fit?{" "}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="text-[#A8862A] underline underline-offset-2 hover:text-[#7A5E14]"
          >
            Message the atelier on WhatsApp
          </a>{" "}
          — custom sizing is always complimentary.
        </p>
      </DialogContent>
    </Dialog>
  );
}
