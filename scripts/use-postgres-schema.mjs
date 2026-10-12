#!/usr/bin/env node
/**
 * LN Jewellers — Postgres schema generator (for free hosting: Vercel + Neon, Render, Railway…)
 *
 * SQLite is perfect for local dev, but serverless hosts have ephemeral disks, so
 * production uses PostgreSQL (e.g. Neon free tier). This script derives
 * `prisma/schema.postgres.prisma` from the canonical `prisma/schema.prisma`
 * by swapping the datasource provider — the model layer is identical, so no
 * business logic changes are ever needed.
 *
 * Usage:  node scripts/use-postgres-schema.mjs
 * Output: prisma/schema.postgres.prisma  (gitignored build artifact)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "prisma", "schema.prisma");
const dest = join(root, "prisma", "schema.postgres.prisma");

let schema = readFileSync(src, "utf8");

if (!/provider\s*=\s*"sqlite"/.test(schema)) {
  // Already postgres (or another provider) — write as-is so the pipeline still works.
  console.log("[use-postgres-schema] schema.prisma is not sqlite — copying unchanged.");
  writeFileSync(dest, schema);
  process.exit(0);
}

schema = schema.replace(
  /provider\s*=\s*"sqlite"/,
  'provider  = "postgresql"',
);

const banner = `// GENERATED FILE — do not edit. Source of truth: prisma/schema.prisma
// Regenerate with: node scripts/use-postgres-schema.mjs
`;

writeFileSync(dest, banner + schema);
console.log("[use-postgres-schema] wrote prisma/schema.postgres.prisma (provider: postgresql)");
