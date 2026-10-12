"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Gem } from "lucide-react";

export default function NotFoundView() {
  const navigate = useApp((s) => s.navigate);
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 pt-24 text-center">
      <div>
        <span className="mx-auto mb-6 grid h-20 w-20 rotate-45 place-items-center border border-[#D4AF37]/60">
          <Gem className="h-8 w-8 -rotate-45 text-[#D4AF37]" strokeWidth={1.3} />
        </span>
        <p className="font-serif text-7xl text-gold-gradient">404</p>
        <h1 className="mt-4 font-serif text-3xl">This piece isn&apos;t in our vault</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for has been moved, renamed, or never existed. Let&apos;s get you back to the beautiful things.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("home")} className="bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">Back to home</Button>
          <Button onClick={() => navigate("shop")} variant="outline" className="border-[#D4AF37]/50 text-[#A8862A] hover:bg-[#D4AF37] hover:text-black">
            Browse jewelry
          </Button>
        </div>
      </div>
    </div>
  );
}
