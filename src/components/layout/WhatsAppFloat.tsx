"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { waGeneralInquiry } from "@/lib/format";
import { MessageCircle } from "lucide-react";

/** Floating WhatsApp concierge button with attention pulse. Hidden on admin views. */
export default function WhatsAppFloat() {
  const view = useApp((s) => s.view);
  const settings = useApp((s) => s.settings);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (view === "admin" || view === "admin-login") return null;
  if (!settings) return null;

  return (
    <a
      href={waGeneralInquiry(settings)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`fixed bottom-5 right-5 z-40 flex items-center gap-0 overflow-hidden rounded-full bg-[#25D366] p-4 text-white shadow-[0_8px_30px_rgba(37,211,102,0.35)] transition-all duration-500 hover:shadow-[0_10px_36px_rgba(37,211,102,0.5)] sm:bottom-6 sm:right-6 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
      }`}
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366]/40 [animation-duration:2.5s]" aria-hidden />
      <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 hover:ml-2.5 hover:max-w-[140px]">
        Chat with us
      </span>
    </a>
  );
}
