import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, notFound, toInt, toFloat, sanitize, slugify } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";

function parseTags(v: unknown): string | undefined {
  if (Array.isArray(v)) return JSON.stringify(v.map((t) => sanitize(t).slice(0, 40)).filter(Boolean).slice(0, 12));
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return JSON.stringify(arr.map((t) => sanitize(t).slice(0, 40)).filter(Boolean).slice(0, 12));
    } catch {
      /* fallthrough */
    }
  }
  return undefined;
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

function parseImages(v: unknown): string | undefined {
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
  if (!arr) return undefined;
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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const product = await db.product.findUnique({
      where: { id },
      include: { variants: true, category: true, collection: true },
    });
    if (!product) return notFound("Product not found");
    // model3dData is multi-MB base64 — never ship it through JSON responses
    const { model3dData: _drop, ...safeProduct } = product;
    void _drop;
    return ok({ product: { ...safeProduct, images: JSON.parse(product.images || "[]"), tags: JSON.parse(product.tags || "[]") } });
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return notFound("Product not found");

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = sanitize(body.name).slice(0, 140);
    if (body.sku !== undefined) {
      const sku = sanitize(body.sku).toUpperCase().slice(0, 40);
      const dup = await db.product.findFirst({ where: { sku, id: { not: id } } });
      if (dup) return badRequest("Validation failed", { sku: "SKU already exists" });
      data.sku = sku;
    }
    if (body.slug !== undefined && sanitize(body.slug)) {
      const slug = slugify(sanitize(body.slug));
      const dup = await db.product.findFirst({ where: { slug, id: { not: id } } });
      if (dup) return badRequest("Validation failed", { slug: "Slug already exists" });
      data.slug = slug;
    }
    if (body.shortDescription !== undefined) data.shortDescription = sanitize(body.shortDescription).slice(0, 200) || null;
    if (body.description !== undefined) data.description = sanitize(body.description).slice(0, 5000);
    if (body.price !== undefined) {
      const price = toFloat(body.price, NaN);
      if (!Number.isFinite(price) || price <= 0) return badRequest("Validation failed", { price: "Valid price required" });
      data.price = price;
    }
    if (body.discountPercent !== undefined) data.discountPercent = Math.min(90, Math.max(0, toFloat(body.discountPercent, 0)));
    if (body.categoryId !== undefined) data.categoryId = sanitize(body.categoryId).slice(0, 40);
    if (body.collectionId !== undefined) data.collectionId = sanitize(body.collectionId).slice(0, 40) || null;
    if (body.images !== undefined) {
      const images = parseImages(body.images);
      if (images !== undefined) data.images = images;
    }
    if (body.model3dUrl !== undefined) data.model3dUrl = sanitize(body.model3dUrl).slice(0, 600) || null;
    if (body.show3dView !== undefined) data.show3dView = !!body.show3dView;
    const incomingModel = parseModelData(body.model3dData);
    if (incomingModel && !incomingModel.ok)
      return badRequest("Validation failed", { model3dData: "The 3D file must be a .glb binary up to 2.5 MB" });
    if (incomingModel && incomingModel.ok) {
      data.model3dData = incomingModel.data;
      // the file name only makes sense when a model is actually stored
      data.model3dName =
        incomingModel.data === null ? null : sanitize(body.model3dName).slice(0, 200) || "model.glb";
    }
    if (body.material !== undefined) data.material = sanitize(body.material).slice(0, 80) || "22K Gold";
    if (body.purity !== undefined) data.purity = sanitize(body.purity).slice(0, 40) || null;
    if (body.color !== undefined) data.color = sanitize(body.color).slice(0, 40) || null;
    if (body.weightGrams !== undefined) data.weightGrams = body.weightGrams ? toFloat(body.weightGrams, 0) : null;
    if (body.dimensions !== undefined) data.dimensions = sanitize(body.dimensions).slice(0, 100) || null;
    if (body.lowStockThreshold !== undefined) data.lowStockThreshold = Math.max(0, toInt(body.lowStockThreshold, 3));
    if (body.trackInventory !== undefined) data.trackInventory = !!body.trackInventory;
    if (body.featured !== undefined) data.featured = !!body.featured;
    if (body.bestSeller !== undefined) data.bestSeller = !!body.bestSeller;
    if (body.trending !== undefined) data.trending = !!body.trending;
    if (body.handmade !== undefined) data.handmade = !!body.handmade;
    if (body.readyToShip !== undefined) data.readyToShip = !!body.readyToShip;
    if (body.craftsmanship !== undefined) data.craftsmanship = sanitize(body.craftsmanship).slice(0, 2000) || null;
    if (body.careInstructions !== undefined) data.careInstructions = sanitize(body.careInstructions).slice(0, 2000) || null;
    if (body.status !== undefined) {
      if (!["PUBLISHED", "DRAFT", "ARCHIVED"].includes(body.status)) return badRequest("Invalid status");
      data.status = body.status;
    }
    if (body.tags !== undefined) {
      const tags = parseTags(body.tags);
      if (tags !== undefined) data.tags = tags;
    }

    const product = await db.product.update({ where: { id }, data });
    await logAudit(admin.email, "PRODUCT_UPDATE", "Product", id, { fields: Object.keys(data) });

    return ok({ success: true, product });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    const { id } = await ctx.params;

    const existing = await db.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
    if (!existing) return notFound("Product not found");

    // Safe delete: products with order history are archived, never destroyed
    if (existing._count.orderItems > 0) {
      await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      await logAudit(admin.email, "PRODUCT_ARCHIVE", "Product", id, { name: existing.name, reason: "has order history" });
      return ok({ success: true, archived: true, message: "Product has order history — archived instead of deleted." });
    }

    await db.product.delete({ where: { id } });
    await logAudit(admin.email, "PRODUCT_DELETE", "Product", id, { name: existing.name });
    return ok({ success: true, deleted: true });
  });
}
