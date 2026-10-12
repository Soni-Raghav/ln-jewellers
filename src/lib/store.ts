"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, StoreSettingsDTO, ViewName, ViewParams } from "@/lib/types";

interface AppState {
  // ---- hash-based router (single-page) ----
  view: ViewName;
  params: ViewParams;
  navigate: (view: ViewName, params?: ViewParams) => void;
  syncFromHash: () => void;

  // ---- cart ----
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  clearCart: () => void;
  cartCount: () => number;
  cartSubtotal: () => number;

  // ---- wishlist (product ids) ----
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  inWishlist: (productId: string) => boolean;

  // ---- shop filter state ----
  shopQuery: { q: string; category: string; collection: string; sort: string; maxPrice: number; inStockOnly: boolean };
  setShopQuery: (partial: Partial<AppState["shopQuery"]>) => void;
  resetShopQuery: () => void;

  // ---- session ----
  isAdmin: boolean;
  adminName: string | null;
  setAdmin: (name: string | null) => void;

  // ---- store settings cache ----
  settings: StoreSettingsDTO | null;
  setSettings: (s: StoreSettingsDTO) => void;

  // ---- whatsapp drawer / misc ----
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

const defaultShopQuery = { q: "", category: "", collection: "", sort: "newest", maxPrice: 500000, inStockOnly: false };

function hashFor(view: ViewName, params: ViewParams = {}): string {
  switch (view) {
    case "home":
      return "#/";
    case "shop":
      return "#/shop";
    case "collection":
      return `#/collections/${params.collection ?? ""}`;
    case "product":
      return `#/product/${params.slug ?? ""}`;
    case "policy":
      return `#/policies/${params.policy ?? "shipping"}`;
    default:
      return `#/${view}`;
  }
}

function parseHash(hash: string): { view: ViewName; params: ViewParams } {
  const clean = hash.replace(/^#\/?/, "");
  const [head, tail] = clean.split("/");
  switch (head) {
    case "":
    case undefined:
      return { view: "home", params: {} };
    case "shop":
      return { view: "shop", params: {} };
    case "collections":
      return { view: "collection", params: { collection: decodeURIComponent(tail || "") } };
    case "product":
      return { view: "product", params: { slug: decodeURIComponent(tail || "") } };
    case "policies": {
      const allowed = ["shipping", "returns", "privacy", "terms"];
      const p = allowed.includes(tail) ? (tail as ViewParams["policy"]) : "shipping";
      return { view: "policy", params: { policy: p } };
    }
    case "cart":
      return { view: "cart", params: {} };
    case "checkout":
      return { view: "checkout", params: {} };
    case "wishlist":
      return { view: "wishlist", params: {} };
    case "about":
      return { view: "about", params: {} };
    case "contact":
      return { view: "contact", params: {} };
    case "faq":
      return { view: "faq", params: {} };
    case "track":
      return { view: "track", params: {} };
    case "admin-login":
      return { view: "admin-login", params: {} };
    case "admin":
      return { view: "admin", params: {} };
    default:
      return { view: "404", params: {} };
  }
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: "home",
      params: {},
      navigate: (view, params = {}) => {
        const hash = hashFor(view, params);
        if (typeof window !== "undefined" && window.location.hash !== hash) {
          window.location.hash = hash;
        }
        set({ view, params });
        if (typeof window !== "undefined") {
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
        }
      },
      syncFromHash: () => {
        if (typeof window === "undefined") return;
        const { view, params } = parseHash(window.location.hash);
        set({ view, params });
      },

      cart: [],
      addToCart: (item) => {
        const cart = [...get().cart];
        const idx = cart.findIndex(
          (c) => c.productId === item.productId && (c.variantId ?? null) === (item.variantId ?? null)
        );
        if (idx >= 0) {
          cart[idx] = {
            ...cart[idx],
            quantity: Math.min(cart[idx].quantity + item.quantity, Math.max(item.maxStock, 1)),
          };
        } else {
          cart.push(item);
        }
        set({ cart });
      },
      removeFromCart: (productId, variantId) =>
        set({
          cart: get().cart.filter(
            (c) => !(c.productId === productId && (c.variantId ?? null) === (variantId ?? null))
          ),
        }),
      updateQuantity: (productId, variantId, quantity) => {
        const cart = get()
          .cart.map((c) =>
            c.productId === productId && (c.variantId ?? null) === (variantId ?? null)
              ? { ...c, quantity: Math.max(1, Math.min(quantity, Math.max(c.maxStock, 1))) }
              : c
          )
          .filter((c) => c.quantity > 0);
        set({ cart });
      },
      clearCart: () => set({ cart: [] }),
      cartCount: () => get().cart.reduce((n, i) => n + i.quantity, 0),
      cartSubtotal: () =>
        get().cart.reduce(
          (n, i) => n + Math.round(i.unitPrice * (1 - i.discountPercent / 100)) * i.quantity,
          0
        ),

      wishlist: [],
      toggleWishlist: (productId) => {
        const list = get().wishlist;
        set({
          wishlist: list.includes(productId) ? list.filter((id) => id !== productId) : [...list, productId],
        });
      },
      inWishlist: (productId) => get().wishlist.includes(productId),

      shopQuery: { ...defaultShopQuery },
      setShopQuery: (partial) => set({ shopQuery: { ...get().shopQuery, ...partial } }),
      resetShopQuery: () => set({ shopQuery: { ...defaultShopQuery } }),

      isAdmin: false,
      adminName: null,
      setAdmin: (name) => set({ isAdmin: !!name, adminName: name }),

      settings: null,
      setSettings: (s) => set({ settings: s }),

      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),
    }),
    {
      name: "aurelia-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cart: state.cart,
        wishlist: state.wishlist,
        isAdmin: state.isAdmin,
        adminName: state.adminName,
      }),
    }
  )
);
