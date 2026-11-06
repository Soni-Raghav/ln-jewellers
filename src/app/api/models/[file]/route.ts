import { db } from "@/lib/db";
import { notFound } from "@/lib/api-utils";

/**
 * GET /api/models/{productId}.glb
 *
 * Streams the base64 GLB uploaded from the admin panel back as a binary model
 * file. This keeps multi-megabyte model data OUT of every product JSON
 * response — the 3D viewer fetches it on demand only when the 3D tab opens.
 */

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;

  const m = /^([a-zA-Z0-9]+)\.glb$/i.exec(file);
  if (!m) return notFound("Model not found");

  const product = await db.product.findUnique({
    where: { id: m[1] },
    select: { status: true, model3dData: true, model3dName: true },
  });

  if (!product || !product.model3dData) return notFound("Model not found");
  // Drafts stay private — only published pieces serve their model publicly.
  if (product.status !== "PUBLISHED") return notFound("Model not found");

  const buffer = Buffer.from(product.model3dData, "base64");
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x46546c67) return notFound("Model not found"); // "glTF" magic

  const filename = (product.model3dName || `${m[1]}.glb`).replace(/[^\w.\-]/g, "_");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
