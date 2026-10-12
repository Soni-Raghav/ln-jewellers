"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gem, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginView() {
  const navigate = useApp((s) => s.navigate);
  const setAdmin = useApp((s) => s.setAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      setAdmin(data.user?.name ?? "Admin");
      toast.success(`Welcome back, ${data.user?.name ?? "Admin"}`);
      navigate("admin");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0A0A0A] px-4">
      <div className="w-full max-w-md">
        <button onClick={() => navigate("home")} className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#E6C87A]/70 transition-colors hover:text-[#D4AF37]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to storefront
        </button>
        <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#111111] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 rotate-45 place-items-center border border-[#D4AF37]/60">
              <Gem className="h-6 w-6 -rotate-45 text-[#D4AF37]" strokeWidth={1.4} />
            </span>
            <h1 className="font-serif text-2xl text-[#FAF7F0]">Aurelia Atelier</h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]/70">Admin access</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-widest text-[#FAF7F0]/50">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-[#D4AF37]/30 bg-[#0A0A0A] text-[#FAF7F0] placeholder:text-[#FAF7F0]/25"
                placeholder="admin@aureliajewels.com"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-widest text-[#FAF7F0]/50">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-[#D4AF37]/30 bg-[#0A0A0A] text-[#FAF7F0] placeholder:text-[#FAF7F0]/25"
                placeholder="••••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={loading} className="h-12 w-full bg-[#D4AF37] text-base font-medium text-black hover:bg-[#E6C87A]">
              {loading ? "Verifying…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#FAF7F0]/35">
            <ShieldCheck className="h-3.5 w-3.5" /> Role-based access · Sessions expire in 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
