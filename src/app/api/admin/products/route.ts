import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, toInt, toFloat, sanitize, slugify, isNonEmpty } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

function parseTags(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v.map((t) => sanitize(t).slice(0, 40)).filter(Boolean).slice(0, 12));
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return JSON.stringify(arr.map((t) => sanitize(t).slice(0, 40)).filter(Boolean).slice(0, 12));
    } catch {
      /* fallthrough */
    }
  }
  return "[]";
}

// Images may be http(s) urls OR base64 data urls (uploads from the admin panel).
const MAX_IMAGE_CHARS = 2_800_000; // ≈2 MB binary per image after base64

function acceptImage(item: unknown): string | null {
  const s = sanitize(item);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s.slice(0, 1000);
  // site-relative asset paths (e.g. /images/products/ring.png) are first-class citizens
  if (s.startsWith("/") && !s.startsWith("//") && s.length <= 1000) return s;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s) && s.length <= MAX_IMAGE_CHARS)
    return s.replace(/\s/g, "");
  return null;
}

function parseImages(v: unknown): string {
  let arr: unknown[] | null = null;
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      /* fallthrough */
    }
  }
  if (!arr) return "[]";
  const out: string[] = [];
  for (const item of arr.slice(0, 8)) {
    const accepted = acceptImage(item);
    if (accepted) out.push(accepted);
  }
  return JSON.stringify(out);
}

/**
 * Uploaded 3D models arrive as raw base64 (optionally with a data: prefix).
 * The buffer must decode to a real GLB — it has to start with the "glTF" magic.
 * Returns undefined = field absent; null = remove; string = valid base64.
 */
const MAX_MODEL_B64 = 3_600_000; // ≈2.6 MB binary — keeps the whole request under Vercel's 4.5 MB cap

function parseModelData(v: unknown): { ok: true; data: string | null } | { ok: false } | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return { ok: true, data: null };
  if (typeof v !== "string") return { ok: false };
  const clean = v.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(clean) || clean.length > MAX_MODEL_B64) return { ok: false };
  let buf: Buffer;
  try {
    buf = Buffer.from(clean, "base64");
  } catch {
    return { ok: false };
  }
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67) return { ok: false }; // "glTF" magic
  return { ok: true, data: clean };
}

export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { searchParams } = new URL(req.url);
    const q = sanitize(searchParams.get("q") || "").slice(0, 80);
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const page = Math.max(1, toInt(searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get("pageSize"), 12)));

    const where: Prisma.ProductWhereInput = {};
    if (status && ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(status)) where.status = status;
    if (category) where.categoryId = category;
    if (q) where.OR = [{ name: { contains: q } }, { sku: { contains: q } }];

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, collection: true, variants: true },
      }),
    ]);

    return ok({
      items: products.map((p) => ({
        // model3dData is multi-MB base64 — never ship it through the list payload
        ...p,
        model3dData: undefined,
        images: JSON.parse(p.images || "[]"),
        tags: JSON.parse(p.tags || "[]"),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const name = sanitize(body.name).slice(0, 140);
    const sku = sanitize(body.sku).toUpperCase().slice(0, 40);
    const price = toFloat(body.price, NaN);
    const categoryId = sanitize(body.categoryId).slice(0, 40);

    const fields: Record<string, string> = {};
    if (!isNonEmpty(name, 140)) fields.name = "Product name is required";
    if (!isNonEmpty(sku, 40)) fields.sku = "SKU is required";
    if (!Number.isFinite(price) || price <= 0) fields.price = "Valid price is required";
    if (!categoryId) fields.categoryId = "Category is required";
    if (Object.keys(fields).length) return badRequest("Validation failed", fields);

    const dupSku = await db.product.findUnique({ where: { sku } });
    if (dupSku) return badRequest("Validation failed", { sku: "SKU already exists" });

    let slug = slugify(sanitize(body.slug) || name);
    const dupSlug = await db.product.findUnique({ where: { slug } });
    if (dupSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const incomingModel = parseModelData(body.model3dData);
    if (incomingModel && !incomingModel.ok)
      return badRequest("Validation failed", { model3dData: "The 3D file must be a .glb binary up to 2.5 MB" });

    const stock = Math.max(0, toInt(body.stock, 0));
    const product = await db.product.create({
      data: {
        name,
        sku,
        slug,
        shortDescription: sanitize(body.shortDescription).slice(0, 200) || null,
        description: sanitize(body.description).slice(0, 5000) || name,
        price,
        discountPercent: Math.min(90, Math.max(0, toFloat(body.discountPercent, 0))),
        categoryId,
        collectionId: sanitize(body.collectionId).slice(0, 40) || null,
        images: parseImages(body.images),
        model3dUrl: sanitize(body.model3dUrl).slice(0, 600) || null,
        show3dView: !!body.show3dView,
        model3dData: incomingModel && incomingModel.ok ? incomingModel.data : null,
        model3dName:
          incomingModel && incomingModel.ok && incomingModel.data
            ? sanitize(body.model3dName).slice(0, 200) || "model.glb"
            : null,
        material: sanitize(body.material).slice(0, 80) || "22K Gold",
        purity: sanitize(body.purity).slice(0, 40) || null,
        color: sanitize(body.color).slice(0, 40) || null,
        weightGrams: body.weightGrams ? toFloat(body.weightGrams, 0) : null,
        dimensions: sanitize(body.dimensions).slice(0, 100) || null,
        stock,
        lowStockThreshold: Math.max(0, toInt(body.lowStockThreshold, 3)),
        trackInventory: body.trackInventory !== false,
        featured: !!body.featured,
        bestSeller: !!body.bestSeller,
        trending: !!body.trending,
        handmade: !!body.handmade,
        readyToShip: body.readyToShip !== false,
        craftsmanship: sanitize(body.craftsmanship).slice(0, 2000) || null,
        careInstructions: sanitize(body.careInstructions).slice(0, 2000) || null,
        status: ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(body.status) ? body.status : "DRAFT",
        tags: parseTags(body.tags),
      },
    });

    if (stock > 0) {
      await db.inventoryMovement.create({
        data: { productId: product.id, delta: stock, reason: "INIT", note: "Initial stock on creation", actor: admin.email },
      });
    }

    // Optional variants (create-time only; stock changes afterwards go through Inventory)
    type IncomingVariant = { name?: unknown; size?: unknown; color?: unknown; priceDelta?: unknown; stock?: unknown };
    const rawVariants = Array.isArray(body.variants) ? (body.variants as IncomingVariant[]).slice(0, 12) : [];
    for (const rv of rawVariants) {
      const vName = sanitize(rv.name).slice(0, 60);
      if (!vName) continue;
      const vStock = Math.max(0, toInt(rv.stock, 0));
      await db.productVariant.create({
        data: {
          productId: product.id,
          name: vName,
          size: sanitize(rv.size).slice(0, 20) || null,
          color: sanitize(rv.color).slice(0, 20) || null,
          priceDelta: Math.max(0, toFloat(rv.priceDelta, 0)),
          stock: vStock,
        },
      });
      if (vStock > 0) {
        await db.inventoryMovement.create({
          data: { productId: product.id, delta: vStock, reason: "INIT", note: `Variant "${vName}" opening stock`, actor: admin.email },
        });
      }
    }

    await logAudit(admin.email, "PRODUCT_CREATE", "Product", product.id, { name, sku });

    const created = await db.product.findUnique({ where: { id: product.id }, include: { variants: true } });
    return ok({ success: true, product: created });
  });
}
