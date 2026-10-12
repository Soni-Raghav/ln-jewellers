import { ok, handle } from "@/lib/api-utils";
import { db } from "@/lib/db";

export async function GET() {
  return handle(async () => {
    await db.storeSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
    return ok({ status: "healthy", service: "aurelia-jewels-api", time: new Date().toISOString() });
  });
}
