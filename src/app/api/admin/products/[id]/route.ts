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

function parseImages(v: unknown): string | undefined {
  if (Array.isArray(v)) return JSON.stringify(v.map((s) => sanitize(s).slice(0, 300)).filter(Boolean).slice(0, 8));
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return JSON.stringify(arr.map((s) => sanitize(s).slice(0, 300)).filter(Boolean).slice(0, 8));
    } catch {
      /* fallthrough */
    }
  }
  return undefined;
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
    return ok({ product: { ...product, images: JSON.parse(product.images || "[]"), tags: JSON.parse(product.tags || "[]") } });
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
    if (body.model3dUrl !== undefined) data.model3dUrl = sanitize(body.model3dUrl).slice(0, 300) || null;
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
