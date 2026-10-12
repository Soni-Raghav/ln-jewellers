"use client";

/**
 * SectionHeading — luxury editorial section header.
 * Uppercase gold eyebrow, serif title, optional italic subtitle, and a thin
 * gold divider ornament (1px rules flanking a small rotated-45° diamond).
 * Centered by default; pass `align="left"` for editorial splits. Use `dark`
 * on charcoal sections to keep the title ivory.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  /** Set when the heading sits on a dark/charcoal background. */
  dark?: boolean;
  className?: string;
}

function GoldOrnament() {
  return (
    <span aria-hidden className="flex items-center gap-3">
      <span className="h-px w-10 bg-[#D4AF37]/60" />
      <span className="block size-1.5 rotate-45 bg-[#D4AF37]" />
      <span className="h-px w-10 bg-[#D4AF37]/60" />
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  dark = false,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        centered ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow ? (
        <span className="text-xs uppercase tracking-[0.3em] text-[#D4AF37]">
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          "font-serif text-3xl leading-tight md:text-5xl",
          dark ? "text-[#FAF7F0]" : "text-foreground"
        )}
      >
        {title}
      </h2>
      <GoldOrnament />
      {subtitle ? (
        <p
          className={cn(
            "max-w-2xl text-sm leading-relaxed md:text-base",
            dark ? "text-white/60" : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}

export default SectionHeading;
