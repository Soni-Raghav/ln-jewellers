# Aurelia Jewels — Premium 3D Jewelry E-Commerce

A complete, production-ready, database-driven jewelry e-commerce platform: immersive Three.js 3D storefront, full catalog, cart & checkout, WhatsApp ordering, secure admin dashboard with real inventory management, audit trails, and role-based auth.

![stack](https://img.shields.io/badge/Next.js-16-black) ![ts](https://img.shields.io/badge/TypeScript-5-gold) ![prisma](https://img.shields.io/badge/Prisma-SQLite-green) ![threejs](https://img.shields.io/badge/Three.js-R3F-orange)

---

## ✨ Feature highlights

**Storefront**
- Immersive 3D hero (React Three Fiber + Drei): procedural gold ring with metallic PBR materials, sparkles, mouse parallax, lazy mounting, `prefers-reduced-motion` support, and a graceful CSS fallback when WebGL is unavailable
- Editorial luxury design system: gold `#D4AF37` / champagne `#E6C87A` / deep black / ivory palette, Playfair Display + Jost typography
- Home: featured collections, categories, new arrivals, best sellers, trending, handmade showcase, brand story, testimonials, Instagram gallery, WhatsApp CTA, newsletter
- Shop: live search (name/SKU/attributes), category/collection/price/stock filters, 5 sort modes, pagination, active-filter chips, skeletons, empty & error states
- Product pages: gallery, variants with per-variant stock, discounts, ratings, reviews (+ public review submission w/ moderation), care & craft details, related products, wishlist, share, product-specific WhatsApp inquiry with prefilled SKU/variant/qty/price
- Cart (persisted via localStorage), checkout with **server-validated totals**, order tracking, wishlist, About, Contact (DB-backed inquiries), FAQ, and editable policy pages

**Commerce & safety**
- **Two checkout options**: WhatsApp concierge checkout (works with zero credentials) and Razorpay-ready online payment flow (activates automatically when keys are configured, server-side signature verification, idempotent)
- **Overselling protection**: conditional atomic decrements (`UPDATE … WHERE stock >= qty`) inside a transaction; cancelled orders auto-restock
- Every price, discount, shipping fee and tax is **recalculated server-side** — the frontend can never dictate amounts
- Inventory movement ledger + audit log for every stock change and admin action
- Order lifecycle: `PLACED → CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED / CANCELLED`

**Admin dashboard** (`#/admin`)
- Login gate with JWT (HMAC-SHA256) in an httpOnly, SameSite cookie · bcrypt password hashing · role-based authorization on every `/api/admin/*` route
- Overview KPIs (products, inventory units, orders, revenue from paid orders, low-stock/out-of-stock alerts with one-click restock)
- Product CRUD (create w/ variants + image picker, edit, publish/unpublish, archive-safe delete for items with order history)
- Inventory management: search/filters, per-variant stock, adjustments with reasons, movement history, CSV export
- Order management with status & payment status control, customer details, itemized dialogs
- Inquiries, subscribers, review moderation, store settings (brand, WhatsApp number, socials, shipping/tax, all policy texts, FAQ, testimonials, Instagram gallery), audit logs

**Security**
- bcryptjs password hashing · HMAC-signed sessions (httpOnly, Secure in prod, SameSite=Lax) · `requireAdmin()` guard on all admin APIs
- Input validation + sanitization on every endpoint · centralized error handling (no stack traces in prod) · per-IP sliding-window rate limiting (login/contact/newsletter/orders/reviews)
- No secrets in the client bundle — Razorpay keys are server-only; only the publishable key id is exposed

## 🧰 Tech stack (and a note about this build)

| Layer | This build | Notes |
|---|---|---|
| Frontend | **Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui, Framer Motion, Zustand** | The original brief specified Vite + JavaScript. This sandbox mandates the Next.js 16 + TypeScript stack; all views are client components with hash-based routing (`#/shop`, `#/product/slug`, `#/admin`…), which gives shareable URLs from a single deployed route. Porting to Vite/JSX is straightforward since all views are self-contained. |
| Backend | **Next.js API routes** (`src/app/api/**`) | Same REST surface as the Express spec (`/api/products`, `/api/orders`, `/api/admin/*`, …). For Vercel deploys these are serverless functions. |
| Database | **Prisma + SQLite** | Swap `datasource db` provider for Mongo via Prisma's MongoDB connector (or Postgres) without touching business logic. |
| 3D | **Three.js + @react-three/fiber + @react-three/drei** | Procedural models only — no external GLB dependencies to break. |
| Media | Local optimized images (`/public/images`) | Cloudinary-ready via `model3dUrl`/image URL fields. |

## 🚀 Getting started

```bash
# 1. install
bun install          # or npm install

# 2. configure
cp .env.example .env # set AUTH_SECRET at minimum

# 3. database
bun run db:push      # create schema
bun run scripts/seed.ts   # seed 14 products, categories, collections, reviews, orders, settings

# 4. run
bun run dev          # http://localhost:3000
```

**Admin login:** `admin@aureliajewels.com` / `Aurelia@Admin1` → open `#/admin` (or footer → Admin Atelier). *Change the password immediately in any real deployment.*

**Scripts**
| Command | Purpose |
|---|---|
| `bun run dev` | dev server |
| `bun run lint` | ESLint |
| `bun run db:push` | sync Prisma schema |
| `bun run scripts/seed.ts` | seed demo data (idempotent; `--force` reseeds) |

## 🔐 Environment variables

See [`.env.example`](./.env.example). Required in production: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`. Optional: Razorpay (enables online payments), SMTP (email notifications), Cloudinary (media CDN). Only `NEXT_PUBLIC_*` variables ever reach the browser.

## ☁️ Deployment guide

1. **GitHub** — push this repo:
   ```bash
   git init && git add -A && git commit -m "Aurelia Jewels v1"
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
2. **Vercel** — import the repo (Next.js is auto-detected). Add all env vars from `.env.example` in *Project → Settings → Environment Variables*.
3. **Database** — SQLite is local-disk only; on Vercel either (a) switch Prisma to the MongoDB/Postgres provider and set the connection string, or (b) use a persistent-volume host (Railway/Render/Fly) for the API. Run `db:push` + seed against the production DB once.
4. **Payments** — set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`; toggle `razorpayEnabled` in admin → Store Settings. WhatsApp checkout remains the zero-config fallback.
5. **Verify** — `/api/health` returns `healthy`; place a test order; confirm admin + inventory persist.

## 📁 Structure

```
src/
  app/api/…            # REST API (public + admin, auth-guarded)
  components/
    three/             # R3F 3D hero (procedural gold ring)
    home/              # homepage sections, product card, reveal helpers
    storefront/        # shop, product, cart, checkout, content pages
    admin/             # dashboard: overview, products, inventory, orders…
    layout/            # navbar, footer, WhatsApp float, search
  lib/                 # types, zustand store, auth (JWT/bcrypt), rate limit, formatting
prisma/schema.prisma   # 13 models incl. orders, payments, movements, audit logs
scripts/seed.ts        # realistic demo catalog + settings
```

## 📄 License & credits

Demo content (brand "Aurelia Jewels", product copy, imagery) is original and generated for this project. Replace store details, WhatsApp number, and policies in **Admin → Store Settings** before going live.
