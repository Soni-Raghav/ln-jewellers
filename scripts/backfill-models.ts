/**
 * LN Jewellers — backfill model3dUrl for existing catalog rows.
 * Idempotent: sets /models/{slug}.glb on every product that has a built model.
 * Run:  npx tsx scripts/backfill-models.ts          (local SQLite)
 *       DATABASE_URL="<neon pooled>" npx tsx scripts/backfill-models.ts
 */
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const db = new PrismaClient();
const MODELS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models");

async function main() {
  const products = await db.product.findMany({ select: { id: true, slug: true, model3dUrl: true } });
  let updated = 0;
  for (const p of products) {
    const url = `/models/${p.slug}.glb`;
    if (existsSync(join(MODELS_DIR, `${p.slug}.glb`)) && p.model3dUrl !== url) {
      await db.product.update({ where: { id: p.id }, data: { model3dUrl: url } });
      updated++;
      console.log(`  ${p.slug} → ${url}`);
    }
  }
  const total = await db.product.count({ where: { NOT: { model3dUrl: null } } });
  console.log(`Backfill complete: ${updated} updated, ${total} products now carry a 3D model.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
