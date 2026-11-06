import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, sanitize, slugify } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";
import {
  rowsFromSheetObjects,
  parseSheetBool,
  parseSheetNumber,
  parseSheetImages,
  parseSheetTags,
  googleSheetCsvUrl,
  generateSku,
} from "@/lib/product-sheet";
import * as XLSX from "xlsx";

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED"];

/**
 * POST /api/admin/products/import  (multipart/form-data)
 *   file           — .xlsx / .xls / .csv workbook in the template format
 *   sheetUrl       — OR a Google Sheets link (shared “Anyone with the link”)
 *   updateExisting — "true" → rows whose sku exists update that product
 *
 * Only `name`, `price` and `category` are required; missing categories and
 * collections are created on the fly. Every row is validated independently so
 * one bad line never blocks the rest — the response itemises each failure.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest("Expected a multipart form upload");
    }

    // ---------- Obtain the workbook ----------
    let rowsRaw: Record<string, unknown>[] = [];
    const file = form.get("file");
    const sheetUrl = sanitize(form.get("sheetUrl")).slice(0, 500);

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return badRequest("The file is larger than 5 MB — split the list or trim unused columns.");
      const buf = Buffer.from(await file.arrayBuffer());
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(buf, { type: "buffer" });
      } catch {
        return badRequest("Could not read the file — is it a valid Excel or CSV file?");
      }
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("product")) ?? wb.SheetNames[0];
      rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
    } else if (sheetUrl) {
      const csvUrl = googleSheetCsvUrl(sheetUrl);
      if (!csvUrl) {
        return badRequest("That doesn't look like a Google Sheets link — paste the URL from your browser's address bar (docs.google.com/spreadsheets/…).");
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(csvUrl, { signal: controller.signal, redirect: "follow" });
        if (!res.ok) {
          return badRequest(`Google refused the download (${res.status}). Make sure the sheet is shared as “Anyone with the link – Viewer”.`);
        }
        const csv = await res.text();
        if (/^\s*<(!doctype|html)/i.test(csv)) {
          return badRequest("Google returned a sign-in page — share the sheet as “Anyone with the link – Viewer” and try again.");
        }
        const wb = XLSX.read(csv, { type: "string" });
        rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      } catch (e) {
        const reason = e instanceof Error && e.name === "AbortError" ? "Timed out reaching Google Sheets." : "Could not download the sheet.";
        return badRequest(reason);
      } finally {
        clearTimeout(timer);
      }
    } else {
      return badRequest("Attach an Excel/CSV file or paste a Google Sheets link");
    }

    const rows = rowsFromSheetObjects(rowsRaw).slice(0, MAX_ROWS);
    if (rows.length === 0) return badRequest("No data rows found — keep row 1 as the column names and put products underneath.");

    const updateExisting = sanitize(form.get("updateExisting")) === "true";

    // ---------- Pre-load lookup caches ----------
    const [categories, collections, existingProducts] = await Promise.all([
      db.category.findMany({ select: { id: true, name: true, slug: true } }),
      db.collection.findMany({ select: { id: true, name: true, slug: true } }),
      db.product.findMany({ select: { id: true, sku: true, slug: true, stock: true }, take: 5000 }),
    ]);

    const catByName = new Map<string, { id: string; name: string; slug: string }>();
    for (const c of categories) {
      catByName.set(c.name.toLowerCase(), c);
      catByName.set(c.slug.toLowerCase(), c);
    }
    const colByName = new Map<string, { id: string; name: string; slug: string }>();
    for (const c of collections) {
      colByName.set(c.name.toLowerCase(), c);
      colByName.set(c.slug.toLowerCase(), c);
    }
    const productBySku = new Map(existingProducts.map((p) => [p.sku, p]));
    const takenSkus = new Set(existingProducts.map((p) => p.sku));
    const takenSlugs = new Set(existingProducts.map((p) => p.slug));

    async function resolveCategory(name: string): Promise<{ id: string } | null> {
      const key = name.toLowerCase();
      const hit = catByName.get(key);
      if (hit) return hit;
      const slug = slugify(name);
      if (!slug) return null;
      let unique = slug;
      let i = 2;
      while (await db.category.findUnique({ where: { slug: unique } })) unique = `${slug}-${i++}`;
      const created = await db.category.create({ data: { name: name.slice(0, 80), slug: unique } });
      catByName.set(key, created);
      return created;
    }

    async function resolveCollection(name: string): Promise<{ id: string } | null> {
      const key = name.toLowerCase();
      const hit = colByName.get(key);
      if (hit) return hit;
      const slug = slugify(name);
      if (!slug) return null;
      let unique = slug;
      let i = 2;
      while (await db.collection.findUnique({ where: { slug: unique } })) unique = `${slug}-${i++}`;
      const created = await db.collection.create({ data: { name: name.slice(0, 80), slug: unique } });
      colByName.set(key, created);
      return created;
    }

    // ---------- Row-by-row import ----------
    const errors: { row: number; name: string; message: string }[] = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 2; // +1 header, +1 human numbering
      const name = sanitize(row.name).slice(0, 140);
      const price = parseSheetNumber(row.price);
      const categoryName = sanitize(row.category).slice(0, 80);
      const skuRaw = sanitize(row.sku).toUpperCase().slice(0, 40);

      const fail = (message: string) => {
        if (errors.length < 50) errors.push({ row: rowNo, name: name || skuRaw || "(untitled)", message });
      };

      if (!name) { fail("Name is empty"); continue; }
      if (price === null || price <= 0) { fail(`Price "${row.price || "—"}" is not a valid amount`); continue; }
      if (!categoryName) { fail("Category is empty"); continue; }
      const category = await resolveCategory(categoryName);
      if (!category) { fail(`Could not use category "${categoryName}"`); continue; }

      let collectionId: string | null = null;
      const collectionName = sanitize(row.collection).slice(0, 80);
      if (collectionName) {
        const col = await resolveCollection(collectionName);
        if (col) collectionId = col.id;
      }

      const existing = skuRaw ? productBySku.get(skuRaw) : undefined;

      if (existing && !updateExisting) {
        fail(`SKU ${skuRaw} already exists — tick “Update pieces whose SKU exists” to refresh it`);
        continue;
      }

      // Optional numbers / booleans (undefined = cell empty → leave default)
      const discount = parseSheetNumber(row.discountPercent);
      const stock = parseSheetNumber(row.stock);
      const lowThreshold = parseSheetNumber(row.lowStockThreshold);
      const weight = parseSheetNumber(row.weightGrams);
      const images = parseSheetImages(row.images);
      const tags = parseSheetTags(row.tags);
      const statusRaw = sanitize(row.status).toUpperCase().slice(0, 20);

      if (existing) {
        // ---- UPDATE: only overwrite cells the row actually provides ----
        const patch: Record<string, unknown> = {};
        if (name) patch.name = name;
        if (sanitize(row.shortDescription)) patch.shortDescription = sanitize(row.shortDescription).slice(0, 200);
        if (sanitize(row.description)) patch.description = sanitize(row.description).slice(0, 5000);
        patch.price = Math.round(price * 100) / 100;
        if (discount !== null) patch.discountPercent = Math.min(90, Math.max(0, discount));
        patch.categoryId = category.id;
        patch.collectionId = collectionId;
        if (sanitize(row.material)) patch.material = sanitize(row.material).slice(0, 80);
        if (sanitize(row.purity)) patch.purity = sanitize(row.purity).slice(0, 40);
        if (weight !== null && weight > 0) patch.weightGrams = weight;
        if (sanitize(row.dimensions)) patch.dimensions = sanitize(row.dimensions).slice(0, 100);
        if (lowThreshold !== null) patch.lowStockThreshold = Math.max(0, Math.round(lowThreshold));
        const track = parseSheetBool(row.trackInventory);
        if (track !== undefined) patch.trackInventory = track;
        if (STATUSES.includes(statusRaw)) patch.status = statusRaw;
        const flags: [string, string][] = [
          ["featured", "featured"],
          ["bestSeller", "bestSeller"],
          ["trending", "trending"],
          ["handmade", "handmade"],
          ["readyToShip", "readyToShip"],
        ];
        for (const [field, cell] of flags) {
          const b = parseSheetBool(row[cell]);
          if (b !== undefined) patch[field] = b;
        }
        if (images.length) patch.images = JSON.stringify(images);
        if (tags.length) patch.tags = JSON.stringify(tags);
        if (sanitize(row.craftsmanship)) patch.craftsmanship = sanitize(row.craftsmanship).slice(0, 2000);
        if (sanitize(row.careInstructions)) patch.careInstructions = sanitize(row.careInstructions).slice(0, 2000);
        if (sanitize(row.model3dUrl)) patch.model3dUrl = sanitize(row.model3dUrl).slice(0, 600);

        // Stock: a provided number that differs moves inventory with an audit trail
        if (stock !== null) {
          const nextStock = Math.max(0, Math.round(stock));
          if (nextStock !== existing.stock) {
            patch.stock = nextStock;
            await db.inventoryMovement.create({
              data: {
                productId: existing.id,
                delta: nextStock - existing.stock,
                reason: "MANUAL_ADJUST",
                note: `Sheet import — row ${rowNo}`,
                actor: admin.email,
              },
            });
          }
        }

        await db.product.update({ where: { id: existing.id }, data: patch });
        updated++;
      } else {
        // ---- CREATE ----
        const sku = skuRaw && !takenSkus.has(skuRaw) ? skuRaw : generateSku(name, takenSkus);
        takenSkus.add(sku);

        let slug = slugify(sanitize(row.slug) || name) || `piece-${Date.now()}`;
        while (takenSlugs.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
        takenSlugs.add(slug);

        const finalStock = stock !== null ? Math.max(0, Math.round(stock)) : 0;
        const description = sanitize(row.description).slice(0, 5000) || sanitize(row.shortDescription).slice(0, 200) || name;

        const product = await db.product.create({
          data: {
            sku,
            slug,
            name,
            shortDescription: sanitize(row.shortDescription).slice(0, 200) || null,
            description,
            price: Math.round(price * 100) / 100,
            discountPercent: discount !== null ? Math.min(90, Math.max(0, discount)) : 0,
            categoryId: category.id,
            collectionId,
            images: JSON.stringify(images),
            model3dUrl: sanitize(row.model3dUrl).slice(0, 600) || null,
            show3dView: false,
            material: sanitize(row.material).slice(0, 80) || "22K Gold",
            purity: sanitize(row.purity).slice(0, 40) || null,
            weightGrams: weight !== null && weight > 0 ? weight : null,
            dimensions: sanitize(row.dimensions).slice(0, 100) || null,
            stock: finalStock,
            lowStockThreshold: lowThreshold !== null ? Math.max(0, Math.round(lowThreshold)) : 3,
            trackInventory: parseSheetBool(row.trackInventory) ?? true,
            featured: parseSheetBool(row.featured) ?? false,
            bestSeller: parseSheetBool(row.bestSeller) ?? false,
            trending: parseSheetBool(row.trending) ?? false,
            handmade: parseSheetBool(row.handmade) ?? false,
            readyToShip: parseSheetBool(row.readyToShip) ?? true,
            craftsmanship: sanitize(row.craftsmanship).slice(0, 2000) || null,
            careInstructions: sanitize(row.careInstructions).slice(0, 2000) || null,
            status: STATUSES.includes(statusRaw) ? statusRaw : "PUBLISHED",
            tags: JSON.stringify(tags),
          },
        });

        if (finalStock > 0) {
          await db.inventoryMovement.create({
            data: { productId: product.id, delta: finalStock, reason: "INIT", note: `Sheet import — row ${rowNo}`, actor: admin.email },
          });
        }
        created++;
      }
    }

    await logAudit(admin.email, "PRODUCT_IMPORT", "Product", null, { created, updated, failed: errors.length, total: rows.length, updateExisting });

    return ok({
      success: true,
      total: rows.length,
      created,
      updated,
      failed: errors.length,
      truncated: rowsRaw.length > MAX_ROWS ? rowsRaw.length - MAX_ROWS : 0,
      errors,
    });
  });
}
