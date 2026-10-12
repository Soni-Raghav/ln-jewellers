"use client";

/**
 * AppointmentBooking — "Book a private appointment" for the Contact page.
 * Guests choose an atelier visit or a video consultation, pick a date and
 * a slot from the atelier's book, and the concierge confirms personally.
 * Server-side validation/rate-limiting live in POST /api/appointments.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, Loader2, MapPin, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/lib/format";
import { TIME_SLOTS, istToday } from "@/lib/appointments";

type SlotTypeInfo = { remaining: number; full: boolean };
type SlotInfo = { slot: string; types: { STORE_VISIT: SlotTypeInfo; VIDEO_CALL: SlotTypeInfo } };

type Confirmed = { date: string; timeSlot: string; typeLabel: string };

export default function AppointmentBooking() {
  const [type, setType] = useState<"STORE_VISIT" | "VIDEO_CALL">("STORE_VISIT");
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", timeSlot: "", notes: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [capacities, setCapacities] = useState<{ STORE_VISIT: number; VIDEO_CALL: number } | null>(null);

  const minDate = useMemo(() => istToday(), []);
  const today = minDate;

  // Live per-slot availability from the atelier's book — full slots can't be picked.
  useEffect(() => {
    if (!form.date || !/\d{4}-\d{2}-\d{2}/.test(form.date)) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    fetch(`/api/appointments/availability?date=${form.date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.slots) {
          setSlots(d.slots);
          setCapacities(d.capacities ?? null);
        } else {
          setSlots(null); // fall back to the static slot list on failure
        }
      })
      .catch(() => {
        if (!cancelled) setSlots(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.date]);

  // Availability is per meeting type — the video book and the atelier book fill independently.
  const slotState = useCallback(
    (s: string): SlotInfo => {
      const empty: SlotTypeInfo = { remaining: 1, full: false };
      const found = slots?.find((x) => x.slot === s);
      return found ?? { slot: s, types: { STORE_VISIT: empty, VIDEO_CALL: empty } };
    },
    [slots]
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setFields({});
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          toast.error(data?.error ?? "Too many requests — please try again shortly.");
          return;
        }
        setFields(data.fields ?? { notes: data.error ?? "Something went wrong — please try again." });
        return;
      }
      setConfirmed({
        date: data.appointment.date,
        timeSlot: data.appointment.timeSlot,
        typeLabel: data.appointment.typeLabel,
      });
      toast.success("Appointment requested — the concierge will confirm shortly.");
    } catch {
      toast.error("Network error — please try again or reach us on WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Book a private appointment"
      className="relative mt-14 overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-white shadow-[0_24px_70px_-40px_rgba(212,175,55,0.45)]"
    >
      {/* champagne header band */}
      <div className="relative border-b border-[#D4AF37]/25 bg-gradient-to-r from-[#0A0A0A] via-[#17130A] to-[#0A0A0A] px-6 py-7 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(212,175,55,0.22), transparent 55%)" }}
        />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#E6C87A]">
              <CalendarCheck2 className="h-4 w-4" aria-hidden /> By appointment
            </p>
            <h2 className="mt-2 font-serif text-2xl text-[#FAF7F0] sm:text-3xl">
              Book a private appointment
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[#B7B0A0]">
            Undisturbed time with our pieces — in the Jaipur atelier or over a video call, wherever you are.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        {confirmed ? (
          <div className="grid place-items-center py-10 text-center">
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10">
              <CheckCircle2 className="h-8 w-8 text-[#A8862A]" strokeWidth={1.5} />
            </span>
            <h3 className="font-serif text-2xl">You&apos;re on the book</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              We&apos;ve pencilled in a <strong className="text-foreground">{confirmed.typeLabel}</strong> for{" "}
              <strong className="text-foreground">{formatLongDate(confirmed.date)}</strong> at{" "}
              <strong className="text-foreground">{confirmed.timeSlot} IST</strong>. Our concierge will call or
              email to confirm within one business day.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                className="border-[#D4AF37]/50 hover:bg-[#D4AF37]/10"
                onClick={() => {
                  setConfirmed(null);
                  setForm({ name: "", email: "", phone: "", date: "", timeSlot: "", notes: "" });
                }}
              >
                Book another visit
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-5" noValidate>
            {/* type switch */}
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">How would you like to meet?</Label>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Appointment type">
                <TypeOption
                  selected={type === "STORE_VISIT"}
                  onClick={() => setType("STORE_VISIT")}
                  icon={<MapPin className="h-5 w-5" aria-hidden />}
                  title="At the Jaipur atelier"
                  desc="Walk the vaults, try pieces on, meet the karigars. Johari Bazaar, Jaipur."
                />
                <TypeOption
                  selected={type === "VIDEO_CALL"}
                  onClick={() => setType("VIDEO_CALL")}
                  icon={<Video className="h-5 w-5" aria-hidden />}
                  title="Video consultation"
                  desc="A private walkthrough of any piece, live from the atelier — worldwide."
                />
              </div>
              {fields.type && <p className="mt-1 text-xs text-destructive">{fields.type}</p>}
            </div>

            {/* date + slot */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="appt-date" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Preferred date <span className="text-[#A8862A]">*</span>
                </Label>
                <Input
                  id="appt-date"
                  type="date"
                  min={minDate}
                  value={form.date}
                  onChange={set("date")}
                  className="border-[#D4AF37]/40 bg-[#FAF7F0] [color-scheme:light]"
                  required
                />
                {fields.date && <p className="mt-1 text-xs text-destructive">{fields.date}</p>}
              </div>
              <div>
                <Label htmlFor="appt-slot" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Preferred time <span className="text-[#A8862A]">*</span>
                </Label>
                <select
                  id="appt-slot"
                  value={form.timeSlot}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const info = slots?.find((x) => x.slot === chosen)?.types[type];
                    if (info?.full) {
                      toast.info("That slot is fully booked — please choose another time.");
                      return;
                    }
                    set("timeSlot")(e);
                  }}
                  className="h-10 w-full rounded-md border border-[#D4AF37]/40 bg-[#FAF7F0] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  required
                >
                  <option value="">Select a slot…</option>
                  {TIME_SLOTS.map((s) => {
                    const info = slotState(s).types[type];
                    const suffix = info.full
                      ? " — fully booked"
                      : slots && info.remaining <= 1
                        ? " — 1 seat left"
                        : "";
                    return (
                      <option key={s} value={s} disabled={info.full}>
                        {s} IST{suffix}
                      </option>
                    );
                  })}
                </select>
                {fields.timeSlot && <p className="mt-1 text-xs text-destructive">{fields.timeSlot}</p>}
                {slots && capacities && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3 shrink-0" aria-hidden /> Up to {capacities[type]} {capacities[type] === 1 ? "guest" : "guests"} per private slot — live availability from the atelier&apos;s book, kept separately for visits and video calls.
                  </p>
                )}
              </div>
            </div>

            {/* contact fields */}
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="appt-name" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Name <span className="text-[#A8862A]">*</span>
                </Label>
                <Input id="appt-name" value={form.name} onChange={set("name")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="Your name" required />
                {fields.name && <p className="mt-1 text-xs text-destructive">{fields.name}</p>}
              </div>
              <div>
                <Label htmlFor="appt-email" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Email <span className="text-[#A8862A]">*</span>
                </Label>
                <Input id="appt-email" type="email" value={form.email} onChange={set("email")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="you@example.com" required />
                {fields.email && <p className="mt-1 text-xs text-destructive">{fields.email}</p>}
              </div>
              <div>
                <Label htmlFor="appt-phone" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Phone / WhatsApp <span className="text-[#A8862A]">*</span>
                </Label>
                <Input id="appt-phone" value={form.phone} onChange={set("phone")} className="border-[#D4AF37]/40 bg-[#FAF7F0]" placeholder="+91 98XXX XXXXX" required />
                {fields.phone && <p className="mt-1 text-xs text-destructive">{fields.phone}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="appt-notes" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                What brings you in? <span className="text-[#B0A88F]">(optional)</span>
              </Label>
              <Textarea
                id="appt-notes"
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                className="border-[#D4AF37]/40 bg-[#FAF7F0]"
                placeholder="A bridal trousseau, an engagement ring, a bespoke redesign of an heirloom…"
              />
              {fields.notes && <p className="mt-1 text-xs text-destructive">{fields.notes}</p>}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#D4AF37]/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Requests are confirmed personally within one business day.
                <br className="hidden sm:block" /> {today === form.date ? "Same-day visits depend on the atelier's book — we'll call you." : "Complimentary refreshments, naturally."}
              </p>
              <Button
                type="submit"
                disabled={sending}
                className="h-12 shrink-0 bg-[#0A0A0A] px-8 text-[#FAF7F0] hover:bg-[#171717]"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck2 className="mr-2 h-4 w-4" aria-hidden />}
                {sending ? "Requesting…" : "Request appointment"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function TypeOption({
  selected,
  onClick,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/12 to-[#FAF7F0] shadow-[0_10px_30px_-18px_rgba(212,175,55,0.7)]"
          : "border-[#EAE2D3] bg-[#FAF7F0]/60 hover:border-[#D4AF37]/50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? "border-[#D4AF37]/60 bg-[#D4AF37]/15 text-[#A8862A]" : "border-[#EAE2D3] bg-white text-[#8A8375]"
        )}
      >
        {icon}
      </span>
      <span>
        <span className={cn("block font-serif text-base", selected ? "text-[#1C1A16]" : "text-[#1C1A16]/80")}>{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "ml-auto mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all",
          selected ? "border-[#D4AF37] bg-[#D4AF37]" : "border-[#D8D2C4] bg-white"
        )}
      >
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />}
      </span>
    </button>
  );
}
