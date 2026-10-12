/**
 * One-off rebrand sweep: Aurelia Jewels -> LN Jewellers
 * Sweeps every customer-visible string column, renames the admin account,
 * re-prefixes product SKUs/slugs and the launch coupon code.
 * Run: bunx tsx scripts/rebrand-db.ts   (or `bun run scripts/rebrand-db.ts`)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const RULES: [RegExp, string][] = [
  [/Aurelia Signet Ring/g, "LN Signet Ring"],
  [/Aurelia Jewels/g, "LN Jewellers"],
  [/Aurelia Atelier/g, "LN Atelier"],
  [/aureliajewels/g, "lnjewellers"],
  [/AURELIA10/g, "LN10"],
  [/Aurelia/g, "LN Jewellers"], // remaining prose
];

function fix(s: string): string {
  let out = s;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}

/** Apply fix() to every string property of a row; returns changed fields only. */
function sweep<T extends Record<string, unknown>>(row: T): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id") continue;
    if (typeof v === "string") {
      const next = fix(v);
      if (next !== v) data[k] = next;
    }
  }
  return data;
}

async function sweepTable(name: string, rows: Record<string, unknown>[], update: (id: string, data: Record<string, string>) => Promise<unknown>) {
  let n = 0;
  for (const row of rows) {
    const data = sweep(row);
    if (Object.keys(data).length) {
      await update(row.id as string, data);
      n++;
    }
  }
  console.log(`${name}: ${n} rows updated`);
}

async function main() {
  // 1. Store settings (brandName, emails, socials, policies, faq/testimonial/gallery JSON)
  const settings = await db.storeSettings.findUnique({ where: { id: "singleton" } });
  if (settings) {
    const data = sweep(settings as unknown as Record<string, unknown>);
    if (Object.keys(data).length) await db.storeSettings.update({ where: { id: "singleton" }, data });
    console.log("storeSettings:", Object.keys(data).join(", ") || "no changes");
  }

  // 2. Admin account: new email, name and password
  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  for (const admin of admins) {
    await db.user.update({
      where: { id: admin.id },
      data: {
        email: "admin@lnjewellers.com",
        name: "LN Admin",
        passwordHash: await bcrypt.hash("LN@Admin1", 10),
      },
    });
    console.log(`admin rebranded: ${admin.email} -> admin@lnjewellers.com`);
  }

  // 3. Products: prose sweep + SKU prefix + slugs
  const products = await db.product.findMany();
  for (const p of products) {
    const data = sweep(p as unknown as Record<string, unknown>);
    const sku = p.sku.replace(/^AUR-/, "LN-");
    const slug = p.slug.includes("aurelia") ? p.slug.replace(/aurelia/g, "ln") : p.slug;
    if (sku !== p.sku) data.sku = sku;
    if (slug !== p.slug) data.slug = slug;
    if (Object.keys(data).length) await db.product.update({ where: { id: p.id }, data });
  }
  console.log(`products: ${products.length} processed`);

  // 4. Collections / categories / reviews / questions / coupons
  await sweepTable("collections", await db.collection.findMany() as unknown as Record<string, unknown>[],
    (id, data) => db.collection.update({ where: { id }, data }));
  await sweepTable("categories", await db.category.findMany() as unknown as Record<string, unknown>[],
    (id, data) => db.category.update({ where: { id }, data }));
  await sweepTable("reviews", await db.review.findMany() as unknown as Record<string, unknown>[],
    (id, data) => db.review.update({ where: { id }, data }));
  await sweepTable("productQuestions", await db.productQuestion.findMany() as unknown as Record<string, unknown>[],
    (id, data) => db.productQuestion.update({ where: { id }, data }));

  const coupons = await db.coupon.findMany();
  for (const c of coupons) {
    const data = sweep(c as unknown as Record<string, unknown>);
    if (Object.keys(data).length) {
      try {
        await db.coupon.update({ where: { id: c.id }, data });
      } catch {
        // unique code collision safety net
        await db.coupon.update({ where: { id: c.id }, data: { ...data, code: undefined } });
      }
    }
  }
  console.log(`coupons: ${coupons.length} processed`);

  console.log("Rebrand sweep complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
