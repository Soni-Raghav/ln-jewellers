import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

/** CSV export of current inventory levels. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const products = await db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: { variants: true, category: true },
      orderBy: { sku: "asc" },
    });

    const rows: string[] = ["SKU,Name,Category,TrackInventory,Stock,LowStockThreshold,Variants"];
    for (const p of products) {
      const variantSummary = p.variants.length
        ? p.variants.map((v) => `${v.name}:${v.stock}`).join(" | ").replace(/"/g, '""')
        : "";
      rows.push(
        [
          p.sku,
          `"${p.name.replace(/"/g, '""')}"`,
          p.category.name,
          p.trackInventory ? "yes" : "no",
          String(p.stock),
          String(p.lowStockThreshold),
          `"${variantSummary}"`,
        ].join(",")
      );
    }

    await logAudit(admin.email, "INVENTORY_EXPORT", "Inventory", undefined, { count: products.length });

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
