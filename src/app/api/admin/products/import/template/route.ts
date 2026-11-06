import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_SHEET_COLUMNS } from "@/lib/product-sheet";
import * as XLSX from "xlsx";

/**
 * GET /api/admin/products/import/template
 * Downloads the product-import template (.xlsx) with a "How to fill" sheet
 * that documents every column and lists the store's current categories.
 */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    // Header row + two worked examples the owner can overwrite.
    const headerRow = PRODUCT_SHEET_COLUMNS.map((c) => c.header);
    const exampleRows = [
      PRODUCT_SHEET_COLUMNS.map((c) => {
        if (c.header === "name") return "Heritage Signet Ring";
        if (c.header === "price") return "₹ 24,999";
        if (c.header === "category") return "Rings";
        if (c.header === "images") return "/images/products/ring-heritage.png | /images/products/ring-minimal.png";
        if (c.header === "tags") return "signet, everyday, men";
        if (c.header === "stock") return "5";
        if (c.header === "discountPercent") return "10";
        return c.example;
      }),
      PRODUCT_SHEET_COLUMNS.map((c) => {
        if (c.header === "name") return "Jhumka Grace Earrings";
        if (c.header === "sku") return ""; // blank sku shows auto-generation
        if (c.header === "price") return "36500";
        if (c.header === "category") return "Earrings";
        if (c.header === "status") return "DRAFT";
        if (c.header === "featured") return "yes";
        return "";
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...exampleRows]);
    ws["!cols"] = PRODUCT_SHEET_COLUMNS.map((c) => ({ wch: Math.min(42, Math.max(c.header.length + 4, c.example.length + 4)) }));

    // Documentation sheet
    const categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { name: true } });
    const docRows: (string | number)[][] = [
      ["LN Jewellers — product import format", ""],
      ["", ""],
      ["Getting started", ""],
      ["1", "Fill the Products sheet — one product per row, keep row 1 (the column names) exactly as it is."],
      ["2", "Works in Excel, Google Sheets or as CSV — download this file, edit, and import it back."],
      ["3", "Only Name, Price and Category are required. Everything else is optional and has defaults."],
      ["4", "To UPDATE an existing piece, repeat its exact sku (Admin → Products shows every sku). Rows without a sku always create new products."],
      ["", ""],
      ["Column guide", ""],
      ["Column", "What to enter"],
      ...PRODUCT_SHEET_COLUMNS.map((c) => [c.header + (c.required ? " *" : ""), c.doc]),
      ["", ""],
      ["Current categories", "Importing a different name creates the category automatically"],
      ...categories.map((c) => [c.name, ""]),
      ["", ""],
      ["Google Sheets", "File → Share → “Anyone with the link” (Viewer), then paste that link in Admin → Products → Import."],
    ];
    const docWs = XLSX.utils.aoa_to_sheet(docRows);
    docWs["!cols"] = [{ wch: 28 }, { wch: 110 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.utils.book_append_sheet(wb, docWs, "How to fill");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ln-products-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  });
}
