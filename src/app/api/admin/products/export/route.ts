import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_SHEET_HEADERS } from "@/lib/product-sheet";
import * as XLSX from "xlsx";

/**
 * GET /api/admin/products/export
 * Downloads every product as .xlsx in EXACTLY the import format — edit it in
 * Excel or Google Sheets and import it back to bulk-update the catalog.
 */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const products = await db.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: { category: true, collection: true },
    });

    const rows: (string | number)[][] = products.map((p) => [
      p.sku,
      p.name,
      p.shortDescription ?? "",
      p.description,
      p.price,
      p.discountPercent,
      p.category?.name ?? "",
      p.collection?.name ?? "",
      p.material,
      p.purity ?? "",
      p.weightGrams ?? "",
      p.dimensions ?? "",
      p.stock,
      p.lowStockThreshold,
      p.trackInventory ? "yes" : "no",
      p.status,
      p.featured ? "yes" : "no",
      p.bestSeller ? "yes" : "no",
      p.trending ? "yes" : "no",
      p.handmade ? "yes" : "no",
      p.readyToShip ? "yes" : "no",
      (JSON.parse(p.images || "[]") as string[]).join(" | "),
      (JSON.parse(p.tags || "[]") as string[]).join(", "),
      p.craftsmanship ?? "",
      p.careInstructions ?? "",
      p.model3dUrl ?? "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([PRODUCT_SHEET_HEADERS, ...rows]);
    ws["!cols"] = PRODUCT_SHEET_HEADERS.map((h) => ({ wch: h === "description" ? 50 : Math.max(12, h.length + 4) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    const stamp = new Date().toISOString().slice(0, 10);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ln-products-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
