"use client";

/**
 * SettingsAnnouncementBar — the store-owner's custom announcement (Admin →
 * Store Settings → Homepage). Rendered above the navbar inside the fixed
 * header, so it never disturbs the sticky layout.
 *
 * - Shows only when settings.announcementEnabled && announcementText is set.
 * - Full-width gold (#D4AF37) strip, black uppercase text, ~36px tall.
 * - Dismissal (X) persists in localStorage under "ln_announcement_dismissed" —
 *   keyed to the announcement TEXT so a fresh message is always shown.
 * - Mobile-safe: single line, truncates, live-updates from the settings store.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";

const DISMISS_KEY = "ln_announcement_dismissed";

export default function SettingsAnnouncementBar() {
  const settings = useApp((s) => s.settings);
  const text = settings?.announcementEnabled ? (settings.announcementText ?? "").trim() : "";

  // Lazily read the stored dismissal so first paint already respects it
  // (guard for SSR — this component only mounts client-side).
  const [dismissedText, setDismissedText] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  // A new announcement (different text) should always be shown again.
  useEffect(() => {
    if (!text && dismissedText) {
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* private mode — ignore */
      }
      setDismissedText(null);
    }
  }, [text, dismissedText]);

  const dismiss = () => {
    setDismissedText(text);
    try {
      window.localStorage.setItem(DISMISS_KEY, text);
    } catch {
      /* private mode — ignore */
    }
  };

  if (!text || dismissedText === text) return null;

  return (
    <div
      role="region"
      aria-label="Store announcement"
      className="relative flex min-h-9 w-full items-center justify-center bg-[#D4AF37] px-10 py-1.5 text-black"
    >
      <p className="line-clamp-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] sm:text-xs">
        {text}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-1.5 grid size-9 place-items-center rounded-full text-black/70 transition-colors hover:bg-black/10 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 after:absolute after:-inset-1.5 after:content-['']"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
