import { db } from "@/lib/db";
import { handle, ok, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    // "today" uses IST so the dashboard matches the atelier's calendar
    const istToday = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [totalProducts, publishedProducts, orders, inquiries, subscribers, pendingReviews, paidOrders, couponAgg, couponSavingsAgg, pendingQuestions, pendingAppointments, todaysAppointments] =
      await Promise.all([
        db.product.count(),
        db.product.count({ where: { status: "PUBLISHED" } }),
        db.order.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { items: true } }),
        db.contactInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        db.newsletterSubscriber.count({ where: { active: true } }),
        db.review.count({ where: { approved: false } }),
        db.order.findMany({ where: { paymentStatus: "PAID" }, select: { total: true } }),
        db.coupon.aggregate({ where: { active: true }, _count: { _all: true }, _sum: { usageCount: true } }),
        db.order.aggregate({ where: { couponDiscount: { gt: 0 } }, _sum: { couponDiscount: true } }),
        db.productQuestion.count({ where: { approved: false } }),
        db.appointment.count({ where: { status: "PENDING" } }),
        db.appointment.count({ where: { date: istToday, status: { in: ["PENDING", "CONFIRMED"] } } }),
      ]);

    const products = await db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true, trackInventory: true },
    });

    const variantStocks = await db.productVariant.aggregate({ _sum: { stock: true } });
    const productStockSum = await db.product.aggregate({ _sum: { stock: true } });

    const lowStock = products
      .filter((p) => p.trackInventory && p.stock > 0 && p.stock <= p.lowStockThreshold)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, lowStockThreshold: p.lowStockThreshold }));
    const outOfStock = products
      .filter((p) => p.trackInventory && p.stock <= 0)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku }));

    const topSold = await db.product.findMany({
      orderBy: { salesCount: "desc" },
      take: 5,
      select: { id: true, name: true, salesCount: true },
    });

    const revenue = paidOrders.reduce((n, o) => n + o.total, 0);
    const pendingOrders = orders.filter((o) => ["PLACED", "CONFIRMED", "IN_PRODUCTION"].includes(o.status)).length;

    // ---- personalisation attach rates (cancelled orders excluded) ----
    const eligible = orders.filter((o) => o.status !== "CANCELLED");
    const engravingOrders = eligible.filter((o) => !!o.engravingText).length;
    const giftWrapOrders = eligible.filter((o) => o.giftWrap).length;
    const pct = (n: number) => (eligible.length ? Math.round((n / eligible.length) * 100) : 0);

    // ---- 14-day sales series (orders count + revenue per day) ----
    const DAY_MS = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const series: { date: string; label: string; orders: number; revenue: number }[] = [];
    const buckets = new Map<string, { orders: number; revenue: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), orders: 0, revenue: 0 });
      buckets.set(key, series[series.length - 1]);
    }
    for (const o of orders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += o.total;
      }
    }

    return ok({
      totalProducts,
      publishedProducts,
      totalInventoryUnits: (productStockSum._sum.stock ?? 0) + (variantStocks._sum.stock ?? 0),
      lowStock,
      outOfStock,
      totalOrders: orders.length,
      pendingOrders,
      revenue,
      newInquiries: await db.contactInquiry.count({ where: { status: "NEW" } }),
      subscribers,
      pendingReviews,
      activeCoupons: couponAgg._count._all,
      couponRedemptions: couponAgg._sum.usageCount ?? 0,
      couponSavings: couponSavingsAgg._sum.couponDiscount ?? 0,
      pendingQuestions,
      pendingAppointments,
      todaysAppointments,
      stockAlerts: await db.stockAlert.count({ where: { notified: false } }),
      engravingOrders,
      giftWrapOrders,
      eligibleOrders: eligible.length,
      engravingAttach: pct(engravingOrders),
      giftWrapAttach: pct(giftWrapOrders),
      salesSeries: series,
      recentOrders: orders.slice(0, 8).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        email: o.email,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        itemCount: o.items.length,
        createdAt: o.createdAt,
      })),
      recentInquiries: inquiries.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        subject: i.subject,
        status: i.status,
        createdAt: i.createdAt,
      })),
      topProducts: topSold.map((p) => ({ id: p.id, name: p.name, sold: p.salesCount })),
    });
  });
}
