# Aurelia Jewels — Project Worklog

Shared handover document. Every agent MUST read this before working and append a section after finishing.

---

## Project Brief (read me first)

Premium 3D jewelry e-commerce website "Aurelia Jewels" — luxurious golden theme (#D4AF37 gold, #E6C87A champagne, #0A0A0A black, #171717 charcoal, #FAF7F0 ivory), Three.js 3D hero, full shop/catalog/cart/checkout, secure admin dashboard with inventory management, WhatsApp integration, all database-backed.

**Stack (sandbox-adapted, do not fight it):**
- Next.js 16 App Router + TypeScript (single visible route `/` — all views are client-side via hash router in `src/lib/store.ts`)
- Tailwind CSS 4 + shadcn/ui (New York) — components in `src/components/ui` (do NOT rebuild them)
- Prisma + SQLite (`db/custom.db`), schema in `prisma/schema.prisma`, seeded via `scripts/seed.ts` (14 products, categories, collections, orders, reviews, settings)
- API routes under `src/app/api/**` (public: products, categories, collections, settings, orders, contact, newsletter, reviews, auth, payments; admin: dashboard, products, inventory, orders, inquiries, subscribers, reviews, settings, audit-logs — all guarded by `requireAdmin()`)
- Auth: JWT (HMAC) in httpOnly cookie `aurelia_session`. Admin: `admin@aureliajewels.com` / `Aurelia@Admin1`
- framer-motion, lucide-react, sonner (toast), zustand (state), three/@react-three/fiber/@react-three/drei installed

**Key contracts (ALREADY EXIST — import, never modify):**
- `@/lib/types` — Product, CartItem, StoreSettingsDTO, Paginated<T>, ViewName, ViewParams...
- `@/lib/store` — `useApp`: `view`, `params`, `navigate(view, params)`, cart ops (`cart`, `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`), `wishlist`/`toggleWishlist`, `shopQuery`/`setShopQuery`/`resetShopQuery`, `isAdmin`, `setAdmin(name)`, `settings`/`setSettings`
- `@/lib/format` — `formatINR`, `netPrice(price, discountPercent)`, `waLink`, `waProductInquiry(settings, product, opts)`, `waGeneralInquiry(settings)`, `waCartInquiry(settings, items, totals)`, `waOrderMessage(...)`, `stockLabel(stock, track, threshold)`, `parseJsonArray`
- `@/lib/db` — prisma client (server only). `@/lib/auth` — requireAdmin, getSession, hashPassword, logAudit (server only)

**Design language:**
- Serif display font var: `--font-serif` (Playfair Display), sans body: `--font-sans` (Jost) — set in layout.tsx. Use `font-serif` / `font-sans` utilities.
- Gold accent classes: use arbitrary values like `text-[#D4AF37]`, `bg-[#D4AF37]`, `border-[#D4AF37]/30`, champagne `#E6C87A`, ivory `#FAF7F0`, charcoal `#171717`, deep black `#0A0A0A`.
- Aesthetic: luxury editorial, generous whitespace, thin gold rules, uppercase tracking-widest eyebrows, serif italic accents. NO blue/indigo. NO generic e-commerce template look.
- Rules: `'use client'` on every view component; images from `/images/products/*.png`, `/images/brand/*.png`; sticky footer handled by root shell (main agent); long lists `max-h-96 overflow-y-auto`; loading skeletons; toast via `import { toast } from "sonner"`.

**Out of scope for subagents (main agent owns):** page.tsx, layout.tsx, globals.css, Navbar/Footer/WhatsAppFloat, ShopView/ProductView/CartView/CheckoutView/WishlistView/AboutView/ContactView/FaqView/PolicyView/TrackOrderView/CollectionView/404, worklog coordination.

---

---

Task ID: 2-a
Agent: 3d-hero-homepage

Task description: Build the immersive 3D hero (procedural gold ring, React Three Fiber, no external assets/env presets, full resilience: WebGL fallback, reduced-motion, lazy-mount, error boundary) and the complete homepage (`HomeView`) with sections a–m, plus shared `Reveal`, `SectionHeading`, and `ProductCard` components.

Work Log:
- Read worklog.md + verified contracts in `src/lib/types.ts`, `store.ts`, `format.ts`, `api-utils.ts`, `serialize.ts` and API routes (products/categories/collections/settings/newsletter) before writing any code. Did NOT touch page.tsx, layout.tsx, globals.css, src/lib/**, or ui components.
- `src/components/three/JewelHero.tsx`:
  - Procedural gold ring: torus band (metalness 1, roughness 0.18, #D4AF37) + faceted octahedron gem (#F3E5D8, metalness 0.6, roughness 0.05, emissive sparkle pulse) + bezel cylinder + 4 prong spheres; tilted three-quarter view.
  - Plain warm lights only (ambient + spot + 3 points), drei `<ContactShadows>` + gold `<Sparkles>`; drei `<Float>` gentle float; slow auto-rotation; lerped mouse parallax rig (CameraRig, factor 0.045 lerp).
  - `dpr={[1,1.75]}`, `gl={{ antialias:true, alpha:true }}`, transparent background, camera [0,0.55,6.2] fov 38.
  - Resilience: WebGL probe → `HeroFallback` (pure-CSS ivory/gold gradient + serif monogram "A" + radial glow); `prefers-reduced-motion` → static scene with `frameloop="demand"` + ContactShadows frames=1 + no Float/Sparkles/parallax; IntersectionObserver lazy-mount (rootMargin 250px); inline `HeroErrorBoundary` class → fallback.
  - Exports named `JewelHero` + `HeroFallback` (+ default JewelHero). Fills parent (h-full w-full); parent positions it.
- `src/components/home/Reveal.tsx`: framer-motion `useInView` + `motion.div`, props children/delay/y(24)/once(true)/className, subtle 0.7s ease-out. Named + default export.
- `src/components/home/SectionHeading.tsx`: gold uppercase eyebrow (tracking-[0.3em]), serif title (text-3xl md:text-5xl), optional subtitle, gold ornament (two 1px rules + rotated-45° diamond), `align` center/left + `dark` variant for charcoal sections. Named + default export.
- `src/components/home/ProductCard.tsx`: named + default export; uses `useApp` navigate/toggleWishlist/inWishlist/addToCart (subscribes wishlist array for reactivity); aspect-[4/5] hover scale-105; -X% gold badge; "Out of stock" overlay (trackInventory && maxStock<=0); "One of one" handmade tag; hover quick-add (first available variant, `unitPrice = netPrice(price + priceDelta, discountPercent)`, toast.success, disabled when OOS); heart top-right filled when wishlisted; SKU micro-text; serif name; struck original when discounted; star rating (+reviewCount); `stockLabel` line with tone colors.
- `src/components/home/HomeView.tsx`: default export `HomeView`.
  - On mount: Promise.all of the 8 fetches (featured/bestSeller/trending/handmade/newest pageSize 8/4/4/4/8, categories, collections, settings) via a `fetchJson` helper with per-call try/catch → per-section skeleton (`Skeleton`), ErrorNote (retry re-runs load), EmptyNote. Settings pushed via `setSettings` only if store empty (`useApp.getState()`).
  - Sections a–m exactly as specced: (a) full-viewport #0A0A0A hero w/ radial gold glow, JewelHero absolute right/behind with opacity entrance + pointer-events layering, staggered framer-motion copy, eyebrow "HANDCRAFTED IN JAIPUR · SINCE 2016", serif headline with italic gold "Modern Muse", gold + outline buttons → shop/about, trust row w/ ShieldCheck/Truck/RotateCcw, scroll cue; (b) framer-motion infinite marquee (0%→-50% loop, Diamond separators, charcoal + gold borders, static when reduced-motion); (c) 2×2 large editorial collection cards → navigate("collection",{collection:slug}); (d) 4 category tiles → setShopQuery({category:slug}) + navigate("shop"); (e) New Arrivals grid(4) + "View all" → resetShopQuery()+setShopQuery({sort:"newest"})+shop; (f) Best Sellers snap-x horizontal row; (g) Trending 4-grid with serif 01–04 indexes; (h) Artisan Soul split: offset gold-frame image `/images/products/pendant-handmade.png`, craft value props (Hammer/Gem/Sparkles/Leaf), 2 handmade cards, CTA → collection artisan-soul; (i) charcoal pull-quote story teaser + `/images/brand/artisan.png` + button → about; (j) testimonials grid w/ gold stars from settings; (k) instagramGallery 4-col grid w/ hover overlay → instagramUrl; (l) WhatsApp band "Shop with a human, not a cart." → `waGeneralInquiry(settings)` new tab; (m) centered newsletter form POST /api/newsletter w/ inline validation + sonner toasts. NO footer (shell owns it).
  - Local `SafeImg` + ProductCard fallback handle missing `/images/**` assets (only robots.txt exists in /public right now).
- Ran `bun run lint`; fixed all issues in MY files (react-hooks/set-state-in-effect: deferred WebGL probe + IO fallback via requestAnimationFrame; removed unused eslint-disable img directives). Verified with targeted eslint on the 5 files → clean. `bunx tsc --noEmit` → no errors in my files. `bun run build` NOT run (forbidden).

Stage Summary:
- Files created (only): src/components/three/JewelHero.tsx, src/components/home/Reveal.tsx, src/components/home/SectionHeading.tsx, src/components/home/ProductCard.tsx, src/components/home/HomeView.tsx
- Decisions/assumptions:
  1. `/api/products` returns Paginated<Product> directly (items[]); categories/collections return `{categories|collections}`; settings returns `{settings}`; newsletter returns `{success,message}` or 400 `{error}` — matched accordingly.
  2. featured=true&pageSize=8 is fetched per spec but has no dedicated section; used as graceful fallback pool for best/trending/newest/handmade lists when those endpoints fail or return empty.
  3. Quick-add `unitPrice` follows the spec formula netPrice(price+delta, discount%). Note: `useApp.cartSubtotal()` re-applies discountPercent, so carts built purely from quick-add would double-discount in that selector — flagging for the cart/checkout owner (spec formula was followed deliberately; product view should match).
  4. Trending rendered as 4-grid with serif 01–04 indexes (allowed alternative to asymmetric layout) for zero-layout-risk responsiveness.
  5. Testimonials/Instagram sections hide gracefully when settings has no data; marquee is framer-motion (no globals.css edits allowed) and freezes under reduced motion.
  6. `font-serif` utility relies on layout.tsx wiring `--font-serif` (main agent owns layout; Tailwind fallback stack still renders if not yet wired).
- Next actions for other agents: asset agent should generate /images/products/*.png + /images/brand/artisan.png; main agent may reuse ProductCard in ShopView; cart/checkout owner should double-check the discount handling note above.

---

Task ID: 2-b
Agent: admin-dashboard

Task description: Build the complete secure Admin Dashboard UI for Aurelia Jewels under `src/components/admin/` — session gate + login card, shell (header/sidebar/mobile tabs), and 9 section managers (Overview, Products + full ProductForm, Inventory, Orders, Inquiries, Subscribers, Reviews, Store Settings, Audit Logs), all wired to the guarded `/api/admin/*` endpoints.

Work Log:
- Read worklog.md + verified every contract before coding: `@/lib/types` (Product, OrderDTO, StoreSettingsDTO, DashboardStats, Paginated), `@/lib/store` (useApp: navigate/setAdmin only), `@/lib/format` (formatINR/netPrice/formatDate/stockLabel), all `/api/admin/*` + `/api/auth/*` + `/api/categories` + `/api/collections` route sources, and the actual shadcn component exports. Did NOT touch page.tsx, layout.tsx, globals.css, src/lib/**, or ui components.
- `api.ts`: `api<T>()` wrapper (JSON parse, throws `ApiError {status, message, fields}`), module-level 401 registry (`setUnauthorizedHandler`) so ANY admin API 401 globally drops the shell back to the login card, `qs()`, `useDebounced()` hook, `PRODUCT_IMAGE_LIBRARY` (the 12 known `/images/products/*.png`), status constant arrays, `humanize()`.
- `AdminView.tsx` (default export): mount → `GET /api/auth/me` (promise-callback style to satisfy react-hooks/set-state-in-effect); 401 → elegant charcoal login card (gold accents, email+password, raw fetch POST `/api/auth/login`, 401/429 error messages surfaced, success → `useApp.getState().setAdmin(user.name)` + toast). Shell: sticky charcoal header "Aurelia Atelier · Admin" + admin name + "View storefront" (`navigate("home")`) + Logout (POST `/api/auth/logout` → `setAdmin(null)`); sidebar (9 sections w/ icons, gold active rail) collapsing to horizontal scroll tab pills under md; content area switches managers by local `tab` state with remount key.
- `Overview.tsx`: `GET /api/admin/dashboard` → 9 gold serif KPI cards, low-stock list with quick "+5" restock (POST `/api/admin/inventory {productId, delta:5, reason:"RESTOCK"}` → refetch), out-of-stock list (red), recent orders table (orderNumber/customer/total/status badge/date), recent inquiries, top products (sold counts). Gold/champagne/charcoal status badges; red only for CANCELLED/out-of-stock.
- `ProductsManager.tsx` + `ProductForm.tsx`: debounced search + status filter + pagination; table with thumb, name/slug, sku, net price (+struck original), stock badge via `stockLabel`, category, tiny Featured/Best/Trending/Handmade flags, status; row actions Edit / Publish-Unpublish (PATCH status) / Delete (AlertDialog; DELETE may return `{archived:true}` → `toast.info`). ProductForm covers ALL fields (name, sku, slug auto-hint, shortDescription, description, price, discountPercent, categoryId/collectionId fetched from `/api/categories` + `/api/collections`, images URL list with reorder up/down/remove + click-to-toggle gallery picker from the 12 known images, material/purity/color/weight/dimensions, stock (create only), lowStockThreshold, 6 switches, craftsmanship, careInstructions, status select, tags comma string, model3dUrl); variants editor `{name,size,priceDelta,stock}` on CREATE only (no variants endpoint — sent as `variants` array), read-only list + "manage stock via Inventory tab" hint on EDIT; edit PATCH omits `stock`; server `fields` errors mapped under inputs.
- `InventoryManager.tsx`: `q`/`filter` (all/low/out/untracked chips)/`page`; main-stock badge (red at 0, gold ≤ threshold), variant stock chips, tracking flag; "Adjust" dialog (main/variant select, ±delta, RESTOCK/MANUAL_ADJUST/RETURN/CANCEL reason, note → POST, surfaces NEGATIVE_STOCK/UNTRACKED errors); "History" dialog via `movementsFor=<productId>` (signed colored deltas, reason, note, actor, date); "Export CSV" → `window.open("/api/admin/inventory/export")`.
- `OrdersManager.tsx`: search (number/customer/email/phone) + 6 status tabs + pagination; inline status select (PLACED…CANCELLED) and paymentStatus select (UNPAID/PAID/REFUNDED) both PATCH `/api/admin/orders/<id>` with optimistic local patch + reload-on-failure; CANCELLED routes through AlertDialog confirm ("auto-restocks"); detail dialog with full customer/address/notes, itemized rows (image/sku/variant/unitPrice/lineTotal) and totals breakdown.
- `InquiriesManager.tsx` (card grid, mailto/tel links, status select PATCH, delete confirm; client-side text filter — endpoint has no `q`), `SubscribersManager.tsx` (Total/Active summary cards from extra `activeCount`, table, pagination), `ReviewsManager.tsx` (all/pending/approved chips, gold star rows, Approve/Unapprove PATCH, delete confirm), `SettingsManager.tsx` (Brand/Contact/Social/Commerce/Content cards + FAQ `{q,a}` rows + Testimonials rows + Instagram gallery rows with reorder + same gallery picker; single "Save all changes" PATCHes the whole edited object and re-syncs from response), `AuditLogs.tsx` (time/actor/gold mono action chip/entity/entityId/truncated details with title attr, pagination).
- UX rules honored: `'use client'` everywhere, Skeleton loading states, shadcn Table/Dialog/AlertDialog/Select/Switch/Badge, toasts via sonner, `max-h-[70vh] overflow-y-auto` + custom slim gold scrollbar (`.admin-scroll`) for long lists, 44px-friendly controls, responsive sidebar→tabs, red reserved for destructive/cancelled/out-of-stock, zero blue/indigo (grep-verified).
- `bun run lint` → 0 errors; fixed all issues in MY files (rewrote session check as promise callbacks to satisfy `react-hooks/set-state-in-effect`, removed 7 now-unused `@next/next/no-img-element` disable directives since the rule is off, dropped an unused Dialog import). The single remaining project warning is in `src/lib/api-utils.ts` (not mine, untouched). `bunx tsc --noEmit` → no errors in `src/components/admin/**`. Build/dev server NOT run (forbidden).

Stage Summary:
- Files created (only): `src/components/admin/api.ts`, `AdminView.tsx`, `Overview.tsx`, `ProductsManager.tsx`, `ProductForm.tsx`, `InventoryManager.tsx`, `OrdersManager.tsx`, `InquiriesManager.tsx`, `SubscribersManager.tsx`, `ReviewsManager.tsx`, `SettingsManager.tsx`, `AuditLogs.tsx` (+ handover note `agent-ctx/2-b-admin-dashboard.md`).
- Decisions/assumptions:
  1. Global 401 handling via handler registry in api.ts; login/logout/me use raw fetch or api() deliberately so expected 401s (boot check, bad login) don't double-trigger.
  2. Variants are create-only (POST payload `variants[]`); backend currently IGNORES this array (no variant creation in `POST /api/admin/products`) — UI already degrades gracefully; flagged for backend owner in agent-ctx note.
  3. Dashboard `recentOrders` rows are slim (no `items`, extra `itemCount`) vs `DashboardStats.recentOrders: OrderDTO[]` — typed locally as `RecentOrder`.
  4. Product `stock` only settable at create; edits go through Inventory movements (POST `/api/admin/inventory`).
  5. Inquiries search is client-side (endpoint lacks `q`); subscribers endpoint returns extra `activeCount` beyond Paginated.
  6. Admin chrome is dark charcoal + ivory content with white cards; login is a full charcoal screen — self-contained background, safe under the main agent's shell.
- Next actions for other agents: backend owner should add `variants[]` support to `POST /api/admin/products` (contract note in `agent-ctx/2-b-admin-dashboard.md`); main agent should mount `<Toaster />` (sonner) once in the shell so admin toasts render, and import `AdminView` for the `#/admin` view (login gate is built in).
