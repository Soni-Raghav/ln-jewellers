import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const [products, settings, orders, admins] = await Promise.all([
    db.product.count(), db.storeSettings.count(), db.order.count(), db.user.count()
  ]);
  console.log(`POST-CLAIM CHECK → products: ${products} | settings: ${settings} | orders: ${orders} | users: ${admins}`);
} catch (e) {
  console.error("DB ERROR:", e.message?.slice(0, 300));
}
await db.$disconnect();
