"use client";

/**
 * NotifyMeDialog — shared back-in-stock request dialog.
 * Used by ProductView (main buy box + sticky bar) and ProductCard
 * (quick "Notify me" chip on out-of-stock cards in the shop grid).
 */
import { useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function NotifyMeDialog({
  open,
  onOpenChange,
  slug,
  productName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
  productName: string;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setFields({});
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/stock-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFields(data.fields ?? {});
        toast.error(data.error ?? "Could not save your request");
        return;
      }
      toast.success(data.message ?? "You're on the list.");
      onOpenChange(false);
      setEmail("");
      setPhone("");
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#D4AF37]/30 bg-[#FAF7F0] sm:max-w-md">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">Back in stock</p>
          <DialogTitle className="font-serif">Tell me when “{productName}” returns</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="stock-alert-email" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Email *</label>
            <Input
              id="stock-alert-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-[#D4AF37]/40 bg-white"
              autoComplete="email"
            />
            {fields.email && <p className="mt-1 text-xs text-destructive">{fields.email}</p>}
          </div>
          <div>
            <label htmlFor="stock-alert-phone" className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">WhatsApp (optional)</label>
            <Input
              id="stock-alert-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="border-[#D4AF37]/40 bg-white"
              autoComplete="tel"
            />
            {fields.phone && <p className="mt-1 text-xs text-destructive">{fields.phone}</p>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            One thoughtful note when the piece is ready — no marketing, no sharing. Our concierge can also source
            similar pieces on request.
          </p>
          <Button
            onClick={() => void submit()}
            disabled={sending}
            className="h-11 w-full bg-[#0A0A0A] text-[#E6C87A] hover:bg-[#171717]"
          >
            <BellRing className="mr-2 h-4 w-4" /> {sending ? "Saving…" : "Notify me"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
