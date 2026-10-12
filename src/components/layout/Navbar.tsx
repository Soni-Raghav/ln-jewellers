"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Menu, Search, Heart, ShoppingBag, X, Gem, UserRound, LogOut, Package, Sparkles } from "lucide-react";
import { formatINR, netPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { toast } from "sonner";
import AnnouncementBar from "./AnnouncementBar";
import AuthDialog from "./AuthDialog";

const NAV_LINKS = [
  { label: "Home", view: "home" as const },
  { label: "Shop", view: "shop" as const },
  { label: "About", view: "about" as const },
  { label: "Contact", view: "contact" as const },
];

export default function Navbar() {
  const view = useApp((s) => s.view);
  const navigate = useApp((s) => s.navigate);
  const cartCount = useApp((s) => s.cart.reduce((n, i) => n + i.quantity, 0));
  const wishlist = useApp((s) => s.wishlist);
  const searchOpen = useApp((s) => s.searchOpen);
  const setSearchOpen = useApp((s) => s.setSearchOpen);
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const openAuth = useApp((s) => s.openAuth);
  const isAdminArea = view === "admin" || view === "admin-login";

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On the homepage the navbar floats over the dark 3D hero until scrolled
  const overHero = view === "home" && !scrolled;
  const tone = overHero ? "text-[#FAF7F0]" : "text-foreground";
  const bg = overHero
    ? "bg-transparent border-b border-transparent"
    : "bg-background/90 backdrop-blur-md border-b border-border shadow-[0_1px_0_rgba(212,175,55,0.15)]";

  const go = (v: "home" | "shop" | "about" | "contact" | "wishlist" | "cart" | "track" | "account" | "admin") => {
    setMobileOpen(false);
    navigate(v);
  };

  const signOut = () => {
    setMobileOpen(false);
    fetch("/api/auth/logout", { method: "POST" })
      .then(() => {
        setUser(null);
        toast.success("Signed out. Until next time.");
      })
      .catch(() => toast.error("Could not sign out — please try again."));
  };

  const signInFromMenu = () => {
    setMobileOpen(false);
    openAuth("login");
  };

  if (isAdminArea) return null;

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${bg}`}>
        {/* announcement strip — rotating promos + active coupon codes */}
        <AnnouncementBar />
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          {/* brand */}
          <button onClick={() => go("home")} className={`flex items-center gap-2.5 ${tone} group`} aria-label="LN Jewellers home">
            <span className="grid h-9 w-9 place-items-center border border-[#D4AF37]/60 rotate-45 transition-transform group-hover:rotate-[135deg] duration-500">
              <Gem className="h-4 w-4 -rotate-45 text-[#D4AF37]" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="font-serif text-xl tracking-wide">LN</span>
              <span className="text-[9px] uppercase tracking-[0.4em] opacity-70">Jewellers</span>
            </span>
          </button>

          {/* desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.label}
                onClick={() => go(l.view)}
                className={`relative text-[13px] uppercase tracking-[0.2em] ${tone} transition-colors hover:text-[#D4AF37] after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-[#D4AF37] after:transition-all hover:after:w-full ${
                  view === l.view ? "after:w-full text-[#D4AF37]" : ""
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* actions */}
          <div className={`flex items-center gap-1 sm:gap-2 ${tone}`}>
            <button onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]" aria-label="Search jewelry">
              <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
            <button onClick={() => go("wishlist")} className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]" aria-label={`Wishlist, ${wishlist.length} items`}>
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D4AF37] px-1 text-[10px] font-semibold text-black">
                  {wishlist.length}
                </span>
              )}
            </button>
            <button onClick={() => go("cart")} className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]" aria-label={`Shopping bag, ${cartCount} items`}>
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D4AF37] px-1 text-[10px] font-semibold text-black">
                  {cartCount}
                </span>
              )}
            </button>

            {/* account: sign-in prompt or member menu */}
            {!user ? (
              <button
                onClick={() => openAuth("login")}
                className={`hidden h-10 items-center gap-2 rounded-full px-3 text-[11px] uppercase tracking-[0.2em] transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] sm:flex`}
                aria-label="Sign in to your account"
              >
                <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span className="hidden lg:inline">Sign In</span>
              </button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-10 items-center gap-2 rounded-full px-1.5 transition-colors hover:bg-[#D4AF37]/10 sm:px-2"
                    aria-label={`Account menu for ${user.name}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 font-serif text-sm text-[#8A6D1F]">
                      {user.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-24 truncate text-xs tracking-wide lg:inline">{user.name.split(" ")[0]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 border-[#D4AF37]/30 bg-[#FAF7F0]">
                  <DropdownMenuLabel className="font-serif text-[15px] text-foreground">
                    {user.name}
                    <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#D4AF37]/25" />
                  <DropdownMenuItem onClick={() => go("account")} className="gap-2.5 py-2.5 focus:bg-[#D4AF37]/15 focus:text-[#8A6D1F]">
                    <Package className="h-4 w-4" strokeWidth={1.5} /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => go("wishlist")} className="gap-2.5 py-2.5 focus:bg-[#D4AF37]/15 focus:text-[#8A6D1F]">
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} /> Wishlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#D4AF37]/25" />
                  <DropdownMenuItem onClick={signOut} className="gap-2.5 py-2.5 focus:bg-[#D4AF37]/15 focus:text-[#8A6D1F]">
                    <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 border-[#D4AF37]/25 bg-[#0A0A0A] text-[#FAF7F0]">
                <SheetHeader>
                  <SheetTitle className="font-serif text-[#FAF7F0]">LN Jewellers</SheetTitle>
                </SheetHeader>
                <div className="mt-2 flex flex-col gap-1 px-4">
                  {NAV_LINKS.map((l) => (
                    <button key={l.label} onClick={() => go(l.view)} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                      {l.label}
                    </button>
                  ))}
                  <button onClick={() => go("wishlist")} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                    Wishlist ({wishlist.length})
                  </button>
                  <button onClick={() => go("cart")} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                    Shopping Bag ({cartCount})
                  </button>
                  <button onClick={() => go("track")} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                    Track Order
                  </button>
                  {!user ? (
                    <button onClick={signInFromMenu} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                      Sign In / Register
                    </button>
                  ) : (
                    <>
                      <button onClick={() => go("account")} className="border-b border-[#D4AF37]/10 py-3.5 text-left font-serif text-lg transition-colors hover:text-[#D4AF37]">
                        My Orders
                      </button>
                      <button onClick={signOut} className="py-3.5 text-left text-xs uppercase tracking-[0.3em] text-[#D4AF37]/70 transition-colors hover:text-[#D4AF37]">
                        Sign Out ({user.name.split(" ")[0]}) →
                      </button>
                    </>
                  )}
                  <button onClick={() => go("admin")} className="py-3.5 text-left text-xs uppercase tracking-[0.3em] text-[#D4AF37]/70 transition-colors hover:text-[#D4AF37]">
                    Admin Atelier →
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <AuthDialog />
    </>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useApp((s) => s.navigate);
  const setShopQuery = useApp((s) => s.setShopQuery);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(term)}&pageSize=6`);
        const data = await res.json();
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const submit = () => {
    setShopQuery({ q: q.trim() });
    onOpenChange(false);
    navigate("shop");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-xl translate-y-0 border-[#D4AF37]/30 bg-[#FAF7F0] p-0 sm:rounded-xl">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-serif text-lg">Search the Atelier</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Try “solitaire”, “jhumka”, or a SKU like LN-RNG-001…"
              className="h-12 border-[#D4AF37]/40 bg-white pl-10 text-base focus-visible:ring-[#D4AF37]"
              aria-label="Search products"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[46vh] overflow-y-auto px-3 pb-4 scrollbar-elegant">
          {loading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No pieces match “{q}”. Try a different word or SKU.</p>
          )}
          {results.map((p) => {
            const price = netPrice(p.price + (p.variants?.[0]?.priceDelta ?? 0), p.discountPercent);
            return (
              <button
                key={p.id}
                onClick={() => {
                  onOpenChange(false);
                  navigate("product", { slug: p.slug });
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#D4AF37]/10"
              >
                { }
                <img src={p.images?.[0] || "/images/brand/atelier.png"} alt={p.name} className="h-12 w-12 rounded-md border border-border object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[15px]">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.sku} · {p.material}</span>
                </span>
                <span className="font-medium text-[#A8862A]">{formatINR(price)}</span>
              </button>
            );
          })}
          {!loading && q.trim().length < 2 && (
            <div className="px-3 py-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Popular searches</p>
              <div className="flex flex-wrap gap-2">
                {["solitaire", "jhumka", "bridal", "bangles", "emerald", "minimal"].map((t) => (
                  <button key={t} onClick={() => setQ(t)} className="rounded-full border border-[#D4AF37]/40 px-3 py-1 text-xs text-foreground transition-colors hover:bg-[#D4AF37] hover:text-black">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-border px-5 py-3">
          <Button onClick={submit} variant="outline" className="w-full border-[#D4AF37]/50 text-[#A8862A] hover:bg-[#D4AF37] hover:text-black">
            View all results in Shop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
