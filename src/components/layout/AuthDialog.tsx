"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Gem, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import type { AuthUser } from "@/lib/types";

type Mode = "login" | "register";

interface ApiResponse {
  error?: string;
  fields?: Record<string, string>;
  user?: AuthUser;
  [key: string]: unknown;
}

/**
 * Customer sign-in / registration dialog.
 * The admin signs in through the dedicated Admin Atelier instead.
 * The form mounts fresh on every open, so no reset effects are needed.
 */
export default function AuthDialog() {
  const open = useApp((s) => s.authOpen);
  const authMode = useApp((s) => s.authMode);
  const setAuthOpen = useApp((s) => s.setAuthOpen);
  const setUser = useApp((s) => s.setUser);

  return (
    <Dialog open={open} onOpenChange={setAuthOpen}>
      <DialogContent
        className="max-h-[92dvh] max-w-md overflow-y-auto border-[#D4AF37]/30 bg-[#FAF7F0] p-0 sm:rounded-xl"
        aria-describedby="auth-desc"
      >
        {open && <AuthForm key={authMode} initialMode={authMode} onUser={setUser} onClose={() => setAuthOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AuthForm({
  initialMode,
  onUser,
  onClose,
}: {
  initialMode: Mode;
  onUser: (u: AuthUser) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, phone: form.phone, password: form.password, confirmPassword: form.confirmPassword };

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => ({ status: res.status, data: (await res.json().catch(() => ({}))) as ApiResponse }))
      .then(({ status, data }) => {
        if (status >= 400) {
          setError(data.error || "Something went wrong. Please try again.");
          setFields(data.fields || {});
          setBusy(false);
          return;
        }
        if (data.user) {
          onUser(data.user);
          toast.success(
            mode === "login"
              ? `Welcome back, ${data.user.name.split(" ")[0]}.`
              : `Welcome to LN Jewellers, ${data.user.name.split(" ")[0]}.`
          );
        }
        onClose();
      })
      .catch(() => {
        setError("Network error — please check your connection and try again.");
        setBusy(false);
      });
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setFields({});
  };

  return (
    <>
      <div className="rounded-t-xl bg-[#0A0A0A] px-6 pb-6 pt-7 text-center">
        <span className="mx-auto grid h-11 w-11 rotate-45 place-items-center border border-[#D4AF37]/60">
          <Gem className="h-5 w-5 -rotate-45 text-[#D4AF37]" strokeWidth={1.5} />
        </span>
        <div className="mt-4 text-center">
          <DialogTitle className="font-serif text-2xl text-[#FAF7F0]">
            {mode === "login" ? "Welcome back" : "Join the LN circle"}
          </DialogTitle>
          <DialogDescription
            id="auth-desc"
            className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-[#FAF7F0]/60"
          >
            {mode === "login"
              ? "Sign in to follow your orders, inscriptions and heirlooms — all in one place."
              : "Create an account for effortless ordering, order history and concierge care."}
          </DialogDescription>
        </div>
      </div>

      {/* mode switch */}
      <div className="grid grid-cols-2 border-b border-[#D4AF37]/25 bg-white" role="tablist" aria-label="Sign in or create account">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`h-11 text-[11px] font-medium uppercase tracking-[0.25em] transition-colors ${
              mode === m
                ? "border-b-2 border-[#D4AF37] text-[#8A6D1F]"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 px-6 pb-6 pt-5" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {mode === "register" && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Full name
            </Label>
            <Input
              id="auth-name"
              value={form.name}
              onChange={set("name")}
              autoComplete="name"
              placeholder="Ananya Sharma"
              className="h-11 border-[#D4AF37]/40 bg-white focus-visible:ring-[#D4AF37]"
              aria-invalid={!!fields.name}
            />
            {fields.name && <p className="text-xs text-red-600">{fields.name}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="auth-email" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Email
          </Label>
          <Input
            id="auth-email"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 border-[#D4AF37]/40 bg-white focus-visible:ring-[#D4AF37]"
            aria-invalid={!!fields.email}
          />
          {fields.email && <p className="text-xs text-red-600">{fields.email}</p>}
        </div>

        {mode === "register" && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-phone" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Phone <span className="normal-case tracking-normal opacity-70">(optional — WhatsApp concierge)</span>
            </Label>
            <Input
              id="auth-phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              autoComplete="tel"
              placeholder="+91 98XXX XXXXX"
              className="h-11 border-[#D4AF37]/40 bg-white focus-visible:ring-[#D4AF37]"
              aria-invalid={!!fields.phone}
            />
            {fields.phone && <p className="text-xs text-red-600">{fields.phone}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="auth-password" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? "At least 8 characters, one number" : "Your password"}
              className="h-11 border-[#D4AF37]/40 bg-white pr-11 focus-visible:ring-[#D4AF37]"
              aria-invalid={!!fields.password}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fields.password && <p className="text-xs text-red-600">{fields.password}</p>}
        </div>

        {mode === "register" && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-confirm" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Confirm password
            </Label>
            <Input
              id="auth-confirm"
              type={showPw ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              autoComplete="new-password"
              className="h-11 border-[#D4AF37]/40 bg-white focus-visible:ring-[#D4AF37]"
              aria-invalid={!!fields.confirmPassword}
            />
            {fields.confirmPassword && <p className="text-xs text-red-600">{fields.confirmPassword}</p>}
          </div>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="btn-shimmer h-12 w-full bg-[#D4AF37] text-[13px] font-semibold uppercase tracking-[0.2em] text-black transition-transform hover:bg-[#E6C87A] disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === "login" ? "Signing in…" : "Creating…"}
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Create My Account"
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {mode === "login" ? (
            <>
              New to LN Jewellers?{" "}
              <button type="button" onClick={() => switchMode("register")} className="font-medium text-[#8A6D1F] underline-offset-2 hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("login")} className="font-medium text-[#8A6D1F] underline-offset-2 hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </>
  );
}
