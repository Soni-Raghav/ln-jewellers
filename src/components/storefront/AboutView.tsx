"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeading } from "@/components/home/SectionHeading";
import { Gem, Hammer, HeartHandshake, Leaf, ShieldCheck, ArrowRight } from "lucide-react";

export default function AboutView() {
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);

  useEffect(() => {
    // ensure settings loaded for content
    if (!useApp.getState().settings) {
      fetch("/api/settings").then((r) => r.json()).then((d) => d.settings && useApp.getState().setSettings(d.settings)).catch(() => null);
    }
  }, []);

  const story = settings?.aboutStory ||
    "LN Jewellers began in 2016 at a two-bench workshop in Johari Bazaar, Jaipur — with one master karigar, a sheet of 22K gold and a stubborn belief that real luxury is made slowly.";

  const mission = settings?.missionVision ||
    "Mission: To make heirloom-quality handcrafted gold jewellery accessible with radical transparency.\n\nVision: A world where every woman owns at least one piece of jewellery that tells her story.";

  const paragraphs = story.split("\n").filter(Boolean);
  const mvParagraphs = mission.split("\n").filter(Boolean);

  return (
    <div className="pb-24">
      {/* hero */}
      <section className="relative flex min-h-[46vh] items-center justify-center overflow-hidden bg-[#0A0A0A] pt-24">
        { }
        <img src="/images/brand/atelier.png" alt="The LN Jewellers atelier" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/70 via-transparent to-[#0A0A0A]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.4em] text-[#D4AF37]">Since 2016 · Johari Bazaar, Jaipur</p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-[#FAF7F0] md:text-6xl">
              Gold is our medium.<br /><em className="text-gold-gradient not-italic">Patience</em> is our craft.
            </h1>
          </Reveal>
        </div>
      </section>

      {/* story */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <SectionHeading eyebrow="Our story" title="Born at two benches in the world's oldest jewelry market" />
        <div className="mt-10 space-y-5 leading-relaxed text-muted-foreground">
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <p className={i === 0 ? "font-serif text-xl text-foreground" : ""}>{p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* mission & vision */}
      <section className="bg-[#171717] py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Mission</p>
              <p className="mt-4 font-serif text-xl leading-relaxed text-[#FAF7F0]/90">{mvParagraphs[0]?.replace(/^Mission:\s*/i, "")}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Vision</p>
              <p className="mt-4 font-serif text-xl leading-relaxed text-[#FAF7F0]/90">{mvParagraphs[1]?.replace(/^Vision:\s*/i, "") ?? mvParagraphs[mvParagraphs.length - 1]}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* craft values */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Design philosophy" title="What we refuse to compromise" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Hammer, title: "Hand before machine", text: "Every piece is filed, set and polished by hand. Machines assist; they never author." },
            { icon: ShieldCheck, title: "Purity you can verify", text: "BIS hallmarked gold, RJC-certified refiners, and hallmark numbers shared before dispatch." },
            { icon: HeartHandshake, title: "Fair karigar wages", text: "Our artisans are salaried masters, not piece-rate labour. Their names go on the craft cards." },
            { icon: Leaf, title: "Slow, honest pricing", text: "Transparent making charges. No festival gimmicks, no inflated discounts, ever." },
          ].map((v, i) => (
            <Reveal key={v.title} delay={i * 0.07}>
              <div className="group h-full rounded-xl border border-[#D4AF37]/25 bg-white p-7 transition-shadow hover:shadow-[0_12px_40px_rgba(212,175,55,0.12)]">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/40 text-[#A8862A] transition-colors group-hover:bg-[#D4AF37] group-hover:text-black">
                  <v.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 font-serif text-lg">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* artisan split */}
      <section className="bg-[#FAF7F0]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div className="relative">
              <div className="absolute -left-3 -top-3 h-full w-full rounded-xl border border-[#D4AF37]/50" aria-hidden />
              { }
              <img src="/images/brand/artisan.png" alt="LN Jewellers master karigar at the bench" className="relative aspect-[4/3] w-full rounded-xl object-cover" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#A8862A]">The hands behind the gold</p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">Master karigars, four decades deep</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Ustad Ramesh-ji has set stones for 42 years. Suresh-ji can draw a filigree pattern finer than a laser. Every LN Jewellers apprentice trains three years under a master before touching a client&apos;s piece — a chain of knowledge older than the shop itself.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                When you order, you can ask who made your piece. We&apos;ll tell you. That accountability is our quiet luxury.
              </p>
              <Button onClick={() => navigate("collection", { collection: "artisan-soul" })} className="mt-7 bg-[#D4AF37] text-black hover:bg-[#E6C87A]">
                Explore Artisan Soul <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* quality process */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Quality standards" title="From sketch to keepsake — five honest steps" />
        <ol className="mt-12 grid gap-6 md:grid-cols-5">
          {[
            { n: "01", t: "Sketch", d: "Designs are drawn by hand and argued over for weeks." },
            { n: "02", t: "Cast & forge", d: "Certified gold cast in-house; weight verified at every step." },
            { n: "03", t: "Set & engrave", d: "Stones set under 10x loupe; engraving cut by hand." },
            { n: "04", t: "Hallmark", d: "Government ASSAY hallmarked; number recorded to your order." },
            { n: "05", t: "Bless & box", d: "Final loupe check, craft card signed, lined box, insured dispatch." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <li className="relative h-full rounded-xl border border-[#D4AF37]/25 bg-white p-6">
                <span className="font-serif text-3xl text-[#E6C87A]">{s.n}</span>
                <h3 className="mt-3 font-serif text-lg">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-4 text-center sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#0A0A0A] px-6 py-14">
            <Gem className="mx-auto h-7 w-7 text-[#D4AF37]" strokeWidth={1.4} />
            <h2 className="mt-4 font-serif text-3xl text-[#FAF7F0]">Begin your own heirloom</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[#FAF7F0]/60">
              Browse the collections, or message our concierge to commission something that doesn&apos;t exist yet.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate("shop")} className="bg-[#D4AF37] text-black hover:bg-[#E6C87A]">Shop the collection</Button>
              <Button onClick={() => navigate("contact")} variant="outline" className="border-[#D4AF37]/50 text-[#E6C87A] hover:bg-[#D4AF37] hover:text-black">
                Commission a piece
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
