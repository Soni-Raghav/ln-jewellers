"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Gem,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  ReceiptText,
  ScrollText,
  Settings,
  Star,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, errMsg, setUnauthorizedHandler } from "./api";
import Overview from "./Overview";
import ProductsManager from "./ProductsManager";
import InventoryManager from "./InventoryManager";
import OrdersManager from "./OrdersManager";
import InquiriesManager from "./InquiriesManager";
import SubscribersManager from "./SubscribersManager";
import ReviewsManager from "./ReviewsManager";
import SettingsManager from "./SettingsManager";
import AuditLogs from "./AuditLogs";

type AdminTab =
  | "overview"
  | "products"
  | "inventory"
  | "orders"
  | "inquiries"
  | "subscribers"
  | "reviews"
  | "settings"
  | "audit";

const SECTIONS: { id: AdminTab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Gem },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "orders", label: "Orders", icon: ReceiptText },
  { id: "inquiries", label: "Inquiries", icon: Mail },
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "settings", label: "Store Settings", icon: Settings },
  { id: "audit", label: "Audit Logs", icon: ScrollText },
];

// Custom slim scrollbar for the admin scroll areas
const SCROLLBAR_CSS = `
.admin-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
.admin-scroll::-webkit-scrollbar-track { background: transparent; }
.admin-scroll::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.35); border-radius: 9999px; }
.admin-scroll::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.6); }
`;

export default function AdminView() {
  const navigate = useApp((s) => s.navigate);
  const [phase, setPhase] = useState<"checking" | "login" | "ready">("checking");
  const [adminName, setAdminName] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");

  // Register the global 401 handler: any admin API 401 drops back to the login card
  useEffect(() => {
    setUnauthorizedHandler(() => setPhase("login"));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Verify the session cookie once on mount (promise callbacks keep setState
  // out of the effect's synchronous path, avoiding cascading renders)
  useEffect(() => {
    let active = true;
    api<{ user: { name: string } }>("/api/auth/me")
      .then((data) => {
        if (!active) return;
        setAdminName(data.user.name);
        useApp.getState().setAdmin(data.user.name);
        setPhase("ready");
      })
      .catch(() => {
        if (!active) return;
        useApp.getState().setAdmin(null);
        setAdminName(null);
        setPhase("login");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLoggedIn = useCallback((name: string) => {
    setAdminName(name);
    setPhase("ready");
    setTab("overview");
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api<{ success: boolean }>("/api/auth/logout", { method: "POST" });
    } catch (e) {
      if (!errMsg(e).includes("Authentication")) toast.error(errMsg(e));
    }
    useApp.getState().setAdmin(null);
    setAdminName(null);
    setPhase("login");
    toast.success("Signed out of the atelier console.");
  }, []);

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0A] text-[#FAF7F0]">
        <Gem className="size-8 text-[#D4AF37]" />
        <p className="font-serif text-xl tracking-wide">Aurelia Atelier</p>
        <div className="flex items-center gap-2 text-sm text-[#8A857B]">
          <Loader2 className="size-4 animate-spin text-[#D4AF37]" />
          Preparing your console…
        </div>
      </div>
    );
  }

  if (phase === "login") {
    return <LoginCard onSuccess={handleLoggedIn} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1C1A16]">
      <style dangerouslySetInnerHTML={{ __html: SCROLLBAR_CSS }} />

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/25 bg-[#141311] text-[#FAF7F0] shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Gem className="size-5 shrink-0 text-[#D4AF37]" aria-hidden />
            <div className="min-w-0">
              <p className="truncate font-serif text-base leading-tight sm:text-lg">
                Aurelia Atelier <span className="text-[#D4AF37]">·</span> Admin
              </p>
              <p className="hidden text-[10px] uppercase tracking-[0.25em] text-[#8A857B] sm:block">
                Jewelry management console
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {adminName && (
              <span className="hidden text-sm text-[#C9C2B2] md:inline">
                Signed in as <span className="text-[#E6C87A]">{adminName}</span>
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("home")}
              className="border-[#D4AF37]/40 bg-transparent text-[#E6C87A] hover:bg-[#D4AF37]/10 hover:text-[#E6C87A]"
            >
              <Store className="size-4" aria-hidden />
              <span className="hidden sm:inline">View storefront</span>
              <span className="sr-only sm:hidden">View storefront</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
              className="border-[#3A362F] bg-transparent text-[#C9C2B2] hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Logout</span>
              <span className="sr-only sm:hidden">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile: horizontal scroll tabs */}
        <nav className="admin-scroll flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Admin sections">
          {SECTIONS.map((s) => {
            const active = tab === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#E6C87A]"
                    : "border-[#3A362F] text-[#B7B0A0] hover:border-[#D4AF37]/40 hover:text-white"
                )}
              >
                <s.icon className="size-3.5" aria-hidden />
                {s.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ---------- Body ---------- */}
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar (desktop) */}
        <aside
          className="admin-scroll sticky top-[64px] hidden max-h-[calc(100vh-64px)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#D4AF37]/15 bg-[#141311] px-3 py-5 md:flex"
          aria-label="Admin sections"
        >
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.3em] text-[#6E6A5E]">Atelier</p>
          {SECTIONS.map((s) => {
            const active = tab === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#E6C87A]"
                    : "border-transparent text-[#B7B0A0] hover:bg-white/5 hover:text-white"
                )}
              >
                <s.icon className="size-4 shrink-0" aria-hidden />
                {s.label}
              </button>
            );
          })}
          <Separator className="my-3 bg-[#2A2824]" />
          <p className="px-3 text-[11px] leading-relaxed text-[#6E6A5E]">
            All catalog, order and inventory changes are recorded in the audit log.
          </p>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div key={tab} className="mx-auto w-full max-w-7xl">
            {tab === "overview" && <Overview />}
            {tab === "products" && <ProductsManager />}
            {tab === "inventory" && <InventoryManager />}
            {tab === "orders" && <OrdersManager />}
            {tab === "inquiries" && <InquiriesManager />}
            {tab === "subscribers" && <SubscribersManager />}
            {tab === "reviews" && <ReviewsManager />}
            {tab === "settings" && <SettingsManager />}
            {tab === "audit" && <AuditLogs />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------- Login card ----------
function LoginCard({ onSuccess }: { onSuccess: (name: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; user?: { name: string }; error?: string }
        | null;

      if (res.status === 429) {
        setError(data?.error || "Too many login attempts. Please wait a few minutes and try again.");
        return;
      }
      if (!res.ok || !data?.user) {
        setError(data?.error || "Invalid email or password.");
        return;
      }

      useApp.getState().setAdmin(data.user.name);
      toast.success(`Welcome back, ${data.user.name}.`);
      onSuccess(data.user.name);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_55%)] px-4 py-10 text-[#FAF7F0]">
      <Card className="w-full max-w-md border-[#D4AF37]/25 bg-[#161513] shadow-[0_24px_80px_-24px_rgba(212,175,55,0.25)]">
        <CardHeader className="items-center text-center">
          <Gem className="mb-1 size-8 text-[#D4AF37]" aria-hidden />
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#8A857B]">Aurelia Jewels</p>
          <CardTitle className="font-serif text-2xl text-[#FAF7F0]">
            Atelier <span className="italic text-[#D4AF37]">Console</span>
          </CardTitle>
          <CardDescription className="text-[#8A857B]">
            Sign in to manage products, orders and inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-[#C9C2B2]">
                Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="admin@aureliajewels.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#3A362F] bg-[#0F0E0D] text-[#FAF7F0] placeholder:text-[#5C5749] focus-visible:ring-[#D4AF37]/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-[#C9C2B2]">
                Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#3A362F] bg-[#0F0E0D] text-[#FAF7F0] placeholder:text-[#5C5749] focus-visible:ring-[#D4AF37]/40"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="w-full bg-[#D4AF37] font-medium text-[#171717] hover:bg-[#E6C87A]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="relative my-5">
            <Separator className="bg-[#2A2824]" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#161513] px-3 text-[10px] uppercase tracking-[0.3em] text-[#6E6A5E]">
              Secure area
            </span>
          </div>
          <p className="text-center text-xs leading-relaxed text-[#6E6A5E]">
            Sessions are issued as signed HTTP-only cookies.
            <br />
            Failed attempts are rate-limited and audited.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
