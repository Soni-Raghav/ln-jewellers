"use client";

/**
 * Reveal — reusable scroll-reveal wrapper.
 * Fades/slides children into view the first time they enter the viewport.
 * Purely presentational; respects `once` so content never flickers on scroll-back.
 */

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

export interface RevealProps {
  children: ReactNode;
  /** Extra transition delay in seconds (for gentle staggers). */
  delay?: number;
  /** Vertical offset in px the content starts from. */
  y?: number;
  /** Animate only the first time the element comes into view. */
  once?: boolean;
  className?: string;
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
