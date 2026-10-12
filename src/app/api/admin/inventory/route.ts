import { db } from "@/lib/db";
import { handle, ok, badRequest, unauthorized, toInt, sanitize } from "@/lib/api-utils";
import { requireAdmin, logAudit } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/** Inventory overview: products + variant stock + optional movement history. */
export async function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const { searchParams } = new URL(req.url);
    const q = sanitize(searchParams.get("q") || "").slice(0, 80);
    const filter = searchParams.get("filter") || "all"; // all | low | out | untracked
    const page = Math.max(1, toInt(searchParams.get("page"), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get("pageSize"), 15)));
    const movementsFor = sanitize(searchParams.get("movementsFor") || "").slice(0, 40);

    const where: Prisma.ProductWhereInput = { status: { not: "ARCHIVED" } };
    if (q) where.OR = [{ name: { contains: q } }, { sku: { contains: q } }];
    if (filter === "low") where.AND = [{ trackInventory: true }, { stock: { gt: 0 } }];
    if (filter === "out") where.AND = [{ trackInventory: true }, { stock: { lte: 0 } }];
    if (filter === "untracked") where.trackInventory = false;

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: [{ stock: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { variants: true, category: true },
      }),
    ]);

    let movements: unknown[] = [];
    if (movementsFor) {
      const rows = await db.inventoryMovement.findMany({
        where: { OR: [{ productId: movementsFor }, { variant: { productId: movementsFor } }] },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { variant: true },
      });
      movements = rows.map((m) => ({
        id: m.id,
        delta: m.delta,
        reason: m.reason,
        note: m.note,
        actor: m.actor,
        createdAt: m.createdAt,
        variantName: m.variant?.name ?? null,
      }));
    }

    return ok({
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: (JSON.parse(p.images || "[]")[0] as string) ?? null,
        categoryName: p.category.name,
        stock: p.stock,
        trackInventory: p.trackInventory,
        lowStockThreshold: p.lowStockThreshold,
        variants: p.variants.map((v) => ({ id: v.id, name: v.name, stock: v.stock, active: v.active })),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      movements,
    });
  });
}

/** Stock adjustment — creates an inventory movement + audit log entry. */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const productId = sanitize(body.productId).slice(0, 40);
    const variantId = body.variantId ? sanitize(body.variantId).slice(0, 40) : null;
    const delta = toInt(body.delta, NaN);
    const reason = ["RESTOCK", "MANUAL_ADJUST", "RETURN", "CANCEL"].includes(body.reason) ? body.reason : "MANUAL_ADJUST";
    const note = sanitize(body.note).slice(0, 300);

    if (!productId) return badRequest("productId is required");
    if (!Number.isFinite(delta) || delta === 0) return badRequest("Adjustment must be a non-zero number");

    try {
      const result = await db.$transaction(async (tx) => {
        if (variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
          if (!variant || variant.productId !== productId) throw new Error("INVALID_VARIANT");
          if (variant.stock + delta < 0) throw new Error("NEGATIVE_STOCK");
          await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: delta } } });
          await tx.inventoryMovement.create({
            data: { productId, variantId, delta, reason, note: note || null, actor: admin.email },
          });
          return { stock: variant.stock + delta };
        }
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("INVALID_PRODUCT");
        if (!product.trackInventory) throw new Error("UNTRACKED");
        if (product.stock + delta < 0) throw new Error("NEGATIVE_STOCK");
        await tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } });
        await tx.inventoryMovement.create({
          data: { productId, delta, reason, note: note || null, actor: admin.email },
        });
        return { stock: product.stock + delta };
      });

      await logAudit(admin.email, "STOCK_ADJUST", "Product", productId, { variantId, delta, reason, note });
      return ok({ success: true, newStock: result.stock });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "NEGATIVE_STOCK") return badRequest("Adjustment would make stock negative");
      if (msg === "UNTRACKED") return badRequest("Inventory tracking is disabled for this product");
      if (msg === "INVALID_VARIANT") return badRequest("Invalid variant");
      if (msg === "INVALID_PRODUCT") return badRequest("Product not found");
      throw err;
    }
  });
}
