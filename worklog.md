# LN Jewellers — Project Worklog

Shared handover document. Every agent MUST read this before working and append a section after finishing.

> NOTE: Rounds 1-11 were built under the previous brand "Aurelia Jewels". Round 12 rebranded
> everything to **LN Jewellers** (UI, metadata, DB settings, admin account, SKUs, coupon LN10,
> order prefix LN-). Historical entries below keep the old name for accuracy.

---

## Project Brief (read me first)

Premium 3D jewelry e-commerce website "LN Jewellers" (rebranded from "Aurelia Jewels" in round 12) — luxurious golden theme (#D4AF37 gold, #E6C87A champagne, #0A0A0A black, #171717 charcoal, #FAF7F0 ivory), Three.js 3D hero, full shop/catalog/cart/checkout, secure admin dashboard with inventory management, WhatsApp integration, all database-backed.

**Stack (sandbox-adapted, do not fight it):**
- Next.js 16 App Router + TypeScript (single visible route `/` — all views are client-side via hash router in `src/lib/store.ts`)
- Tailwind CSS 4 + shadcn/ui (New York) — components in `src/components/ui` (do NOT rebuild them)
- Prisma + SQLite (`db/custom.db`), schema in `prisma/schema.prisma`, seeded via `scripts/seed.ts` (14 products, categories, collections, orders, reviews, settings)
- API routes under `src/app/api/**` (public: products, categories, collections, settings, orders, contact, newsletter, reviews, auth, payments; admin: dashboard, products, inventory, orders, inquiries, subscribers, reviews, settings, audit-logs — all guarded by `requireAdmin()`)
- Auth: JWT (HMAC) in httpOnly cookie `ln_session`. Admin: `admin@lnjewellers.com` / `LN@Admin1` (seed-created only, no public admin signup). Customers self-register via `POST /api/auth/register` and sign in through the navbar AuthDialog; orders placed signed-in link via `Order.userId`; account area at `#/account`.
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
---
Task ID: 1
Agent: main-agent (orchestrator)
Task: Full build of Aurelia Jewels premium 3D jewelry e-commerce (schema, APIs, storefront, integration, QA)

Work Log:
- Inspected workspace (Next.js 16 + TS + Tailwind 4 + shadcn/ui + Prisma/SQLite); adapted the requested Vite/Express/Mongo stack to sandbox mandates (documented in README)
- Installed three/@react-three/fiber/@react-three/drei/bcryptjs
- Designed Prisma schema (13 models: User, Category, Collection, Product, ProductVariant, InventoryMovement, Order, OrderItem, Payment, ContactInquiry, NewsletterSubscriber, Review, StoreSettings, AuditLog); db:push done
- Core libs: src/lib/types.ts, auth.ts (JWT HMAC + bcrypt + requireAdmin + logAudit), rate-limit.ts, api-utils.ts, format.ts (INR/WhatsApp builders), store.ts (zustand hash-router + cart + wishlist), serialize.ts
- Full API surface: public (health, settings, categories, collections, products list/detail, orders create/track, contact, newsletter, reviews, auth login/logout/me, payments create/verify) + admin (dashboard, products CRUD, inventory GET/adjust + CSV export, orders, inquiries, subscribers, reviews, settings, audit-logs) — all admin routes requireAdmin-guarded
- Seeded via scripts/seed.ts: 14 products (4 categories, 4 collections), variants, reviews, 2 demo orders, inquiries, subscribers, rich store settings; admin admin@aureliajewels.com / Aurelia@Admin1
- Generated 14 brand images via z-ai CLI into public/images/{products,brand}
- Launched subagents: Task 2-a (3D hero + homepage — 5 files) and Task 2-b (admin dashboard — 12 files); both lint-clean, worklogs appended
- Built shell: layout.tsx (Playfair+Jost fonts, SEO/OG metadata, sonner), globals.css (gold theme tokens, scrollbar, marquee), Navbar, Footer (sticky via mt-auto), WhatsAppFloat, SearchDialog, page.tsx (hash router, lazy views, skip-link)
- Built storefront views: ShopView, CollectionView, ProductView (variants/review dialog), CartView, CheckoutView, WishlistView, TrackOrderView, AboutView, ContactView, FaqView, PolicyView, AdminLoginView, NotFoundView
- Fixes during integration: cart double-discount convention (ProductCard stores gross; netPrice applied once), admin products POST now creates variants[], PolicyView missing Button import, react-hooks setState-in-effect in Cart/Checkout, removed unused eslint-disable directives, waOrderMessage customer.name undefined bug
- Emoji corruption in dev toolchain: replaced ✨ with ◆ in WhatsApp message templates (verified correct %E2%97%86 in href)

Stage Summary:
- Lint: 0 errors 0 warnings. Dev server: compiles clean, no runtime errors in dev.log (only benign THREE.Clock deprecation warning)
- Agent-browser E2E verified: home renders (3D ring live), shop filters/counts, product detail (price/strike/variants/stock/rating), add-to-bag → cart math (netPrice once, free shipping ≥₹50k, GST 3%), checkout → order AUR-20261012-8CKI7 created → WhatsApp prefilled msg incl. name/SKU/variant/totals/address; stock decremented 2→1; oversell attempt rejected ("Only 1 left…"); admin routes 401 unauthenticated; admin login → dashboard KPIs live; order status PLACED→CONFIRMED persisted; inventory +10 RESTOCK persisted w/ movement + actor; contact/newsletter save + validation errors; mobile 390px renders; footer sticky
- Git: committed locally as 83248d0 on main. NOT pushed — no GitHub credentials in sandbox; push commands documented in README (Deployment guide)
- Known follow-ups: Razorpay/SMTP/Cloudinary need credentials; product-card quick-add uses first variant (product page has full variant picker); single-route sandbox constraint means hash routing (shareable URLs preserved)
---
Task ID: cron-r2
Agent: webDevReview agent (round 2)
Task: QA sweep + coupon system + recently-viewed + JSON-LD/sitemap + styling polish

Work Log:
- Reviewed worklog; app healthy (GET / 200, /api/health ok)
- QA sweep via agent-browser: About/Contact/FAQ/Policy/Track/404 all render (sticky footer confirmed on 404); admin CRUD re-verified via API with auth cookie: create-with-variants ✓, patch ✓, delete ✓, invalid inventory rejected ✓; no console/page errors anywhere
- NEW FEATURE — Coupons (spec §6 "validated discounts"):
  * prisma Coupon model + Order.couponCode/couponDiscount; db:push + db:generate
  * src/lib/coupons.ts authoritative validator (active/expiry/usage-limit/minSubtotal/cap, never exceeds subtotal)
  * /api/coupons/validate (rate-limited) for checkout UX; order API re-validates + increments usageCount atomically inside the tx (updateMany w/ usageCount < usageLimit field reference → COUPON_LIMIT rejection path)
  * CheckoutView: coupon input/apply/remove UI, discount line, GST recalculated on post-discount subtotal, confirmation shows coupon line; order POST sends couponCode
  * Admin: /api/admin/coupons (+[id] PATCH/DELETE), CouponsManager.tsx (table, create dialog with validation, active toggle, delete confirm), "Coupons" tab in AdminView
  * scripts/seed-coupons.ts: AURELIA10 (10% ≥25k cap 20k), FIRSTGLINT (₹5k ≥75k), HEIRLOOM15 (15% ≥3lakh cap 75k)
  * E2E VERIFIED: coupon applied in UI (−₹3,290 on ₹32,900), order AUR-20261012-HMX3F persisted (subtotal 32900, coupon −3290, tax 888, total 30697), usageCount 0→1
- NEW FEATURE — RecentlyViewed strip (localStorage snapshots, ≥2 items, horizontal scroll on mobile/grid on md), wired into ProductView
- NEW FEATURE — SEO: JSON-LD Product schema (offers/availability/aggregateRating, <-escaped) on product pages; src/app/sitemap.ts + public/robots.txt (both 200)
- STYLING POLISH: 3D hero lighting boosted (ambient 0.65, spot 300, new rim light) — ring now glows vs backdrop; .btn-shimmer gold sweep on hero/checkout CTAs; .img-enter fade-up on product-card + gallery images; MotionConfig reducedMotion="user" + fade view transitions in page.tsx; gold :focus-visible rings
- BUGS FIXED: Prisma client not regenerated after schema change → dev server restart required; discovered stale `next-server` worker process kept serving old client (killed PIDs); learned sandbox kills non-double-forked background processes — stable pattern is `(setsid nohup bun run dev &)` subshell double-fork; browser stale-chunk ChunkLoadError fixed by full browser session restart (agent-browser close + open)

Stage Summary:
- Lint 0 errors 0 warnings; committed e27da45
- All round-2 features browser-verified (see work log); dev server stable via double-fork pattern
- Next suggestions: coupon usage counter in dashboard KPIs; WhatsApp message could include coupon line; product Q&A; size-guide modal; order confirmation email (needs SMTP creds); Git push still pending credentials

---
Task ID: cron-r3
Agent: webDevReview agent (round 3)
Task: Status assessment + agent-browser QA + new features (product Q&A, size guide, coupon analytics, WhatsApp coupon line) + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy (GET / 200, /api/health ok); reviewed worklog; git tree clean on main @e27da45
- QA sweep via agent-browser (fresh session): home (3D hero, 31/31 images load after scroll — earlier "broken" counts were lazy-load false positives), shop (13 pieces, filters), product detail, reviews, related grid, footer sticky, admin login + all tabs, mobile 390px responsive. No console/page errors.
- BUGS FOUND & FIXED:
  1. /images/products/pendant-handmade.png + bracelet-chain.png referenced by DB (product bhaav-hammered-ruby-pendant, sutra-handchain-bracelet, artisan-soul collection, HomeView editorial) but MISSING on disk → letter-fallbacks in UI. Regenerated both via z-ai CLI (1024x1024, luxury catalog style); verified 200 + rendered.
  2. Pre-existing tsc errors fixed: products route orderBy union type, settings route `let dto = null` typing, ContactView InfoCard icon prop (React.ElementType → LucideIcon), PolicyView settings.updatedAt (added updatedAt to StoreSettingsDTO + SettingsManager default).
- NEW FEATURE — Product Q&A (full stack):
  * prisma ProductQuestion model (productId, name, email?, question, answer?, approved, answeredAt) + db:push + prisma generate (client regen required dev-server restart via (setsid nohup bun run dev &))
  * Public: GET/POST /api/products/[slug]/questions (POST rate-limited 5/30min, validated, sanitized; GET returns approved+answered only)
  * Admin: GET /api/admin/questions (q + filter all/pending/answered + pagination, product join), PATCH /api/admin/questions/[id] (answer→answeredAt+audit QUESTION_ANSWER, approve→audit), DELETE (audit)
  * ProductView: QuestionsSection (grid cards Q./A. gold markers, "AURELIA ATELIER" attribution, empty state) + AskQuestionDialog (name/email-optional/question, field errors, moderation notice)
  * Admin QuestionsManager.tsx (search debounced, filter chips, product thumb cards, answer textarea auto-rows, Publish answer auto-approves, Unapprove toggle, delete confirm) + "Q & A" tab in AdminView
- NEW FEATURE — Size Guide dialog (src/components/storefront/SizeGuideDialog.tsx): shown next to "Choose option" (variants) or under stock line (no-variant products in rings/bracelets-bangles/necklaces); tabs per category; BIS Indian ring chart (5–15 → US/diameter/circumference, US=(Indian+3)/2), bangle chart (2.2"–2.10"), chain length guide (14"–24"); how-to-measure tips; real WhatsApp deep link for bespoke sizing
- NEW FEATURE — Coupon analytics: dashboard API adds activeCoupons/couponRedemptions/couponSavings/pendingQuestions; Overview gets 4 new KPI cards (13 total) w/ gold icon badges + hover lift shadow; /api/admin/coupons GET adds per-coupon `granted` (order groupBy) → "Savings given" column (−₹3,290 shown for AURELIA10)
- NEW FEATURE — WhatsApp coupon line: format.ts waTotalsLines helper; waCartInquiry/waOrderMessage accept optional couponCode/discount and print `Coupon (CODE): −₹X`; CheckoutView passes order.couponCode/couponDiscount (verified in intercepted wa.me URL: "Coupon (AURELIA10): −₹5,650")
- STYLING POLISH: Cart free-shipping banner → gold gradient progress bar (role=progressbar); cart item dividers gold-tinted; cart + checkout summaries rebuilt with uppercase hairline rows (border-[#D4AF37]/10) + serif totals + "The Details"/"Almost yours" eyebrows + btn-shimmer on checkout CTA; admin KPI cards hover-lift w/ gold glow; product specs accordion now hairline-separated luxury table
- E2E VERIFIED: question submit → admin answer+approve → public Q&A visible (Priya Sharma resize question live); order AUR-20261012-BTOBY w/ AURELIA10 (subtotal 56500, −5650, GST 1526, total 52376) → coupon usage 1→2, granted ₹3,290→₹8,940; size guide dialog + ring table renders; admin Q&A tab + Overview KPIs + Coupons savings column render; mobile Q&A responsive
- bun run lint → 0 errors 0 warnings; bunx tsc --noEmit → clean in src/ (only examples/+skills/ scaffolding noise remains); committed ff4a9ec

Stage Summary:
- Files created: src/app/api/products/[slug]/questions/route.ts, src/app/api/admin/questions/route.ts, src/app/api/admin/questions/[id]/route.ts, src/components/admin/QuestionsManager.tsx, src/components/storefront/SizeGuideDialog.tsx, public/images/products/{pendant-handmade,bracelet-chain}.png
- Files modified: prisma/schema.prisma, src/lib/{format,types}.ts, src/app/api/admin/{dashboard,coupons}/route.ts, src/app/api/products/route.ts, src/app/api/settings/route.ts, src/components/admin/{AdminView,Overview,CouponsManager,SettingsManager}.tsx, src/components/storefront/{ProductView,CartView,CheckoutView,ContactView}.tsx
- Next suggestions: (1) order-confirmation email needs SMTP creds; (2) Razorpay/Cloudinary/GitHub push all still blocked on credentials; (3) product page video/360° tab if GLB assets arrive; (4) gift-wrap option at checkout; (5) "load more" pagination feel on shop grid

---
Task ID: cron-r4
Agent: webDevReview agent (round 4)
Task: Status assessment + agent-browser QA + new features (gift wrap, printable invoice, sales chart, wishlist share, image zoom) + 3D gem fix + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy (GET / 200, /api/health ok); git clean on main @ff4a97d55...; bun run lint 0 errors 0 warnings; tsc clean in src/; reviewed worklog (all rounds 1-3 features intact).
- QA SWEEP (agent-browser, fresh session): home 3D hero + all sections, shop filters/sort, product detail (breadcrumbs/variants/size guide/Q&A/stock urgency), cart, checkout (coupon + payment options), track order (stepper), admin login + all tabs, footer sticky. Zero console/page errors. No regressions found.
- BUGFIX — 3D hero gem rendered as flat white artifact (octahedron + emissive 0.3 + spotLight 300 saturated the large facet to pure white):
  * Iterated 3 times in browser: (1) meshPhysicalMaterial + warmer color + lower emissive + spot 300→190; (2) roughness 0.22/clearcoat 0.45; (3) octahedron → icosahedron (20 facets, scale y 1.18) — gem now reads as a faceted champagne stone with individual facet shading. Verified via screenshots.
- NEW FEATURE — Signature gift wrap (FULL STACK, spec §6 "gift wrap option"):
  * prisma: Order.giftWrap Boolean + Order.giftWrapFee Float; StoreSettings.giftWrapFee Float @default(500); db:push + client regen (dev server restarted via (setsid nohup bun run dev &))
  * Server-trust: POST /api/orders accepts giftWrap bool, fee ALWAYS computed server-side from settings.giftWrapFee (client value ignored); total = subtotal − coupon + shipping + tax + giftWrapFee; persisted + returned in response
  * CheckoutView: "Finishing touches" card (Checkbox + Gift icon, +₹500 price, luxury packaging copy), summary gift-wrap line, PlacedOrder confirmation line, giftWrap sent to API + WhatsApp totals
  * WhatsApp: waTotalsLines prints "Signature gift wrap: ₹500"; waOrderMessage appends "Please include the signature gift wrap." — VERIFIED in intercepted wa.me URL for order AUR-20261012-CQ95Z
  * Track order API returns giftWrap/giftWrapFee (+couponCode/couponDiscount/address fields for invoice) → TrackOrderView shows gold gift-wrap line
  * Admin: OrdersManager detail dialog shows "Signature gift wrap ₹500" (gold, via new TotalRow gold prop; also added coupon line that was missing); SettingsManager Commerce card gets "Gift wrap fee (₹)" input; admin settings PATCH validates giftWrapFee (max(0, toFloat))
  * DB VERIFIED: AUR-20261012-CQ95Z {giftWrap:true, giftWrapFee:500, subtotal:56500, shipping:0, tax:1695, total:58695} — math exact
- NEW FEATURE — Printable invoice (TrackOrderView): "Print invoice" button (window.print) + print-only letterhead block (brand header, "Tax invoice", order number/date, billed-to address, payment method) + @media print CSS in globals.css (visibility-switch technique, hides nav/footer/timeline/images, strips chrome from the order card, print:hidden on interactive rows)
- NEW FEATURE — Admin 14-day sales chart: dashboard API computes salesSeries (14 day buckets {date,label,orders,revenue} from the orders already fetched); Overview gets "Last 14 days" card — pure SVG gold-gradient bar chart with order-day dots, hover <title> tooltips, date labels every 2 days, totals in header (VERIFIED: "7 orders · ₹7,28,980 value", gold bar on 12 Oct). No chart lib added (zero deps).
- NEW FEATURE — Wishlist sharing: WishlistView header gets "Ask concierge on WhatsApp" (green CTA) + "Copy list" (clipboard w/ toast); WhatsApp message lists up to 12 wished pieces with net prices — VERIFIED in intercepted wa.me URL ("1. *Surya Solitaire Ring* — ₹1,70,100")
- NEW FEATURE — Product image hover zoom (ProductView gallery): cursor-following transform-origin (loupe feel), scale 1.85 with 300ms ease-out, "Hover to zoom" pill fades while active — VERIFIED via DOM (origin 50% 49.97%, scale 1.85) + screenshots; desktop-only relevance (touch ignores hover)
- STYLING POLISH: Add-to-bag active:scale-[0.97] press feedback; gift wrap/coupon lines styled gold (#7a611f) across checkout/track/admin; TotalRow gold variant in admin
- E2E VERIFIED (agent-browser): gift wrap check → +₹500 in summary & total 58,695; order placed → confirmation + wa.me URL with gift wrap lines; tracked order shows gift wrap line + Print invoice btn; admin order detail + settings fee field + chart render; wishlist share URL correct; zoom transform live; mobile 390px checkout "Finishing touches" card renders; no console errors anywhere
- bun run lint → 0 errors 0 warnings; bunx tsc --noEmit → clean in src/; dev.log clean (only benign THREE.Clock deprecation); committed 7af9fa6 (+ gitignore for tool-results/)

Stage Summary:
- Files modified: prisma/schema.prisma, src/lib/{types,format}.ts, src/app/globals.css, src/app/api/orders/route.ts, src/app/api/orders/[number]/route.ts, src/app/api/admin/{settings,dashboard}/route.ts, src/components/storefront/{CheckoutView,TrackOrderView,WishlistView,ProductView}.tsx, src/components/admin/{Overview,OrdersManager,SettingsManager}.tsx, src/components/three/JewelHero.tsx
- Decisions: (1) gift wrap fee is per-order (not per-item) and untaxed — simplest correct default for a concierge-style service; (2) chart is dependency-free SVG (no recharts) to keep bundle lean; (3) print CSS uses visibility-switch so the letterhead + order card print as one clean invoice page; (4) shop "Load more" considered and skipped — numbered pagination already covers it well.
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged from round 3)
- Next suggestions: (1) order-confirmation email (needs SMTP); (2) engraving/text personalization per item at checkout (like gift wrap pattern); (3) coupon usage counter already in KPIs — could add per-coupon conversion on Coupons tab; (4) admin orders CSV export; (5) 360° spin tab when GLB assets arrive
---
Task ID: cron-r5
Agent: webDevReview agent (round 5)
Task: Status assessment + agent-browser QA + new features (engraving personalization, orders CSV export, coupon revenue analytics) + styling polish (sticky mobile buy bar, engraving preview plate)

Work Log:
- STATUS ASSESSMENT: dev server healthy (GET / 200, /api/health ok); git clean on main @3c8abc5; bun run lint 0 errors; tsc clean in src/ (only skills/ scaffolding noise); reviewed worklog rounds 1-4.
- QA SWEEP (agent-browser, fresh session): home 3D hero, shop filters, product detail (variants/Q&A/size guide), cart, checkout, track order, admin login + all tabs (orders, coupons), footer sticky. Zero console/page errors. No regressions found -> per mandate, moved to new features.
- NEW FEATURE — Hand-engraving personalization (FULL STACK, spec "engraving request"):
  * prisma: Order.engravingText String? + Order.engravingFee Float @default(0); StoreSettings.engravingEnabled Boolean @default(true) + engravingFee Float @default(1500); db:push + client regen (dev server restarted via (setsid nohup bun run dev &) — STALE PRISMA CLIENT gotcha hit again: API returned settings without new fields until restart)
  * Server-trust: POST /api/orders accepts engravingText (sanitized, 60 chars, must contain alnum); fee ALWAYS server-side (settings.engravingFee, 0 when disabled); total += engravingFee; persisted + returned; engraving silently dropped when admin disables the feature
  * CheckoutView: "Hand engraving by our master karigar" card inside Finishing touches (hidden when disabled): input w/ 60-char live counter (aria-live), +fee, gold live PREVIEW PLATE (champagne gradient, serif italic uppercase "your inscription" — verified visually), gold-highlighted border when filled; summary "Engraving ₹1,500" row; PlacedOrder confirmation row; waOrderMessage passes engraving -> wa.me URL contains `Engraving ("A · R 14.02.2026"): ₹1,500` AND closing `Please engrave: "A · R 14.02.2026".` (intercepted + verified)
  * Track order API/UI returns engraving -> totals row + gold "Hand-engraving request" banner (karigar placement note); admin OrdersManager detail: "Engrave: ..." gold callout in Ship-to + gold Engraving totals row
  * Admin SettingsManager Commerce card: "Engraving fee (₹)" input + "Hand engraving" enable Switch; /api/admin/settings PATCH validates engravingFee + engravingEnabled (toggle tested true<->false via API, SETTINGS_UPDATE audit-logged)
  * ProductView: "Personalise it — add hand engraving at checkout" hint (hidden when disabled/sold out)
  * E2E ORDER VERIFIED: AUR-20261012-EOMBV {engravingText:"A · R 14.02.2026", engravingFee:1500, subtotal:56500, shipping:0, tax:1695, total:59695} — math exact; tracked via /#/track (banner + line shown)
- NEW FEATURE — Admin orders CSV export: /api/admin/orders/export (requireAdmin, audit ORDERS_EXPORT) — 23 columns incl. customer/address/items summary/coupon/giftWrap/engraving/totals, RFC-safe quoting, orders-YYYY-MM-DD.csv; "Export CSV" button in OrdersManager toolbar (window.open); VERIFIED via authed curl (headers + rows correct)
- NEW FEATURE — Coupon conversion analytics: /api/admin/coupons GET adds per-coupon orderCount (_count) + revenue (_sum total, CANCELLED excluded); CouponsManager gets 4-card summary strip (Savings given −₹8,940 / Coupon orders 2 / Revenue influenced ₹83,073 / Avg. coupon basket ₹41,537, gold icon badges + hover glow) + "Orders" + "Avg. basket" columns (AURELIA10 row: 2 · ₹41,537 · −₹8,940)
- STYLING POLISH: sticky mobile buy bar on ProductView (lg:hidden, IntersectionObserver-free scroll/resize listener, shows when buy box scrolls past, thumb+name+price+variant+Add-to-bag, safe-area-inset padding, mr-14 clears WhatsApp float, active:scale press) — VERIFIED 390px SHOWN at bottom / HIDDEN at top; checkout summary item rows now show SKU (mono font); screenshots saved to download/ (sticky-buy-bar-mobile, checkout-engraving-section, admin-order-engraving, admin-coupons-analytics, mobile-engraving, track-engraving)
- BUGS: (1) self-introduced regex typo `^^\d{6}$` in orders route caught + fixed immediately; (2) CouponsManager IIFE brace parsing error caught by lint, fixed; (3) stale Prisma client after db:push -> dev server restart required (recurring sandbox gotcha, documented in r3)
- bun run lint -> 0 errors 0 warnings; bunx tsc --noEmit -> clean in src/; dev.log clean; committed b6c8323 on main (NOT pushed — still no GitHub credentials)

Stage Summary:
- Files created: src/app/api/admin/orders/export/route.ts
- Files modified: prisma/schema.prisma, src/lib/{types,format}.ts, src/app/api/orders/route.ts, src/app/api/orders/[number]/route.ts, src/app/api/admin/{settings,coupons}/route.ts, src/components/storefront/{CheckoutView,TrackOrderView,ProductView}.tsx, src/components/admin/{OrdersManager,CouponsManager,SettingsManager}.tsx
- Decisions: (1) engraving is per-order (like gift wrap) not per-item — karigar confirms placement manually; (2) 60-char single-line cap for hand engraving feasibility; (3) CSV export capped at 5000 orders per file; (4) coupon revenue excludes CANCELLED orders so avg-basket is meaningful
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged)
- Next suggestions: (1) per-item engraving (choose which piece gets inscribed) when multi-item orders need it; (2) order-confirmation email (needs SMTP); (3) admin dashboard engraving KPI (personalization attach-rate); (4) 360° spin when GLB assets arrive; (5) coupon per-order list view (which orders used which code)

---
Task ID: cron-r6
Agent: webDevReview agent (round 6)
Task: Status assessment + agent-browser QA + new features (back-in-stock alerts full stack, coupon order drill-down, personalization attach-rate KPIs, rotating coupon announcement bar, product duplicate) + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy; git clean on main; bun run lint 0 errors; tsc clean in src/; reviewed worklog rounds 1-5. QA sweep via agent-browser (home 3D hero, shop filters, product detail, cart math 2×₹32,900+GST=₹67,774 exact, admin dashboard session-persisted) — zero console errors, no regressions, no bugs found -> moved to features.
- NEW FEATURE — Back-in-stock "Notify me" (FULL STACK):
  * prisma: StockAlert model (productId FK cascade, email, phone?, notified, notifiedAt, @@unique([productId,email])) + db:push + client regen (dev server restarted via (setsid nohup bun run dev &) double-fork pattern)
  * Public: POST /api/products/[slug]/stock-alerts (rate-limit 6/30min, email+optional phone validated, upsert resets notified on re-subscribe)
  * Admin: GET /api/admin/stock-alerts (q/filter all|pending|notified/pagination + product join + pendingCount), PATCH/DELETE /api/admin/stock-alerts/[id] (audit STOCK_ALERT_NOTIFIED/REOPENED/DELETE)
  * ProductView: OOS state now shows gold "Notify me when available" button (replaces disabled Add-to-bag/Buy-now) + atelier note + NotifyMeDialog (email*, WhatsApp optional, field errors, privacy copy); sticky mobile bar shows "Notify me" when OOS
  * Admin: new "Stock Alerts" tab (Bell icon, after Inventory) — StockAlertsManager: summary cards (Awaiting outreach / Total / concierge tip), filter chips, debounced search, product thumb + "still sold out"/"back in stock (N)" state, mailto links, Mark notified/Reopen, delete confirm
  * E2E VERIFIED: set product+3 variants to 0 via inventory API (negative-stock guard respected, used exact deltas) -> OOS UI live (SOLD variants struck) -> dialog submit -> toast "You're on the list..." -> admin tab row -> Mark notified -> "Notified · 12 Oct 2026" -> stock restored (+3/+4s RESTOCK) -> storefront back to Add-to-bag, KPI Notify Requests 0. All audit-logged.
- NEW FEATURE — Dashboard personalization attach rates: engravingOrders/giftWrapOrders/eligibleOrders (CANCELLED excluded) -> engravingAttach/giftWrapAttach %; Overview gets "Notify Requests" (Bell) + "Engraving Attach %" (PenLine) + "Gift Wrap Attach %" (Gift) KPI cards — 16 total, suffix support added to KPI renderer. Verified 13%/13% (1 of 8 orders each).
- NEW FEATURE — Coupon order drill-down: GET /api/admin/coupons/[id]/orders (orders w/ couponCode, savedTotal) + CouponsManager "Orders" count is now a dotted-underline button -> dialog "Orders using CODE" (count + total discounts given header, per-order rows w/ number/customer/email/date/total/−saved/status badge). VERIFIED: AURELIA10 -> 2 orders −₹8,940.
- NEW FEATURE — Rotating announcement bar (AnnouncementBar.tsx replaces hardcoded Navbar strip): fetches public GET /api/coupons/active (active+unexpired+non-exhausted, marketing-safe select) and rotates evergreen trust line <-> coupon promos ("FIRSTGLINT · ₹5,000 off orders above ₹75,000" + COPY CODE chip -> clipboard + toast); 5.5s fade rotation (framer-motion AnimatePresence), pauses on hover, static under reduced-motion; hidden on mobile (unchanged). VERIFIED rotating live: FIRSTGLINT/HEIRLOOM15 messages + copy click fired (clipboard read blocked in headless browser only).
- NEW FEATURE — Product duplicate-as-draft: ProductsManager Copy icon -> setEditProduct({...p, id:"", name+" (Copy)", sku:"", slug:"", status:DRAFT, flags false}) -> ProductForm isEdit now requires id; duplicate prefills form + carries variants into editable rows; title "Duplicate as new draft". E2E VERIFIED: duplicated Ganga Cascade Earrings -> slug auto "ganga-cascade-earrings-copy", SKU AUR-EAR-009, DRAFT, stock 10 -> then deleted cleanly via UI.
- STYLING POLISH: ProductCard gold corner accents (L-shaped top-left/bottom-right frames slide in on hover); cart/wishlist empty states get rotated gold diamond ornament; PWA manifest.webmanifest + icons/appleWebApp in layout metadata (theme-color already #0A0A0A).
- Tooling note: an external tool auto-committed round-5 screenshots (f2cf583, UUID message) — harmless; round-6 commit a36d93b sits on top.
- bun run lint -> 0 errors 0 warnings; bunx tsc --noEmit -> clean in src/; dev.log clean; committed a36d93b on main (NOT pushed — still no GitHub credentials).

Stage Summary:
- Files created: src/app/api/products/[slug]/stock-alerts/route.ts, src/app/api/admin/stock-alerts/route.ts, src/app/api/admin/stock-alerts/[id]/route.ts, src/app/api/admin/coupons/[id]/orders/route.ts, src/app/api/coupons/active/route.ts, src/components/admin/StockAlertsManager.tsx, src/components/layout/AnnouncementBar.tsx, public/manifest.webmanifest
- Files modified: prisma/schema.prisma, src/lib/types.ts, src/app/api/admin/dashboard/route.ts, src/app/layout.tsx, src/components/admin/{AdminView,Overview,CouponsManager,ProductsManager,ProductForm}.tsx, src/components/layout/Navbar.tsx, src/components/storefront/{ProductView,CartView,WishlistView}.tsx, src/components/home/ProductCard.tsx
- Decisions: (1) StockAlert is product-level not variant-level (concierge re-crafts whole piece; variant OOS shows sold chips already); (2) re-subscribing same email resets notified so next restock re-pings; (3) coupons exposed publicly are filtered to active+unexpired+non-exhausted and marketing-safe fields only; (4) duplicate prefill keeps stock + variants (editable), clears SKU/slug, forces DRAFT; (5) attach rates exclude CANCELLED so the denominator is meaningful.
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) order-confirmation + restock emails need SMTP creds; (2) "email all notified-pending requesters" bulk action when SMTP lands; (3) shop grid "notify me" quick chip on OOS cards (currently detail-page only); (4) per-coupon conversion funnel (views->orders) needs analytics events; (5) 360° spin when GLB assets arrive.

---
Task ID: cron-r7
Agent: webDevReview agent (round 7)
Task: Status assessment + agent-browser QA + new features (per-product interactive 3D stage, OOS notify chip on shop cards, customer order-cancellation requests full stack) + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy (GET / 200, /api/health ok); git clean on main @64f86bd; bun run lint 0 errors; tsc clean in src/; reviewed worklog rounds 1-6.
- QA SWEEP (agent-browser, fresh session): home 3D hero, shop grid/search, product detail (variants/size guide/Q&A/reviews), track order, admin session persisted + all tabs — zero console/page errors, no regressions. Search dialog w/ live suggestions + RecentlyViewed + related products confirmed ALREADY EXISTING (skipped as feature candidates).
- NEW FEATURE — ProductStage: interactive "View in 3D" on the product page (FULL 3D, master-prompt flagship):
  * New src/components/three/ProductStage.tsx — fully procedural per-category jewellery models from primitives (NO GLB/network): rings (band + engraved accents + bezel + faceted gem + 4 prongs), earrings (jhumka pair: stud + gem + link + flared DoubleSide bell + 8-bead rim + pearl drops), necklaces (chain loop + sway animation + bail + faceted drop), bracelets-bangles (stacked trio w/ filigree overlays + gems).
  * Metal + gem colours derived from the product's own material string (rose/white/silver → tinted golds; ruby/emerald/sapphire/pearl/diamond → gem tones; diamonds+pearls use a "pale" PBR path: low emissive, high clearcoat).
  * Interaction: drei OrbitControls (drag rotate, scroll/pinch zoom, damping, polar clamps, slow autoRotate) — drag E2E-verified via mouse (before/after screenshots differ).
  * Full resilience contract mirrors JewelHero: WebGL probe → photo fallback panel, prefers-reduced-motion → frameloop "demand" + no auto-rotate/float/sparkles, runtime error boundary → photo fallback, lazy IntersectionObserver mount.
  * Per-category framing table (camera z / orbit target y / shadow floor y) — fixed earrings over-zoom + necklace pendant touching the shadow plane.
  * ProductView gallery: segmented "Photographs | View in 3D" tablist switch; 3D stage chrome = gold "3D ATELIER VIEW" badge + "Drag to rotate · scroll to zoom" pill + inset gold vignette on black stage; mode resets to photos on slug change; hover-loupe zoom handlers disabled in 3D mode. VERIFIED on all 4 categories (screenshots) + mobile 390px.
- NEW FEATURE — "Notify me" chip on out-of-stock ProductCards:
  * Extracted shared src/components/storefront/NotifyMeDialog.tsx (was inline in ProductView; ProductView now imports it).
  * OOS cards replace disabled "Unavailable" with a gold "Notify me" button (stopPropagation, opens dialog); OOS veil restyled to warm black gradient + champagne "SOLD / Crafted to order" chip.
  * E2E: zeroed Surya ring + 4 variants via inventory API (negative-stock guard respected) → card shows SOLD + Notify me → dialog submit → toast → StockAlert row in DB → stock fully restored to original [6 / 0,2,1,1].
- NEW FEATURE — Customer order-cancellation requests (FULL STACK):
  * prisma: Order.cancelRequested Boolean + cancelReason String? + cancelRequestedAt DateTime?; db:push + prisma generate + dev server restart.
  * POST /api/orders/[number]/cancel-request (public; rate-limit 5/30min per IP; requires order number + matching email — same trust model as tracking; only PLACED/CONFIRMED/IN_PRODUCTION; rejects shipped/cancelled; reason sanitized ≤300 chars, field-level validation error).
  * GET /api/orders/[number] returns the 3 new fields; OrderDTO + TrackOrder local interface extended.
  * Admin PATCH /api/admin/orders/[id]: accepts cancelRequested:false (decline → clears flag+reason+time, audit ORDER_UPDATE w/ declineRequest marker); approving via status→CANCELLED now audits ORDER_CANCEL_APPROVED incl. customerReason; data typed Prisma.OrderUpdateInput.
  * TrackOrderView: amber "Cancellation requested" banner (reason + date + concierge copy), "Request cancellation" button when eligible → dialog (reason textarea, keep-order option), optimistic UI update. E2E VERIFIED: request submitted → banner live → screenshot.
  * OrdersManager: pulsing amber dot on order number when requested; detail dialog amber callout w/ reason + "Approve & cancel" (reuses restock confirm) + "Keep order (decline)". E2E VERIFIED: decline cleared DB flags; approve (2nd request) → status CANCELLED + stock 9→10 + last AuditLog = ORDER_CANCEL_APPROVED.
- STYLING POLISH: 3D stage gold-vignette chrome + black backdrop; refined SOLD veil on cards; gold segmented view-mode toggle; amber cancellation banners/callouts consistent storefront↔admin.
- BUGS/GETCHAS: (1) bg-[#0A0A0A] class lost to bg-white cascade → replaced w/ inline style; (2) react-hooks/static-components rejected <Piece/> → createElement(pickModel(...)) pattern; (3) STALE PRISMA CLIENT gotcha AGAIN (POST cancel-request 500 "Unknown argument cancelRequested" until explicit bunx prisma generate + server restart — documented r3/r5, still recurring); (4) badRequest()'s 2nd arg is the fields record itself, not {fields:{...}}.
- bun run lint → 0 errors 0 warnings; bunx tsc --noEmit → clean in src/; dev.log clean; committed 1d1d2c2 on main (NOT pushed — still no GitHub credentials). Screenshots in download/r7-*.png.

Stage Summary:
- Files created: src/components/three/ProductStage.tsx, src/components/storefront/NotifyMeDialog.tsx, src/app/api/orders/[number]/cancel-request/route.ts
- Files modified: prisma/schema.prisma, src/lib/types.ts, src/app/api/orders/[number]/route.ts, src/app/api/admin/orders/[id]/route.ts, src/components/storefront/{ProductView,TrackOrderView}.tsx, src/components/home/ProductCard.tsx, src/components/admin/OrdersManager.tsx
- Decisions: (1) procedural geometry per category keeps the zero-asset contract (no GLBs) while honouring the master prompt's "interactively rotatable 3D on products"; (2) material-derived tints make each product's stage feel bespoke without per-product modelling; (3) cancellation is request-then-concierge (not self-serve cancel) — matches a high-touch jewellery brand and reuses the existing restock-on-cancel transaction; (4) cancelling an order keeps cancelRequested=true as a historical record (UI hides the callout when CANCELLED).
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) emails (order confirmation, cancel-approved, restock) still need SMTP creds; (2) "email all pending stock-alert requesters" bulk action when SMTP lands; (3) shareable 3D stage snapshot (canvas.toDataURL → WhatsApp/image download); (4) per-item engraving selection for multi-item orders; (5) 360° auto-spin capture mode for the 3D stage (record orbit → webm/gif for social).

---
Task ID: cron-r8
Agent: webDevReview agent (round 8)
Task: Status assessment + agent-browser QA + new features (private appointment booking full stack, 3D snapshot capture, jhumka geometry/framing fix) + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy (GET / 200, /api/health ok); git clean on main @ea0aa07; bun run lint 0 errors; tsc clean in src/; reviewed worklog rounds 1-7. QA sweep via agent-browser (home 3D hero, product detail, admin login + dashboard 16 KPIs) — zero console/page errors, no functional regressions. One visual defect found: product-page 3D jhumka earrings read as disconnected (link floating above bell apex) and composition sat low in frame -> prioritized as this round's bugfix.
- NEW FEATURE — Private appointment booking (FULL STACK, concierge flagship):
  * prisma: Appointment model (name/email/phone/type STORE_VISIT|VIDEO_CALL/date YYYY-MM-DD/timeSlot/notes/status PENDING|CONFIRMED|DECLINED|COMPLETED, indexes on status+date+createdAt) + db:push + bunx prisma generate + dev server restart (stale-client gotcha pre-empted)
  * Public: POST /api/appointments (rate-limit 5/30min per IP; server-side validation: name>=2, isEmail, isPhone w/ country code, type enum, date today..+90d computed in IST, slot enum 6 slots 11AM-6:30PM; notes sanitized <=500; field-level errors returned)
  * Admin: GET /api/admin/appointments (q search name/email/phone/notes + filter all|today|pending|confirmed|completed|declined + pagination; returns pendingCount/todayCount/upcomingCount — "today" and ordering computed in IST to match the atelier calendar); PATCH/DELETE /api/admin/appointments/[id] with APPOINTMENT_UPDATE/APPOINTMENT_DELETE audit logs
  * Storefront: src/components/storefront/AppointmentBooking.tsx — luxury section on ContactView (dark gold header band "Book a private appointment", radio type cards Atelier-visit vs Video-consultation w/ gold selected state, date input min=today IST, slot select, 3-col contact row, notes, success state w/ formatLongDate summary + "Book another visit"); footer company links gains "Book an Appointment"
  * Admin UI: AppointmentsManager.tsx + "Appointments" tab (CalendarClock) — 3 summary cards, filter chips incl TODAY, debounced search, table w/ guest/long-date+slot/type icon/notes/status badge, row highlighted when date==today, Confirm/Complete/Decline/Reopen transitions, mailto deep link prefilled with appointment subject, delete confirm dialog
  * Dashboard: pendingAppointments + todaysAppointments added to /api/admin/dashboard + DashboardStats; Overview now 18 KPI cards ("Appointment Requests", "Today's Book")
- E2E VERIFIED (browser): filled booking form (had to scope selectors to the booking section — the contact form above has identical placeholders and DOM order wins), submitted -> toast + DB row {Devika Rathore, STORE_VISIT, 2026-10-20, 3:30 PM, PENDING}; admin API confirm -> CONFIRMED; admin tab renders row w/ long date "Tue, 20 Oct 2026", Complete/Decline actions; dashboard KPIs present. Server-side validation E2E-verified earlier (empty submit -> 4 field errors rendered).
- NEW FEATURE — 3D stage snapshot (master-prompt 3D flagship complement):
  * ProductStage: Canvas gl now preserveDrawingBuffer:true; new CaptureBridge (useThree) registers a capture fn on the parent's ref — renders a fresh frame then toDataURL (works even in reduced-motion "demand" frameloop); ProductView stage chrome gains gold "Snapshot" button (Camera icon, bottom-left) -> downloads aurelia-<slug>-3d.png + success toast; graceful error toast when stage still loading
  * E2E VERIFIED: click -> PNG (850x1062 RGBA) downloaded as aurelia-ganga-cascade-earrings-3d.png; contents inspected — correct render at current orbit pose
- BUGFIX — Jhumka earrings 3D geometry + framing (3 iterations verified via screenshots):
  * Root cause 1: bell cone sat 0.6 units below the connector link (apex at 0.425 vs link 1.05) -> pair read as floating parts
  * Root cause 2: pair span x=±(1.35+0.85) exceeded the portrait 4:5 frame at any z that kept the piece large (horizontal visible ≈ 4.5 at z 8.6)
  * Fix: bell apex now meets the link (cone center y 0.55, radius 0.8, height 1.0), rim/beads/drop repositioned to the mouth, added short chain cylinder stud->link, spacing tightened to ±1.05, framing earrings {z:8.2, ty:1.05, sy:1.6} — full connected piece fills the frame; verified on screenshots + snapshot PNG
- STYLING POLISH: appointment section champagne header band w/ radial gold glow + serif heading; type-option cards w/ gold gradient selected state + check bubbles; booking success state w/ gold check medallion; admin appointments row today-highlight (bg-[#D4AF37]/[0.06]); footer appointment link
- VERIFICATION: bun run lint 0 errors 0 warnings; tsc clean in src/; agent-browser console clean on all pages touched; mobile 390px booking card responsive (stacked type cards, full-width 44px+ inputs); all 4 category 3D stages re-verified (ring/necklace/bangle untouched by earring fix); committed 9b91b71 on main (NOT pushed — still no GitHub credentials)

Stage Summary:
- Files created: src/app/api/appointments/route.ts, src/app/api/admin/appointments/route.ts, src/app/api/admin/appointments/[id]/route.ts, src/components/admin/AppointmentsManager.tsx, src/components/storefront/AppointmentBooking.tsx
- Files modified: prisma/schema.prisma, src/lib/types.ts (AppointmentDTO + DashboardStats fields), src/lib/format.ts (formatLongDate, TZ-safe for date-only strings), src/app/api/admin/dashboard/route.ts, src/components/admin/{AdminView,Overview}.tsx, src/components/storefront/{ContactView,ProductView}.tsx, src/components/three/ProductStage.tsx, src/components/layout/Footer.tsx
- Decisions: (1) Appointment.date is a YYYY-MM-DD string not DateTime — avoids TZ drift between the customer's chosen calendar day and the atelier's IST book (formatLongDate parses date-only strings at noon); (2) status flow is request->concierge-confirm (PENDING->CONFIRMED->COMPLETED, DECLINED/Reopen) matching the brand's high-touch model; (3) snapshot uses preserveDrawingBuffer on the product stage only (hero stage untouched) — minor VRAM cost, big UX win; (4) booking rate limit 5/30min aligns with contact/questions endpoints.
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) confirmation emails for appointments/orders/stock-alerts once SMTP creds land (mailtos already prefilled in admin); (2) appointment slots could respect per-day capacity (prevent >N bookings per slot); (3) shareable snapshot -> Web Share API with file on mobile; (4) per-item engraving for multi-item orders; (5) 360° auto-spin capture for social when GLB assets arrive.

---
Task ID: cron-r9
Agent: webDevReview agent (round 9)
Task: Status assessment + agent-browser QA + new features (per-piece engraving full stack, gift-card messages, appointment slot capacity, 3D snapshot share) + styling polish

Work Log:
- STATUS ASSESSMENT: dev server healthy; git clean @bc2435b; lint 0/0; tsc clean in src/ (examples/+skills/ noise only). Reviewed worklog rounds 1-8.
- QA SWEEP (agent-browser): home (3D hero, collections, arrivals render; full-page screenshot blanks are just lazy-reveal false positives), shop filters, product page, cart, checkout E2E order (AURELIA10 server-side discount verified, order AUR-...-ALC9M), admin dashboard 18 KPIs + chart, 3D jhumka stage. Zero console/page errors, no functional regressions. ONE BUG FOUND: hash-change navigation (browser back/forward, edited URL) kept the previous scroll position -> fixed.
- BUGFIX — hashchange scroll reset: page.tsx onHash now rAF-scrolls to top after syncFromHash (in-app navigate() already did). VERIFIED: scroll 3000px on shop -> edit hash -> scrollY=0 on product view.
- NEW FEATURE — Per-piece hand engraving (FULL STACK, replaces order-level single inscription):
  * prisma: OrderItem.engravingText String? + db:push + prisma generate + server restart
  * ProductView: collapsible "Add hand engraving" panel (PenLine, "+₹1,500 / piece" from settings, 60-char counter, live gold preview plate); addToCart carries engravingText; toast mentions engraving; resets on slug change
  * store.ts: cart line identity = product+variant+engraving (engraved & plain pieces are separate lines); updateQuantity/removeFromCart accept engraving key; NEW setItemEngraving (edit/remove with duplicate-line merge)
  * CartView: gold engraving chip with X (remove), engraving-aware qty/remove, karigar note under checkout CTA
  * CheckoutView: order-level input REMOVED; "Finishing touches" shows per-line engraved pieces list + fee; summary "Engraving ×N ₹N"; payload sends per-item engravingText
  * Server /api/orders: authoritative — sanitizes per-item text (≤60, alnum check), fee = engravedPieces × settings.engravingFee, engraved only when settings.engravingEnabled; Order.engravingText=null (legacy), engravingFee=total; items store their own text
  * waOrderMessage: per-line "↳ engrave: …" + totals fallback line; confirmation page + TrackOrderView (item chip + fee row) + OrdersManager (item chip + "Hand engraving (per piece)" row) + CSV export ([engrave: …] in Items col) + dashboard engravingOrders now counts engravingFee>0 (covers both models)
- NEW FEATURE — Gift message on the gift card (FULL STACK):
  * prisma: Order.giftMessage String?
  * CheckoutView: textarea appears when gift wrap checked (≤200 chars, counter, live note-card preview w/ wax-seal diamond); stored only when giftWrap true (server strips otherwise)
  * Shown: checkout confirmation ("On the gift card" card), TrackOrderView (gold gradient note card), admin OrdersManager (gold callout in Ship-to), WhatsApp message ("Gift card: …"), CSV GiftMessage column
- NEW FEATURE — Appointment slot capacity (FULL STACK, no overbooking):
  * prisma: StoreSettings.appointmentSlotCapacity Int @default(2); admin Settings input (1-10) + PATCH clamps
  * src/lib/appointments.ts: shared TIME_SLOTS + istToday (route.ts + booking form now import it)
  * NEW GET /api/appointments/availability?date= → per-slot {slot, remaining, full} (PENDING+CONFIRMED counted)
  * POST /api/appointments: capacity check → badRequest w/ fields.timeSlot ("fully booked… message us on WhatsApp")
  * AppointmentBooking: fetches availability on date change, options show "— fully booked" (disabled) / "— 1 seat left", "Up to N guests per private slot" hint, toast if full slot chosen, graceful static-list fallback on fetch failure
- NEW FEATURE — 3D snapshot share: ProductView stage chrome gains gold "Share" button → capture → File → navigator.canShare({files}) ? navigator.share : download PNG + open WhatsApp with product link + toast; AbortError (share-sheet dismiss) swallowed
- STYLING POLISH: gold engraving chips (rounded-full, #D4AF37/8 bg, serif italic inscription) across cart/checkout/track/admin; note-card gift preview with wax-seal corner diamond; per-piece fee copy ("+₹1,500 / piece"); mobile 390px verified (panel full-width, 44px targets)
- E2E VERIFIED (browser + DB): engraved order AUR-20261012-TGNCU (item.engravingText "I · S 2026", giftMessage stored, fee 1500, total 60195 ✓); WA prefill shows "↳ engrave"; track shows chip + note card; admin detail shows chip + gift callout; slot capacity: 2nd booking took last 3:30 PM seat, 3rd POST rejected, storefront option "3:30 PM IST — fully booked [disabled]"; share fallback toast; scroll fix
- GETCHAS: (1) STALE PRISMA CLIENT 3rd recurrence — schema pushed + generate + "restart" at round start, yet order.create 500 "Unknown argument giftMessage" mid-round; root cause: setsid restart raced the system-held port 3000 (old server kept serving). Fix: pkill next/next-server THEN restart; documented again — always pkill-then-start for client-affecting changes. (2) agent-browser can't set controlled React date inputs (fill/native-setter both revert) — use _valueTracker.setValue('') + native setter + input event to drive React.

Stage Summary:
- Files created: src/app/api/appointments/availability/route.ts, src/lib/appointments.ts
- Files modified: prisma/schema.prisma, src/lib/{types,store,format}.ts, src/app/page.tsx, src/app/api/orders/route.ts, src/app/api/orders/[number]/route.ts, src/app/api/admin/{dashboard,settings}/route.ts, src/app/api/admin/orders/export/route.ts, src/app/api/appointments/route.ts, src/components/storefront/{ProductView,CartView,CheckoutView,TrackOrderView,AppointmentBooking}.tsx, src/components/admin/{OrdersManager,SettingsManager}.tsx
- Decisions: (1) engraving fee is per physical piece (qty × fee) — truthful to hand-crafting cost; (2) Order.engravingText kept as legacy (null on new orders) so old orders render unchanged; KPI uses fee>0; (3) cart identity includes engraving so a monogrammed ring and a plain one never merge; (4) gift message requires giftWrap (server strips orphans); (5) capacity counts PENDING+CONFIRMED only — DECLINED/COMPLETED free the slot.
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) emails (order/appointment/restock confirmations) once SMTP lands; (2) appointment per-TYPE capacity (video vs visit); (3) engraving font/style choice (serif vs sans) + preview render; (4) 360° auto-spin capture for the 3D stage; (5) wishlist share sheet.

---
Task ID: cron-r10
Agent: webDevReview agent (round 10)
Task: Status assessment + agent-browser QA + new features (engraving lettering styles full stack, per-type appointment capacity, wishlist native share, 3D 360° spin mode) + styling polish

Work Log:
- STATUS ASSESSMENT: dev healthy (GET / 200, /api/health ok); git clean @b95a3f0; lint 0/0; tsc clean in src/; reviewed worklog rounds 1-9. QA sweep (agent-browser): home / shop / product / track / admin login + dashboard (18 KPIs) — zero console errors, no regressions. Admin session had expired in the fresh browser session; re-login verified.
- NEW FEATURE — Engraving lettering styles SERIF | SCRIPT | SANS (FULL STACK):
  * prisma: OrderItem.engravingFont String? (null = classic serif); db:push + generate + restart
  * format.ts: ENGRAVING_FONTS map (labels, WhatsApp wording, live-preview classNames; SCRIPT -> system cursive stack 'Snell Roundhand/Segoe Script/Brush Script MT', zero webfont/network dependency) + engravingFontLabel() with legacy fallback
  * ProductView: "Lettering style" 3-chip radiogroup with per-style "Aa" sample previews + gold selected state; live inscription preview plate renders in the chosen hand + "<Label> hand" caption; addToCart carries engravingFont; toast "...engraved "X" in elegant script"; resets on slug change
  * store.ts: cart line identity now product+variant+text+FONT (same inscription in two hands = separate jobs); removeFromCart/updateQuantity accept font key; CartView key includes font
  * Server /api/orders: font normalized server-side (unknown -> SERIF, never trusted from client); CRITICAL FIX during review — lines are built 1:1 from incoming items, so engraving fill switched from a fuzzy find() (which compared against line.engravingFont still null and would have silently DROPPED non-SERIF inscriptions) to exact index mapping; items store engravingFont
  * Rendered everywhere: cart chip badge, checkout engraved-pieces list + confirmation, TrackOrderView chip, admin OrdersManager chip (raw Prisma rows flow automatically), WhatsApp message "↳ engrave: "X" in elegant script", CSV export "[engrave: X · script]"
  * E2E VERIFIED: product picker -> script preview -> cart chip "A · R 14.02.26 ELEGANT SCRIPT" -> order AUR-20261012-8IRXM persisted {engravingText, engravingFont:"SCRIPT"} -> WhatsApp prefill contains "in elegant script" -> track chip -> admin detail chip (screenshots)
- NEW FEATURE — Appointment per-TYPE capacity (FULL STACK, no cross-crowding):
  * prisma: StoreSettings.appointmentVisitCapacity + appointmentVideoCapacity (replaced single appointmentSlotCapacity); admin Settings now has two inputs (1-10, clamped server-side too)
  * GET /api/appointments/availability: groupBy timeSlot+type -> per-slot {types:{STORE_VISIT:{remaining,full},VIDEO_CALL:{...}}} + capacities map
  * POST /api/appointments: capacity counted WHERE type = requested — a busy video hour never crowds out the atelier floor
  * AppointmentBooking: slotState is type-aware (suffix "fully booked"/"1 seat left" reflects the SELECTED meeting type), hint copy explains the two separate books
  * E2E VERIFIED (API): visitCapacity=1 -> 1st visit 200, 2nd visit same slot 400 "fully booked", VIDEO_CALL same slot 200 (separate book); capacities restored to 2/2, test rows deleted
- NEW FEATURE — Wishlist "Share list": navigator.share (title+text with numbered pieces, prices, #/wishlist URL) -> AbortError swallowed -> clipboard fallback with descriptive toast; replaced the plain "Copy list" button; WhatsApp concierge button unchanged
- NEW FEATURE — 3D stage 360° spin mode: ProductStage accepts spin prop -> OrbitControls autoRotateSpeed 1.1 -> 6.5 (ignored under reduced-motion); ProductView top-right gold toggle pill "Spin 360°" <-> solid-gold "360° · stop" with slow-spinning icon (consolidated into ONE button to avoid colliding with the bottom drag-hint pill); mode resets on slug change. E2E VERIFIED: frames 1.6s apart show large orbit delta (screenshots)
- STYLING POLISH: lettering chips with in-chip font samples + gold shadow when active; engraving chips now carry a tiny uppercase hand-label badge (cart/checkout/track/admin, consistent); spin toggle chrome states; wishlist share button gold-outline styling; mobile 390px verified (3 chips fit, 44px targets)
- GETCHAS: (1) dev server died after my pkill — the SYSTEM owns `bun run dev`; restart via `setsid bash -c 'bun run dev >> dev.log 2>&1 < /dev/null &'` survives the tool-shell exit (plain `nohup &` did NOT survive); (2) sqlite3 CLI absent — use `bunx prisma db execute --schema prisma/schema.prisma` or a bun -e script for DB checks; (3) agent-browser `find text` fails on buttons whose text is split by an icon node — use [...querySelectorAll].find(b=>b.textContent...).click() via eval
- VERIFICATION: bun run lint -> 0 errors 0 warnings; bunx tsc --noEmit -> clean in src/; console clean across home/shop/product/cart/wishlist/contact/track/admin; committed on main (NOT pushed — still no GitHub credentials). Screenshots in download/r10-*.png.

Stage Summary:
- Files created: (none — all changes extended existing modules)
- Files modified: prisma/schema.prisma, src/lib/{types,store,format}.ts, src/app/api/orders/route.ts, src/app/api/orders/[number]/route.ts, src/app/api/admin/orders/export/route.ts, src/app/api/admin/settings/route.ts, src/app/api/appointments/route.ts, src/app/api/appointments/availability/route.ts, src/components/storefront/{ProductView,CartView,CheckoutView,TrackOrderView,WishlistView,AppointmentBooking}.tsx, src/components/admin/{OrdersManager,SettingsManager}.tsx, src/components/three/ProductStage.tsx
- Decisions: (1) engravingFont null = classic serif so every pre-existing engraved order renders unchanged; (2) cart identity includes font — two hands of the same inscription are genuinely different workshop jobs; (3) per-type capacity replaces the shared one — visits and video calls have independent books (schema column swapped, no data migration needed); (4) availability returns the full type matrix per slot so the form can re-render instantly when the guest switches meeting type without a second fetch; (5) wishlist share prefers navigator.share and degrades to clipboard, never blocking on share-sheet dismissal
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) emails (order/appointment/restock confirmations) once SMTP lands; (2) engraving fee could vary by style (script premium) — needs a settings map; (3) per-coupon funnel analytics needs view/order events; (4) 360° auto-spin capture -> webm/gif for social; (5) order-confirmation PDF invoice download (print stylesheet exists already).

---
Task ID: cron-r11
Agent: webDevReview agent (round 11)
Task: Status assessment + agent-browser QA + new features (per-style engraving fees full stack, review helpfulness votes full stack, dedicated tax-invoice view) + styling polish

Work Log:
- STATUS ASSESSMENT: dev healthy (GET / 200, /api/health ok); git clean @fd1bee4; lint 0/0; tsc clean in src/; reviewed worklog rounds 1-10. agent-browser QA sweep across home / shop / product / cart / admin — zero page errors; admin session persisted. VERDICT: stable → proceeded to feature work per round mandate.
- BUG FOUND & FIXED (pre-existing): serializeProduct() nulled out full review rows, so product detail pages showed rating "5 (2)" in the summary yet the Reviews section always read "No reviews yet" (client never received rows). Fix: serialize.ts keeps full rows when present (runtime "comment" probe — list endpoints' rating-only rows still never leak; verified live via /api/products vs /api/products/[slug]).
- NEW FEATURE — Per-style engraving fees, script premium (FULL STACK):
  * prisma: StoreSettings.engravingFeeScript @default(2500), engravingFeeSans @default(1800); engravingFee (1500) = classic serif base; db:push + generate + pkill-then-start restart
  * /api/orders: authoritative per-hand fee — fee = Σ per line (qty × feeFor(font)); unknown font still normalized to SERIF before pricing (verified: mixed order 2×SERIF+1×SANS+1×GOTHIC → ₹6,300; SCRIPT order → ₹2,500)
  * format.ts: engravingFeeFor(settings, font) + engravingTotals(items, settings) shared helpers (per-hand pricing honoured everywhere client-side)
  * ProductView: header shows SELECTED hand's fee ("+₹2,500 / piece · Elegant Script"), each style chip carries its fee (+₹1,500 / +₹2,500 / +₹1,800); copy explains hands price their own labour
  * CartView chip: "ELEGANT SCRIPT · +₹2,500/pc"; note copy updated; CheckoutView estimate via engravingTotals ("1 piece · ₹2,500"), per-line chips show style + line fee, header "from +₹1,500 / piece" when no engraving yet
  * admin SettingsManager: two new fee inputs (script/sans) + PATCH accepts/clamps; live-tested PATCH 2600 → public settings reflects → restored 2500
  * WhatsApp message + CSV unchanged (totals flow through) — waTotalsLines still truthful
- NEW FEATURE — Review helpfulness votes (FULL STACK):
  * prisma: Review.helpfulCount Int @default(0)
  * NEW POST /api/reviews/[id]/helpful — approved-only, rate-limited 30/10min/IP, returns {helpfulCount}; nonexistent/unapproved → 404 (verified)
  * ProductView: ReviewCard component (extracted) — gold "Helpful" pill → optimistic vote → server count reconciliation → chip "N clients found this helpful"; dedup via localStorage "aurelia_helpful" read in lazy useState initializer (no effect, lint-clean); rollback + toast on failure; E2E: 2 API votes + 1 UI vote = "3 clients found this helpful", persisted in DB, second button hidden after vote
  * admin ReviewsManager: gold "N helpful" ThumbsUp badge on comment cell when count > 0
- NEW FEATURE — Dedicated tax-invoice view #/invoice/AUR-… (FRONTEND on the authed order API):
  * NEW src/components/storefront/InvoiceView.tsx: luxurious invoice sheet — gem letterhead + gold double rule, TAX INVOICE eyebrow, payment-status pill, billed-to/payment grid, items table (qty/rate/amount + engraved chip in the chosen hand), totals with gold rule, gift-card note card, BIS hallmark assurance + signature block, computer-generated footer
  * Privacy: order API requires number + matching billing email, so a direct/shared URL shows a verification gate (order number readonly from hash, email input); arriving from track/checkout/admin (email in state) auto-loads — gate verified on reload, auto-load verified from all three entries
  * Router: ViewName "invoice" + ViewParams.orderNumber/orderEmail; parseHash `#/invoice/:num`; hashFor; page.tsx dynamic import + title "Invoice"
  * Entries: TrackOrderView replaced inline "Print invoice" with "View / print invoice" (legacy print-invoice letterhead kept as Ctrl+P fallback); CheckoutView confirmation gains "View invoice"; admin OrdersManager detail gains "Open tax invoice" (closes dialog, navigates with billing email)
  * Print stylesheet extended: .invoice-sheet revealed + lifted top-left, chrome stripped; agent-browser `pdf` export verified — clean single-page A4 tax invoice (screenshots/PDF in download/)
  * Mobile 390px: items table wrapped in overflow-x-auto, Rate column folds away on <sm (print:table-cell guarantees full grid on paper); verified docHScroll:false + Amount visible after fix
- STYLING POLISH: per-hand fee labels on all three style chips w/ gold emphasis when active; cart/checkout/track/invoice/admin engraving chips now all carry style + fee where relevant; invoice sheet typography (serif brand, uppercase tracking eyebrows, gold rules); review helpful pill hover states; gate copy with lock icon
- CLEANUP: 3 test orders deleted (stock restored per line incl. variant stock, salesCount decremented incl. the variant line — second pass fixed that), their InventoryMovements removed, helpfulCount votes reset to 0; subscribers/reviews intact
- GETCHAS: (1) agent-browser `tab` needs stable ids (t2), positional ints rejected; (2) agent-browser eval must wrap in IIFE or `const` collides across calls; (3) React controlled inputs need _valueTracker.setValue('') BEFORE native setter, then input event (recurring gotcha); (4) Fast Refresh can emit transient "Module not found" console errors while a new file is mid-edit — re-load fresh before judging; (5) pkill-then-start restart worked first time this round
- VERIFICATION: bun run lint → 0 errors 0 warnings; bunx tsc --noEmit → clean in src/; zero page errors across home/shop/product/cart/wishlist/contact/track/invoice/about/faq; committed on main (NOT pushed — still no GitHub credentials)

Stage Summary:
- Files created: src/app/api/reviews/[id]/helpful/route.ts, src/components/storefront/InvoiceView.tsx
- Files modified: prisma/schema.prisma, src/app/globals.css, src/app/page.tsx, src/app/api/orders/route.ts, src/app/api/admin/settings/route.ts, src/lib/{types,format,store,serialize}.ts, src/components/storefront/{ProductView,CartView,CheckoutView,TrackOrderView}.tsx, src/components/admin/{OrdersManager,ReviewsManager,SettingsManager}.tsx
- Decisions: (1) per-hand fees live beside the base fee (engravingFee stays the serif/base price — legacy orders, dashboards and CSV semantics untouched); (2) server re-prices by font with SERIF fallback — client fee labels are presentation only; (3) votes are a social-proof counter: localStorage dedup + IP rate limit, no account binding (not worth a votes table); (4) invoice reuses the existing authed order API instead of a new endpoint — same email verification as tracking, zero new attack surface; (5) serializeProduct keeps full review rows only when they exist (runtime probe) so list endpoints never leak payloads
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged since round 3)
- Next suggestions: (1) emails (order/appointment/invoice PDF attachments) once SMTP lands; (2) invoice number series (legal GST invoice numbers vs order numbers) — needs settings field + audit; (3) review sorting/filtering by helpfulCount ("most helpful first"); (4) gift finder quiz (occasion/budget → curated results) for the home page; (5) admin: per-style engraving revenue breakdown on the dashboard.

---
Task ID: cron-r12
Agent: webDevReview agent (round 12)
Task: USER REQUEST — rebrand to "LN Jewellers" + add customer login; full QA sweep; bug fixes

Work Log:
- USER REQUEST EXECUTED: "Change Name to LN Jewellers and provide login also".
- REBRAND (complete sweep, zero `aurelia` matches left in src/scripts/prisma/README/manifest):
  * Ordered sed pipeline across 32 files: Aurelia Jewels→LN Jewellers, Aurelia Atelier→LN Atelier, aureliajewels→lnjewellers, AURELIA10→LN10, AureliaApp→LNJewellersApp, Aurelia@Admin1→LN@Admin1, aurelia_session/ln_session, aurelia_helpful/ln_helpful, aurelia-→ln- (store key, recent key, download filenames, dev secret), AUR-→LN- (order prefix, seed SKUs, search placeholder), bare Aurelia→LN Jewellers (prose).
  * Navbar/Footer brand lockups de-duplicated (serif "LN" + tracked "JEWELLERS"); hero fallback monogram "A"→"LN"; metadata/OG/twitter/manifest/sitemap → lnjewellers.example.com; admin chrome "LN Atelier · Admin"; Q&A attribution "LN Atelier".
  * DB sweep script scripts/rebrand-db.ts (settings row, prose across products/collections/categories/reviews/questions, SKU prefix, slugs, coupon codes, admin account).
  * New store identity: brandName "LN Jewellers", hello@lnjewellers.com, LN Atelier address, @lnjewellers socials.
- DATA LOSS + RECOVERY (critical lesson): `bun run db:push` (package script has --accept-data-loss) silently RESET custom.db when pushing the Order.userId relation — ALL rows lost. Recovered 100% by re-seeding: scripts/seed.ts (14 products, categories, collections, settings, reviews, 2 demo orders, inquiries, subscribers) + scripts/seed-coupons.ts (LN10/FIRSTGLINT/HEIRLOOM15). All seed content is now LN-branded (seed itself was swept). ALWAYS pkill-then-restart + expect resets when touching schema; never assume push is additive while --accept-data-loss is set.
- CUSTOMER LOGIN (full stack):
  * prisma: Order.userId String? + user relation (SetNull) + @@index([userId]); db:push (see recovery above) + generate.
  * NEW POST /api/auth/register — rate-limited 5/30min, name/email/password(≥8 + letter&number)/confirm validation, 409 on duplicate email, bcrypt, auto-session, AUTH_REGISTER audit.
  * NEW GET /api/auth/orders — session-only, returns the signed-in customer's orders (items incl.) for #/account.
  * /api/orders POST: session-aware — new orders link userId server-side (never trusted from client).
  * /api/orders/[number]: two access paths — number+email (guest) OR owning session (no email). Guests without email get 400, wrong email 404 (E2E verified).
  * AuthDialog (navbar): login/register tabs, show/hide password, per-field server errors, 401/409 surfaced, toast welcome; mounts fresh per open (no reset effects). Radix DialogTitle/Description used (a11y clean).
  * Navbar: "Sign In" pill (guest) ⇄ gold avatar DropdownMenu (My Orders / Wishlist / Sign Out); mobile sheet gets Sign In / Register ⇄ My Orders + Sign Out.
  * store.ts: user/setUser, authOpen/authMode/openAuth; boot /api/auth/me restore in page.tsx (promise-callback style, lint-clean).
  * AccountView #/account: signed-out gate ("Your private salon") or dashboard — profile card, expandable order history with journey timeline (PLACED→DELIVERED), engraving chips w/ hand label, totals, View Invoice + WhatsApp Concierge actions, empty/error/skeleton states. Router: ViewName "account", parseHash, dynamic import, doc title.
  * CheckoutView prefills name/email for members; InvoiceView auto-loads for the owning session without email; TrackOrderView prefills email; Footer gains "My Account" quick link.
- BUGS FOUND & FIXED:
  1. Sticky checkout aside taller than short viewports → "Place order" button unreachable (clip at 577px height; a real laptop-height bug too). Fixed: lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto on the aside. E2E: button y=616 (clipped) → 454 (reachable) → order placed.
  2. Footer copyright "© 2026LN Jewellers" JSX whitespace collapse → single template string.
  3. AuthDialog Radix a11y errors (missing DialogTitle/Description) → proper components; zero console errors now.
  4. Order number prefix still AUR- (orders route was outside the rebrand file list) → LN-20261013-… now; admin ProductForm SKU placeholder → LN-.
- GETCHAS: (1) tool-output pipeline strips `[m` sequences — `const [method,` DISPLAYED as `const ethod,` and sed/python replacements LOOK like no-ops; verify with grep -c, never by eyeballing output (burned 3 debug cycles on a non-bug). (2) agent-browser physical clicks on Radix dropdowns need real pointer events (find role click works, eval .click() doesn't). (3) Radix dialogs taller than the viewport: clicks land on the overlay → silent close; cap dialog height + overflow-y-auto. (4) React controlled inputs in eval: use _valueTracker.setValue + native setter + input event. (5) bunx tsc noise comes only from examples/+skills/ — src/ is clean.
- VERIFICATION (agent-browser, desktop 1440×900 + mobile 390×844): register→auto-login→#account empty state→shop→quick-add→checkout prefilled (name+email from account)→order LN-linked in DB (userId set)→account shows order w/ expand→invoice loads owner-only w/o email→sign out→sign in→order persists; admin login admin@lnjewellers.com/LN@Admin1 → dashboard 200 ("Welcome back, LN Admin."); old Aurelia creds 401; /api/auth/orders unauthenticated 401; mobile menu auth entries + auth dialog scrollable + no horizontal scroll; lint 0/0; tsc clean in src/; console clean. Screenshots: download/r12-mobile-account.png, download/r12-desktop-home.png.
- COMMITTED on main (NOT pushed — still no GitHub credentials in sandbox).

Stage Summary:
- Files created: src/app/api/auth/register/route.ts, src/app/api/auth/orders/route.ts, src/components/layout/AuthDialog.tsx, src/components/storefront/AccountView.tsx, scripts/rebrand-db.ts
- Files modified: prisma/schema.prisma, src/lib/{types,store}.ts, src/app/page.tsx, src/app/layout.tsx, src/app/sitemap.ts, src/app/globals.css, src/app/api/orders/route.ts, src/app/api/orders/[number]/route.ts, src/app/api/auth/{login,logout,me}/route.ts (cookie name), src/app/api/{health,newsletter}/route.ts, src/components/layout/{Navbar,Footer}.tsx, src/components/storefront/{CheckoutView,InvoiceView,TrackOrderView,AboutView,ProductView,WishlistView,AdminLoginView,RecentlyViewed}.tsx, src/components/home/{HomeView,ProductCard}.tsx, src/components/three/JewelHero.tsx, src/components/admin/{AdminView,SettingsManager,CouponsManager,AppointmentsManager,ProductForm}.tsx, src/lib/{auth,format}.ts, scripts/{seed,seed-coupons}.ts, README.md, public/manifest.webmanifest, worklog.md
- Decisions: (1) order numbers keep historical rows (old AUR- orders unchanged); new orders LN-; (2) register always creates CUSTOMER (admin stays seed-only — RBAC preserved); (3) session-owner order/invoice access skips email verification server-side (ownership enforced by Order.userId); (4) localStorage/persist keys renamed with the rebrand (carts reset once — acceptable at rebrand moment); (5) auth dialog caps at 92dvh + scrolls (mobile-safe).
- Still blocked on credentials: Razorpay/SMTP/Cloudinary/GitHub push (unchanged).
- Next suggestions: (1) password reset / change (needs SMTP or admin-assisted); (2) "Continue shopping" deep-links from account rows; (3) wishlist sync to the account (currently device-local); (4) order-level notes thread between client & concierge; (5) emails (order/appointment confirmations) once SMTP lands.

---
Task ID: 13
Agent: main agent (Z.ai Code)
Task: USER REQUEST — "push the code on github and host it for free". Repo is round-12 complete (LN Jewellers, git clean on main). Prepare everything pushable/deployable; GitHub push itself is blocked on user credentials.

Work Log:
- Inspected repo: 314 tracked files; found .env COMMITTED (security) + 103 QA screenshots in download/ + sandbox plumbing (.zscripts, tests, examples, mini-services, Caddyfile). Verified history: .env never contained real secrets (only a local sqlite path), db/ never committed → history is safe to push as-is.
- GIT HYGIENE: git rm -r --cached .env download .zscripts tests examples mini-services Caddyfile; .gitignore gained /download/, sandbox dirs, prisma/schema.postgres.prisma and an !.env.example exception. Repo now 198 clean files.
- POSTGRES PATH: wrote scripts/use-postgres-schema.mjs (derives prisma/schema.postgres.prisma from the canonical schema by provider swap; verified diff = provider line only) so the same models run on Neon/any Postgres. Committed the generated file is NOT tracked (gitignored, regenerated at build).
- HOSTING CONFIGS: vercel.json (framework nextjs, buildCommand = node scripts/use-postgres-schema.mjs && prisma generate --schema prisma/schema.postgres.prisma && next build; /images cache headers); render.yaml (free-tier blueprint, standalone start via node .next/standalone/server.js, healthCheck /api/health, AUTH_SECRET generateValue, DATABASE_URL prompt).
- package.json: renamed ln-jewellers@1.0.0; added postinstall "prisma generate" (Vercel-safe), db:postgres (schema swap + db push + generate against a hosted URL), db:seed / db:seed:force / db:seed:coupons via npx tsx (portable, no bun requirement).
- .env.example committed: DATABASE_URL (sqlite dev + neon prod examples), AUTH_SECRET, NEXT_PUBLIC_SITE_URL, RAZORPAY_* optional.
- README: replaced the thin deploy section with a full free-hosting guide — Step 0 GitHub push (repo already configured: just add remote + push), Step 1 Neon free Postgres, Step 2 one-time db:postgres + db:seed, Step 3 Vercel import + env vars table, Step 4 go-live checklist (change admin password, real WhatsApp number, test order, Razorpay optional, custom domain), Render alternative + troubleshooting table (P1001 sslmode, missing envs, unseeded DB, Render ephemeral disk).
- VERIFICATION: git history checked for secrets (clean); lint 0/0; /api/health {"status":"healthy"}; GET / 200; agent-browser sweep — title "LN Jewellers — Handcrafted 22K Gold Jewelry, Made in Jaipur", hash-nav to #/shop renders 12 product cards, console clean (only benign THREE.Clock deprecation + HMR logs). Screenshot download/r13-home.png.
- COMMITTED: a6bfda8 "Round 13: deploy-ready for GitHub + free hosting" on main (13 commits total).
- PUSH STATUS: BLOCKED ON CREDENTIALS — sandbox has no GitHub token, no gh CLI, no remotes. A push cannot be performed without the user's auth. Handoff prepared: (A) user pastes a GitHub PAT (repo scope) → I add remote + push immediately; (B) user creates repo at github.com/new and runs: git remote add origin https://github.com/<user>/ln-jewellers.git && git push -u origin main (works from their machine; repo is push-ready).

Stage Summary:
- Files created: .env.example, scripts/use-postgres-schema.mjs, vercel.json, render.yaml
- Files modified: .gitignore, package.json, README.md
- Files untracked (local copies kept): .env, download/**, .zscripts/**, tests/**, examples/**, mini-services/**, Caddyfile
- Decisions: (1) Postgres via Neon chosen for prod (serverless hosts have ephemeral disks; SQLite can't persist) — provider-swap script keeps ONE source-of-truth schema; (2) db push happens ONE TIME locally against Neon (documented), Vercel build only swaps schema + generates client — no DB writes during serverless builds; (3) history kept intact (tells rounds 1–13 story) since no real secrets ever committed; (4) AUTH_SECRET stays optional in dev (fallback) but is mandatory in prod docs.
- Blockers: GitHub push + Vercel deploy need user auth (PAT or self-serve). Razorpay/SMTP/Cloudinary still optional-credential items (unchanged).
- Next: the moment credentials land — git push, then Vercel import; after that, optional polish (emails via SMTP, Razorpay live keys, custom domain).

---
Task ID: 14
Agent: main agent (Z.ai Code)
Task: USER REQUEST — "make it fully customization admin dashboard so that i can reduce my coding efforts to change things, provide a option for insta, whatsapp, google review connectivity and admin dashboard should have access to each and everything, full access and customizable"

## CRITICAL INCIDENT (before this round's work): sandbox git-state loss
- Discovered while resuming: .git was swapped/restored to a round-11-era snapshot — rounds 12, 13, 13b, 13c commit objects GONE from the object DB (git cat-file: not found), origin remote removed, reflog showed only two round-11 amends. The WORKING TREE survived intact (full round-13 state + partial round-14 work from a timed-out subagent).
- Root cause: platform-side sandbox restore (timestamps on .git/refs/heads/main postdate the session). Unrecoverable from git.
- RECOVERY: worktree-first reconstruction. Verified integrity (rebrand clean except the rebrand TOOL's own regexes, package.json/bun.lock round-13 state, DB intact 14 products + LN settings, /api/health 200). Committed the entire tree as `75fee28 Reconstruct rounds 12-13 (+ round 14 WIP partials)` (amended message documents the WIP inclusion). Re-added origin remote. LESSON: after any sandbox restore, run `git cat-file -t <expected-head>` + `git remote -v` before trusting history; the worklog.md contract section saved us — it described every lost artifact precisely.
- Subagent partials preserved and folded in: schema (+26 settings fields), DTO, PATCH validation, SettingsAnnouncementBar + navbar wiring (all high quality).

Work Log (round 14):
- SCHEMA (26 new StoreSettings fields, additive; empty/false = built-in defaults so the live site is unchanged until the owner types): googleReviewUrl, googleMapsUrl, googleRating, googleReviewCount; whatsappFloatEnabled, whatsappDefaultMessage; instagramFeedEnabled; heroEyebrow/Title/Highlight/Subtitle/CtaLabel; announcementEnabled/Text; 8 section booleans (showCollectionsSection…showNewsletter); seoTitle/seoDescription/ogImageUrl. db:push verified additive (columns exist, data intact).
- API: PATCH whitelist + per-field max lengths (announcement/SEO 200, hero 300, URLs 500, rating 10) + googleReviewCount clamp 0–100000; public GET spreads new fields automatically.
- STOREFRONT: SettingsAnnouncementBar (gold strip, per-text dismissal in localStorage, falls back to the rotating promo bar via `fallback` prop so the owner announcement WINS while active); HomeView hero copy from settings with per-field fallbacks (custom title renders without highlight when highlight empty); 9 section toggles (`!== false` guards = no flash while settings load); Google Reviews trust badge section (GoogleG inline-SVG 4-color mark, serif rating, stars = round(rating), "N verified Google reviews", review CTA) — independent of the testimonials toggle; Footer: Google G button + "4.9 · N Google reviews" line + address becomes a Maps link; WhatsAppFloat gated on whatsappFloatEnabled; waGeneralInquiry honours whatsappDefaultMessage (signature widened with Partial pick — zero caller breakage); layout.tsx generateMetadata reads DB live (try/catch → static fallbacks) for title/description/OG/twitter.
- ADMIN UI: SettingsManager rebuilt 691→~1000 lines, single scroll → 9 TABS (Brand & Contact | Social & Reviews | Homepage | Commerce & Fees | Content | FAQ | Testimonials | Gallery | SEO & Meta): connectivity card (Google/Maps/rating/count/WhatsApp greeting/float+IG toggles + "getting the Google review link" tip), hero card (placeholders show the built-in copy so empty inputs are self-explanatory), announcement card with LIVE gold preview strip, 8 Switch rows for sections, SEO card. Sticky bottom save bar + "Unsaved changes" indicator (baseline JSON compare). Save pushes fresh settings into the global store (`useApp.getState().setSettings`) so navbar/float react instantly — found via E2E that only HomeView (own fetch) updated live while the shell stayed stale.
- BUGS FIXED: (1) setState-in-effect lint error in announcement bar → dismissal keyed to text, no cleanup effect; (2) stale shell settings after admin save (store sync, above); (3) E2E gotcha: clearing an input to '' via the _valueTracker trick needs tracker.setValue(el.value) BEFORE d.set('') — '' → '' compares equal and React never fires onChange (heroTitle silently persisted until redone correctly).
- E2E (agent-browser, Radix gotchas: tabs need focus+Space/Arrow keys, switches need pointerdown/up+click and a DELAYED state read): hero customization live on home; announcement shows/dismisses/reappears only for new text; testimonials toggle hides/restores; Google badge 4.9 + 214 + footer G button live; WhatsApp float hides/restores; defaults fully restored except REAL data kept (googleRating 4.9, count 214). Mobile 390px: no h-scroll. Console clean everywhere. Screenshots: download/r14-google-badge.png, r14-admin-homepage-tab.png, r14-mobile-home.png.
- VERIFICATION: lint 0/0; tsc clean in src/; dev restart required once (wedged Fast Refresh served old Navbar — documented gotcha: after navbar-level changes, verify the running DOM, restart via setsid pattern if stale).
- COMMITTED: 9532eac on main. PUSH: still 403 — fine-grained PAT still lacks Contents:write (user hasn't updated it).

Stage Summary:
- Files created: src/components/layout/SettingsAnnouncementBar.tsx, src/components/layout/GoogleG.tsx
- Files modified: prisma/schema.prisma, src/lib/{types,format}.ts, src/app/layout.tsx, src/app/api/admin/settings/route.ts, src/components/admin/SettingsManager.tsx, src/components/home/HomeView.tsx, src/components/layout/{Navbar,Footer,WhatsAppFloat}.tsx
- Decisions: (1) empty-string settings = built-in copy (zero-migration, self-documenting placeholders); (2) owner announcement REPLACES the rotating promo bar (never stacked); (3) Google badge independent of testimonials toggle (social proof survives section off); (4) settings→store sync on admin save instead of re-fetch loops; (5) generateMetadata reads DB per request — single-route SPA so cost is trivial.
- Blockers: GitHub push (user must set token Contents → Read and write, or paste a classic repo-scoped token).
- Next suggestions: (1) media uploads via Cloudinary when keys land; (2) section REORDERING (drag) as JSON order array; (3) theme presets (accent color CSS vars) — needs sweeping hardcoded #D4AF37 into a var first; (4) per-page SEO for hash views via client-side document.title updates; (5) emails (order/appointment confirmations) once SMTP lands; (6) homepage "custom section" (free-text + image) for maximum no-code flexibility.
