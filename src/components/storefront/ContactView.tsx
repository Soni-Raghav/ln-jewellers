"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Clock, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { waGeneralInquiry } from "@/lib/format";

const SUBJECTS = ["Custom / bespoke enquiry", "Order status", "Returns & exchange", "Size guidance", "Wholesale / press", "Something else"];

export default function ContactView() {
  const settings = useApp((s) => s.settings);
  const navigate = useApp((s) => s.navigate);

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!useApp.getState().settings) {
      fetch("/api/settings").then((r) => r.json()).then((d) => d.settings && useApp.getState().setSettings(d.settings)).catch(() => null);
    }
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFields({});
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFields(data.fields ?? {});
        return;
      }
      setDone(true);
    } catch {
      setFields({ message: "Network error — please try again or reach us on WhatsApp" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <header className="mb-12 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">We answer personally</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">Contact the Atelier</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          A real person — usually our founder or concierge lead — replies to every message within 24 hours.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        {/* form */}
        <section className="rounded-xl border border-[#D4AF37]/25 bg-white p-6 sm:p-8" aria-label="Contact form">
          {done ? (
            <div className="grid place-items-center py-14 text-center">
              <span className="mb-5 grid h-16 w-16 place-items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10">
                <CheckCircle2 className="h-8 w-8 text-[#A8862A]" strokeWidth={1.5} />
              </span>
              <h2 className="font-serif text-2xl">Message received</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Our concierge will reply to <strong className="text-foreground">{form.email}</strong> within 24 hours. For urgent orders, WhatsApp is faster.
              </p>
              <Button className="mt-6 bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]" onClick={() => navigate("shop")}>Continue browsing</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Name <span className="text-[#A8862A]">*</span></Label>
                <Input value={form.name} onChange={set("name")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Your name" required />
                {fields.name && <p className="mt-1 text-xs text-destructive">{fields.name}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Email <span className="text-[#A8862A]">*</span></Label>
                <Input type="email" value={form.email} onChange={set("email")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="you@example.com" required />
                {fields.email && <p className="mt-1 text-xs text-destructive">{fields.email}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={set("phone")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="+91 98XXX XXXXX" />
                {fields.phone && <p className="mt-1 text-xs text-destructive">{fields.phone}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Subject <span className="text-[#A8862A]">*</span></Label>
                <select
                  value={form.subject}
                  onChange={set("subject")}
                  className="h-10 w-full rounded-md border border-[#D4AF37]/40 bg-[#FAF7F0] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  aria-label="Subject"
                >
                  <option value="">Select a subject…</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {fields.subject && <p className="mt-1 text-xs text-destructive">{fields.subject}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Message <span className="text-[#A8862A]">*</span></Label>
                <Textarea value={form.message} onChange={set("message")} rows={6} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Tell us about the piece, the occasion, the timeline you have in mind…" required />
                {fields.message && <p className="mt-1 text-xs text-destructive">{fields.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={sending} className="h-12 w-full bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
                  <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send message"}
                </Button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Protected by rate limiting. For order urgencies, WhatsApp is faster.
                </p>
              </div>
            </form>
          )}
        </section>

        {/* info cards */}
        <aside className="space-y-4">
          {settings && (
            <>
              <InfoCard icon={MapPin} title="The Atelier">
                <p className="leading-relaxed">{settings.address}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-[#A8862A] underline underline-offset-2 hover:text-[#D4AF37]"
                >
                  Get directions →
                </a>
              </InfoCard>
              <InfoCard icon={Clock} title="Business hours"><p>{settings.businessHours}</p></InfoCard>
              <InfoCard icon={Phone} title="Call us">
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="transition-colors hover:text-[#A8862A]">{settings.phone}</a>
              </InfoCard>
              <InfoCard icon={Mail} title="Email">
                <a href={`mailto:${settings.email}`} className="transition-colors hover:text-[#A8862A]">{settings.email}</a>
              </InfoCard>
              <a
                href={waGeneralInquiry(settings)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-[#25D366]/50 bg-[#25D366]/5 text-sm font-medium text-[#128C4B] transition-colors hover:bg-[#25D366]/15"
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp the concierge
              </a>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#D4AF37]/25 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D4AF37]/40 text-[#A8862A]">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h3 className="font-serif text-lg">{title}</h3>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
