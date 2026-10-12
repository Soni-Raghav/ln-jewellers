"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { waGeneralInquiry } from "@/lib/format";

export default function FaqView() {
  const settings = useApp((s) => s.settings);
  const navigate = useApp((s) => s.navigate);

  useEffect(() => {
    if (!useApp.getState().settings) {
      fetch("/api/settings").then((r) => r.json()).then((d) => d.settings && useApp.getState().setSettings(d.settings)).catch(() => null);
    }
  }, []);

  const faq = settings?.faq ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <header className="mb-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">Good questions, honest answers</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">Frequently Asked</h1>
      </header>

      {faq.length > 0 ? (
        <Accordion type="single" collapsible className="rounded-xl border border-[#D4AF37]/25 bg-white px-6">
          {faq.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="font-serif text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed border-[#D4AF37]/30 py-16 text-center text-sm text-muted-foreground">
          FAQ is being written — message us directly for anything you need to know.
        </div>
      )}

      <div className="mt-10 rounded-xl border border-[#D4AF37]/30 bg-[#0A0A0A] p-8 text-center">
        <h2 className="font-serif text-2xl text-[#FAF7F0]">Still curious?</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[#FAF7F0]/60">Our concierge answers on WhatsApp within business hours — real humans, no bots.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {settings && (
            <a href={waGeneralInquiry(settings)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#25D366] px-5 text-sm font-medium text-white hover:bg-[#1fb857]">
              <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
            </a>
          )}
          <Button onClick={() => navigate("contact")} variant="outline" className="border-[#D4AF37]/50 text-[#E6C87A] hover:bg-[#D4AF37] hover:text-black">
            Contact form
          </Button>
        </div>
      </div>
    </div>
  );
}
