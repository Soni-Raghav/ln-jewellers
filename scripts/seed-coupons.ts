/**
 * Seeds launch coupons (idempotent). Run: bun run scripts/seed-coupons.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const coupons = [
    {
      code: "LN10",
      description: "Launch offer — 10% off orders above ₹25,000",
      type: "PERCENT",
      value: 10,
      minSubtotal: 25000,
      maxDiscount: 20000,
      usageLimit: 500,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    {
      code: "FIRSTGLINT",
      description: "Flat ₹5,000 off your first order above ₹75,000",
      type: "FLAT",
      value: 5000,
      minSubtotal: 75000,
      usageLimit: 200,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
    {
      code: "HEIRLOOM15",
      description: "15% off bridal couture orders above ₹3,00,000 (cap ₹75,000)",
      type: "PERCENT",
      value: 15,
      minSubtotal: 300000,
      maxDiscount: 75000,
      usageLimit: 50,
      expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const c of coupons) {
    await db.coupon.upsert({
      where: { code: c.code },
      create: c,
      update: { ...c },
    });
    console.log(`✓ coupon ${c.code}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
