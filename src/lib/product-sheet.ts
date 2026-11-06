import { sanitize, toAsciiDigits } from "@/lib/api-utils";

/**
 * Product sheet format (round 15) — one shared definition powers the
 * downloadable Excel template, the catalog export and the importer, so the
 * file an admin exports is always a valid file to re-import.
 *
 * Rules kept intentionally shop-owner friendly:
 *  - only `name`, `price` and `category` are mandatory — everything else has
 *    sensible defaults
 *  - numbers accept ₹, commas and unicode digits (₹ 12,500 · ३५ both work)
 *  - yes/no columns accept yes/no, y/n, true/false, 1/0, ✓
 *  - `images` are separated by `|`, `tags` by commas
 */

export interface SheetColumn {
  header: string;
  required?: boolean;
  example: string;
  doc: string;
}

export const PRODUCT_SHEET_COLUMNS: SheetColumn[] = [
  { header: "sku", example: "LN-RING-001", doc: "Unique code. Leave empty to auto-generate. To UPDATE an existing piece, repeat its sku." },
  { header: "name", required: true, example: "Heritage Signet Ring", doc: "Product name shown on the storefront." },
  { header: "shortDescription", example: "Hand-engraved 22K signet", doc: "One-liner under the title (max 200 chars)." },
  { header: "description", example: "Cast, filed and engraved by hand…", doc: "Full story. Defaults to the short description if empty." },
  { header: "price", required: true, example: "₹ 24,999", doc: "Selling price in INR. ₹ and commas are fine." },
  { header: "discountPercent", example: "10", doc: "0–90. The storefront shows the struck-through MRP." },
  { header: "category", required: true, example: "Rings", doc: "Must match a category name. New names are created automatically." },
  { header: "collection", example: "Wedding", doc: "Optional collection name; created when missing." },
  { header: "material", example: "22K Gold", doc: "Defaults to “22K Gold”." },
  { header: "purity", example: "916", doc: "BIS hallmark mark, e.g. 916 / 750." },
  { header: "weightGrams", example: "5.6", doc: "Metal weight in grams." },
  { header: "dimensions", example: "Size 9 · 14 mm face", doc: "Free-text size/measure line." },
  { header: "stock", example: "5", doc: "Pieces in stock. 0 = made to order when trackInventory is no." },
  { header: "lowStockThreshold", example: "3", doc: "“Only N left” badge appears at or below this. Defaults to 3." },
  { header: "trackInventory", example: "yes", doc: "yes/no — count stock down on every order?" },
  { header: "status", example: "PUBLISHED", doc: "PUBLISHED, DRAFT or ARCHIVED. Defaults to PUBLISHED." },
  { header: "featured", example: "no", doc: "yes/no — homepage Featured row." },
  { header: "bestSeller", example: "yes", doc: "yes/no — homepage Best sellers row." },
  { header: "trending", example: "no", doc: "yes/no — homepage Trending row." },
  { header: "handmade", example: "yes", doc: "yes/no — Handmade collection row." },
  { header: "readyToShip", example: "yes", doc: "yes/no — dispatch-time promise chip." },
  { header: "images", example: "https://…/ring.png | /images/products/ring-heritage.png", doc: "Up to 8 image URLs separated by | (full URLs or site paths). First one is the cover." },
  { header: "tags", example: "signet, everyday, men", doc: "Comma-separated search tags (max 12)." },
  { header: "craftsmanship", example: "Hand-engraved by master karigars", doc: "Short craft note on the product page." },
  { header: "careInstructions", example: "Polish with the gold cloth provided", doc: "Care line on the product page." },
  { header: "model3dUrl", example: "https://…/ring.glb", doc: "Optional .glb URL to enable the 3D view tab." },
];

export const PRODUCT_SHEET_HEADERS: string[] = PRODUCT_SHEET_COLUMNS.map((c) => c.header);

/** Normalise a header cell: lowercase, strip spaces/underscores. */
function normHeader(h: string): string {
  return toAsciiDigits(String(h ?? "")).toLowerCase().replace(/[\s_-]+/g, "");
}

/** Map raw sheet rows (header: value) onto clean string records keyed by our headers. */
export function rowsFromSheetObjects(rawRows: Record<string, unknown>[]): Record<string, string>[] {
  const alias: Record<string, string> = {
    // forgiving aliases people write in real life
    productname: "name",
    title: "name",
    mrp: "price",
    amount: "price",
    rate: "price",
    discountrate: "discountPercent",
    discount: "discountPercent",
    cat: "category",
    categoryname: "category",
    qty: "stock",
    quantity: "stock",
    weight: "weightGrams",
    gram: "weightGrams",
    image: "images",
    imageurl: "images",
    photourl: "images",
    photo: "images",
    tag: "tags",
    model3d: "model3dUrl",
    glburl: "model3dUrl",
  };
  const out: Record<string, string>[] = [];
  for (const raw of rawRows) {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = alias[normHeader(k)] ?? normHeader(k);
      if (!(key in row) || String(row[key]).trim() === "") {
        row[key] = v === null || v === undefined ? "" : String(v);
      }
    }
    out.push(row);
  }
  return out;
}

/** Parse "yes/no-ish" cells. undefined = cell empty (leave defaults untouched). */
export function parseSheetBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = toAsciiDigits(v).trim().toLowerCase();
  if (!s) return undefined;
  if (["yes", "y", "true", "1", "✓", "✔"].includes(s)) return true;
  if (["no", "n", "false", "0", "✗", "x"].includes(s)) return false;
  return undefined;
}

/** Parse a positive price-like number: strips ₹, commas, spaces, unicode digits. */
export function parseSheetNumber(v: string | undefined): number | null {
  if (v === undefined) return null;
  const cleaned = toAsciiDigits(v).replace(/[₹$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Split the images cell into up to 8 candidate URLs. */
export function parseSheetImages(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[|\n;]+/)
    .map((s) => sanitize(s))
    .filter(Boolean)
    .slice(0, 8);
}

/** Split the tags cell. */
export function parseSheetTags(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[,;\n]+/)
    .map((s) => sanitize(s).slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);
}

/** Turn a Google Sheets share/edit link into its CSV export endpoint. */
export function googleSheetCsvUrl(raw: string): string | null {
  const url = raw.trim();
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gm = url.match(/[#&?]gid=(\d+)/);
  const gid = gm ? gm[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** Generate a unique SKU from a product name: LN-RING-7K3 style. */
export function generateSku(name: string, taken: Set<string>): string {
  const base =
    "LN-" +
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 18) +
    "-";
  let sku = "";
  do {
    sku = base + Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (taken.has(sku));
  taken.add(sku);
  return sku;
}
