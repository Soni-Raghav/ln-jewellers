import { db } from "@/lib/db";
import { handle, ok, unauthorized } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { resolveWaCloudConfig } from "@/lib/wa-send";

/**
 * GET /api/admin/whatsapp/status
 * Tells the admin panel whether messages deliver in one tap (Cloud API
 * connected) or fall back to opening wa.me. Never exposes the token itself.
 */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();

    const settings = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { waCloudToken: true, waCloudPhoneId: true, waAutoConfirm: true },
    });

    return ok({
      connected: !!resolveWaCloudConfig(settings),
      autoConfirm: settings?.waAutoConfirm ?? true,
    });
  });
}
