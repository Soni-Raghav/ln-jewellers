import { handle, ok } from "@/lib/api-utils";
import { destroySession, getSession, logAudit } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    const session = await getSession();
    if (session) await logAudit(session.email, "AUTH_LOGOUT", "User", session.sub);
    await destroySession();
    return ok({ success: true });
  });
}
