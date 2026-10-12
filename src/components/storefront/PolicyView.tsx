"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const LABELS: Record<string, { title: string; eyebrow: string }> = {
  shipping: { title: "Shipping Policy", eyebrow: "Insured · Signed · Swift" },
  returns: { title: "Returns & Refunds", eyebrow: "30-day promise" },
  privacy: { title: "Privacy Policy", eyebrow: "Your data, respected" },
  terms: { title: "Terms & Conditions", eyebrow: "The fine print, in plain words" },
};

export default function PolicyView() {
  const params = useApp((s) => s.params);
  const settings = useApp((s) => s.settings);
  const navigate = useApp((s) => s.navigate);
  const key = params.policy ?? "shipping";
  const meta = LABELS[key] ?? LABELS.shipping;

  useEffect(() => {
    if (!useApp.getState().settings) {
      fetch("/api/settings").then((r) => r.json()).then((d) => d.settings && useApp.getState().setSettings(d.settings)).catch(() => null);
    }
  }, []);

  const textMap: Record<string, string> = {
    shipping: settings?.shippingPolicy ?? "",
    returns: settings?.returnsPolicy ?? "",
    privacy: settings?.privacyPolicy ?? "",
    terms: settings?.termsPolicy ?? "",
  };
  const body = textMap[key] || "This policy is being updated. Please contact us for the current version.";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <header className="mb-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">{meta.eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">{meta.title}</h1>
        {settings && <p className="mt-3 text-xs text-muted-foreground">Last updated {formatDate(settings.updatedAt ? new Date(settings.updatedAt) : new Date())}</p>}
      </header>

      <article className="rounded-xl border border-[#D4AF37]/25 bg-white p-6 sm:p-10">
        {body.split("\n").filter(Boolean).map((p, i) => {
          if (p.trim().startsWith("•")) {
            return (
              <p key={i} className="flex gap-3 py-1.5 pl-4 text-[15px] leading-relaxed text-muted-foreground">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#D4AF37]" aria-hidden />
                <span>{p.replace(/^•\s*/, "")}</span>
              </p>
            );
          }
          return <p key={i} className="py-2 leading-relaxed text-[15px] text-foreground/85">{p}</p>;
        })}
      </article>

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="outline" className="border-[#D4AF37]/50 text-[#A8862A] hover:bg-[#D4AF37] hover:text-black" onClick={() => navigate("contact")}>
          Questions? Contact us
        </Button>
      </div>
    </div>
  );
}
