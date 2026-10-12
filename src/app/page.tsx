"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, MotionConfig } from "framer-motion";
import { useApp } from "@/lib/store";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load heavy views (3D, admin, shop) for lean initial bundle
const HomeView = dynamic(() => import("@/components/home/HomeView"), {
  ssr: false,
  loading: () => <ViewSkeleton hero />,
});
const ShopView = dynamic(() => import("@/components/storefront/ShopView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const CollectionView = dynamic(() => import("@/components/storefront/CollectionView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const ProductView = dynamic(() => import("@/components/storefront/ProductView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const CartView = dynamic(() => import("@/components/storefront/CartView"), { ssr: false });
const CheckoutView = dynamic(() => import("@/components/storefront/CheckoutView"), { ssr: false });
const WishlistView = dynamic(() => import("@/components/storefront/WishlistView"), { ssr: false });
const AboutView = dynamic(() => import("@/components/storefront/AboutView"), { ssr: false });
const ContactView = dynamic(() => import("@/components/storefront/ContactView"), { ssr: false });
const FaqView = dynamic(() => import("@/components/storefront/FaqView"), { ssr: false });
const PolicyView = dynamic(() => import("@/components/storefront/PolicyView"), { ssr: false });
const TrackOrderView = dynamic(() => import("@/components/storefront/TrackOrderView"), { ssr: false });
const InvoiceView = dynamic(() => import("@/components/storefront/InvoiceView"), { ssr: false });
const AccountView = dynamic(() => import("@/components/storefront/AccountView"), { ssr: false });
const AdminLoginView = dynamic(() => import("@/components/storefront/AdminLoginView"), { ssr: false });
const AdminView = dynamic(() => import("@/components/admin/AdminView"), {
  ssr: false,
  loading: () => <ViewSkeleton dark />,
});
const NotFoundView = dynamic(() => import("@/components/storefront/NotFoundView"), { ssr: false });

function ViewSkeleton({ hero, dark }: { hero?: boolean; dark?: boolean }) {
  return (
    <div className={`mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 ${dark ? "bg-[#0A0A0A] min-h-screen" : ""}`}>
      {hero && (
        <div className="mb-12 grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40 bg-muted" />
            <Skeleton className="h-16 w-3/4 bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 w-44 bg-muted" />
              <Skeleton className="h-12 w-32 bg-muted" />
            </div>
          </div>
          <Skeleton className="aspect-square w-full rounded-full bg-muted/60" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[4/5] w-full rounded-lg bg-muted" />
            <Skeleton className="mt-3 h-4 w-2/3 bg-muted" />
            <Skeleton className="mt-2 h-4 w-1/4 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LNJewellersApp() {
  const view = useApp((s) => s.view);
  const params = useApp((s) => s.params);
  const syncFromHash = useApp((s) => s.syncFromHash);
  const setSettings = useApp((s) => s.setSettings);
  const settings = useApp((s) => s.settings);
  const setUser = useApp((s) => s.setUser);

  // Restore the customer session from the httpOnly cookie (if any)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user) setUser(d.user);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  // Hash router bootstrap + listener
  useEffect(() => {
    syncFromHash();
    const onHash = () => {
      syncFromHash();
      // Browser back/forward or a manually edited hash lands on a new view —
      // start that view from the top (in-app navigate() already does this).
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncFromHash]);

  // Load store settings once
  useEffect(() => {
    if (settings) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => d.settings && setSettings(d.settings))
      .catch(() => null);
  }, [settings, setSettings]);

  // Dynamic document title per view
  useEffect(() => {
    const brand = "LN Jewellers";
    const titles: Record<string, string> = {
      home: "Handcrafted 22K Gold Jewelry, Made in Jaipur",
      shop: "Shop All Jewelry",
      product: params.slug ? params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Product",
      collection: params.collection ? params.collection.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Collection",
      cart: "Shopping Bag",
      checkout: "Checkout",
      wishlist: "Wishlist",
      about: "Our Story",
      contact: "Contact Us",
      faq: "FAQ",
      policy: params.policy ? `${params.policy.charAt(0).toUpperCase()}${params.policy.slice(1)} Policy` : "Policies",
      track: "Track Order",
      invoice: "Invoice",
      account: "My Account",
      admin: "Admin Atelier",
      "admin-login": "Admin Sign In",
    };
    document.title = view === "home" ? `${brand} — ${titles.home}` : `${titles[view] ?? "Jewelry"} · ${brand}`;
  }, [view, params]);

  const renderView = () => {
    switch (view) {
      case "home":
        return <HomeView />;
      case "shop":
        return <ShopView />;
      case "collection":
        return <CollectionView />;
      case "product":
        return <ProductView />;
      case "cart":
        return <CartView />;
      case "checkout":
        return <CheckoutView />;
      case "wishlist":
        return <WishlistView />;
      case "about":
        return <AboutView />;
      case "contact":
        return <ContactView />;
      case "faq":
        return <FaqView />;
      case "policy":
        return <PolicyView />;
      case "track":
        return <TrackOrderView />;
      case "invoice":
        return <InvoiceView />;
      case "account":
        return <AccountView />;
      case "admin-login":
        return <AdminLoginView />;
      case "admin":
        return <AdminView />;
      default:
        return <NotFoundView />;
    }
  };

  const isAdminArea = view === "admin" || view === "admin-login";

  return (
    <MotionConfig reducedMotion="user">
      <div className={`flex min-h-screen flex-col ${isAdminArea ? "bg-[#0A0A0A]" : "bg-background"}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[#D4AF37] focus:px-4 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <motion.div
          key={`${view}-${params.slug ?? params.collection ?? params.policy ?? ""}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<ViewSkeleton />}>{renderView()}</Suspense>
        </motion.div>
      </main>
      <Footer />
      <WhatsAppFloat />
      </div>
    </MotionConfig>
  );
}
