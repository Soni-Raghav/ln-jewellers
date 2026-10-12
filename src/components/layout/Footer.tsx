"use client";

import { useApp } from "@/lib/store";
import { Instagram, Facebook, Gem, Mail, Phone, MapPin, Clock } from "lucide-react";

export default function Footer() {
  const view = useApp((s) => s.view);
  const navigate = useApp((s) => s.navigate);
  const settings = useApp((s) => s.settings);
  const isAdminArea = view === "admin" || view === "admin-login";

  if (isAdminArea) return null;

  const year = new Date().getFullYear();
  const brand = settings?.brandName || "Aurelia Jewels";

  const shopLinks = [
    { label: "All Jewelry", action: () => navigate("shop") },
    { label: "Rings", action: () => { useApp.getState().setShopQuery({ category: "rings" }); navigate("shop"); } },
    { label: "Necklaces", action: () => { useApp.getState().setShopQuery({ category: "necklaces" }); navigate("shop"); } },
    { label: "Earrings", action: () => { useApp.getState().setShopQuery({ category: "earrings" }); navigate("shop"); } },
    { label: "Bracelets & Bangles", action: () => { useApp.getState().setShopQuery({ category: "bracelets-bangles" }); navigate("shop"); } },
    { label: "Artisan Soul Collection", action: () => navigate("collection", { collection: "artisan-soul" }) },
  ];

  const companyLinks = [
    { label: "Our Story", action: () => navigate("about") },
    { label: "Book an Appointment", action: () => navigate("contact") },
    { label: "Contact", action: () => navigate("contact") },
    { label: "FAQ", action: () => navigate("faq") },
    { label: "Track Order", action: () => navigate("track") },
    { label: "Admin Atelier", action: () => navigate("admin") },
  ];

  const policyLinks = [
    { label: "Shipping Policy", action: () => navigate("policy", { policy: "shipping" }) },
    { label: "Returns & Refunds", action: () => navigate("policy", { policy: "returns" }) },
    { label: "Privacy Policy", action: () => navigate("policy", { policy: "privacy" }) },
    { label: "Terms & Conditions", action: () => navigate("policy", { policy: "terms" }) },
  ];

  return (
    <footer className="mt-auto bg-[#0A0A0A] text-[#FAF7F0]">
      {/* gold keyline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* brand */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center border border-[#D4AF37]/60 rotate-45">
              <Gem className="h-4 w-4 -rotate-45 text-[#D4AF37]" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-serif text-xl">{brand}</span>
              <span className="text-[9px] uppercase tracking-[0.4em] text-[#D4AF37]/80">Jewels</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#FAF7F0]/60">
            {settings?.tagline || "Handcrafted Luxury Jewelry"} — heirloom-quality gold, made slowly by master karigars in Jaipur.
          </p>
          <div className="mt-5 flex gap-3">
            {[
              { href: settings?.instagramUrl, icon: Instagram, label: "Instagram" },
              { href: settings?.facebookUrl, icon: Facebook, label: "Facebook" },
              { href: settings?.pinterestUrl, icon: Gem, label: "Pinterest" },
            ]
              .filter((s) => s.href)
              .map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${brand} on ${s.label}`}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#D4AF37]/30 text-[#E6C87A] transition-all hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
                >
                  <s.icon className="h-4 w-4" strokeWidth={1.5} />
                </a>
              ))}
          </div>
        </div>

        {/* shop */}
        <nav aria-label="Shop">
          <h3 className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Shop</h3>
          <ul className="mt-5 space-y-3">
            {shopLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.action} className="text-sm text-[#FAF7F0]/65 transition-colors hover:text-[#E6C87A]">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* company */}
        <nav aria-label="Company">
          <h3 className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Atelier</h3>
          <ul className="mt-5 space-y-3">
            {companyLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.action} className="text-sm text-[#FAF7F0]/65 transition-colors hover:text-[#E6C87A]">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* contact + policies */}
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.35em] text-[#D4AF37]">Visit & Policies</h3>
          <ul className="mt-5 space-y-3 text-sm text-[#FAF7F0]/65">
            <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/70" /><span>{settings?.address || "Johari Bazaar, Jaipur"}</span></li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/70" />
              <a href={`tel:${(settings?.phone || "").replace(/\s/g, "")}`} className="transition-colors hover:text-[#E6C87A]">{settings?.phone || "+91 98765 43210"}</a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/70" />
              <a href={`mailto:${settings?.email || "hello@aureliajewels.com"}`} className="transition-colors hover:text-[#E6C87A]">{settings?.email || "hello@aureliajewels.com"}</a>
            </li>
            <li className="flex gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/70" /><span>{settings?.businessHours || "Mon – Sat · 10 AM – 7:30 PM"}</span></li>
          </ul>
          <ul className="mt-5 space-y-2 border-t border-[#D4AF37]/10 pt-4">
            {policyLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.action} className="text-xs text-[#FAF7F0]/50 transition-colors hover:text-[#E6C87A]">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#D4AF37]/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[11px] tracking-wide text-[#FAF7F0]/40 sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} {brand}. All designs are the intellectual property of {brand}.</p>
          <p className="uppercase tracking-[0.25em]">Crafted with devotion in Jaipur ◆ BIS Hallmarked</p>
        </div>
      </div>
    </footer>
  );
}
