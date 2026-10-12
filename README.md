# LN Jewellers — Premium 3D Jewelry E-Commerce

A complete, production-ready, database-driven jewelry e-commerce platform: immersive Three.js 3D storefront, full catalog, cart & checkout, WhatsApp ordering, secure admin dashboard with real inventory management, audit trails, and role-based auth.

![stack](https://img.shields.io/badge/Next.js-16-black) ![ts](https://img.shields.io/badge/TypeScript-5-gold) ![prisma](https://img.shields.io/badge/Prisma-SQLite%20%2F%20Postgres-green) ![threejs](https://img.shields.io/badge/Three.js-R3F-orange)

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
| Database | **Prisma + SQLite (dev) → PostgreSQL (prod)** | Same models both ways — `scripts/use-postgres-schema.mjs` swaps the provider for hosting (Vercel/Render + free Neon Postgres). No business-logic changes needed. |
| 3D | **Three.js + @react-three/fiber + @react-three/drei** | Procedural models only — no external GLB dependencies to break. |
| Media | Local optimized images (`/public/images`) | Cloudinary-ready via `model3dUrl`/image URL fields. |

## 🚀 Getting started (local)

```bash
# 1. install (postinstall auto-runs `prisma generate`)
bun install          # or npm install

# 2. configure
cp .env.example .env # SQLite URL works as-is; set AUTH_SECRET

# 3. database
bun run db:push      # create schema
bun run db:seed      # seed 14 products, categories, collections, reviews, orders, settings

# 4. run
bun run dev          # http://localhost:3000
```

**Admin login:** `admin@lnjewellers.com` / `LN@Admin1` → open `#/admin` (or footer → Admin Atelier). *Change the password immediately in any real deployment.*

**Scripts**
| Command | Purpose |
|---|---|
| `bun run dev` | dev server |
| `bun run lint` | ESLint |
| `bun run db:push` | sync Prisma schema (SQLite, local dev) |
| `bun run db:seed` | seed demo data (idempotent; `--force` via `db:seed:force`) |
| `npm run db:postgres` | switch to PostgreSQL: generates `schema.postgres.prisma`, `db push` + generate (run against your hosted DB) |
| `npm run db:seed` | seed the connected DB (works for SQLite **and** Postgres) |

## 🔐 Environment variables

See [`.env.example`](./.env.example). Required in production: `DATABASE_URL` (Postgres), `AUTH_SECRET` (long random string), `NEXT_PUBLIC_SITE_URL` (your live URL). Optional: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (enables online payments). Only `NEXT_PUBLIC_*` variables ever reach the browser.

## ☁️ Deploy it free — GitHub + Vercel + Neon (recommended)

This stack deploys 100% free: **GitHub** (code) → **Neon** (free Postgres) → **Vercel** (free hosting + serverless APIs). Total time ≈ 15 minutes.

### Step 0 — Push the code to GitHub

Create an empty repo at https://github.com/new (name suggestion: `ln-jewellers`, **private** if you prefer), then:

```bash
git remote add origin https://github.com/<your-username>/ln-jewellers.git
git push -u origin main
```

> Local `.env`, the dev database, and QA artifacts are already gitignored — nothing sensitive is pushed.

### Step 1 — Create the free database (Neon)

1. Sign up at https://neon.com (free plan — no credit card).
2. Create a project, e.g. `ln-jewellers`.
3. Copy the **pooled** connection string (looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).

### Step 2 — Prepare the production database (one time, from your machine)

```bash
git clone https://github.com/<your-username>/ln-jewellers.git && cd ln-jewellers
npm install
export DATABASE_URL="postgresql://…?sslmode=require"   # paste your Neon URL
npm run db:postgres   # creates tables via Postgres schema + generates client
npm run db:seed       # seeds catalog, settings, coupons + the admin account
```

> Windows (PowerShell): use `$env:DATABASE_URL="…"` instead of `export`.

### Step 3 — Deploy on Vercel

1. Go to https://vercel.com/new → **Import** the repo (Next.js is auto-detected).
2. **Environment Variables** — add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon pooled URL (`…?sslmode=require`) |
   | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` |

3. **Deploy.** The build automatically generates the Postgres Prisma schema
   (`vercel.json → buildCommand`) — no manual steps.
4. Visit your URL → site live. `https://<your-project>.vercel.app/api/health` → `{"status":"healthy"}`.

### Step 4 — Go-live checklist

- [ ] Sign in at `#/admin` with the seeded admin (`admin@lnjewellers.com` / `LN@Admin1`) — **change the password immediately**.
- [ ] Admin → Store Settings: set your real **WhatsApp number**, email, address, socials, policies.
- [ ] Place a test order end-to-end (WhatsApp checkout works with zero configuration).
- [ ] Optional: add `RAZORPAY_KEY_ID`/`SECRET` in Vercel → toggle *Razorpay enabled* in admin settings → redeploy.
- [ ] Optional: add your custom domain in Vercel → update `NEXT_PUBLIC_SITE_URL` to it.

### Alternative — Render.com (free)

This repo ships a [`render.yaml`](./render.yaml) blueprint: Render dashboard → **New → Blueprint** → pick the repo, paste your Neon `DATABASE_URL` when prompted. Render's free plan has an ephemeral disk, so keep using Neon for the DB (its SQLite file would reset on every redeploy).

### Troubleshooting

| Symptom | Fix |
|---|---|
| `P1001: Can't reach database server` | Append `?sslmode=require` to the Neon URL; use the **pooled** connection string. |
| Build fails on Vercel with Prisma errors | Ensure `DATABASE_URL` is set for *Production* (and Preview if you deploy branches). |
| Admin login fails after deploy | DB wasn't seeded — repeat Step 2 against the Neon URL. |
| Prices/orders reset after a Render redeploy | Expected on the free plan (ephemeral disk) — the DB must be Neon, not local SQLite. |

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

Demo content (brand "LN Jewellers", product copy, imagery) is original and generated for this project. Replace store details, WhatsApp number, and policies in **Admin → Store Settings** before going live.
