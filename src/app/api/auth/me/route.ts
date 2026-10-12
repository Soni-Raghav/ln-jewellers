import { handle, ok, unauthorized } from "@/lib/api-utils";
import { getSession } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();
    return ok({ user: { id: session.sub, email: session.email, name: session.name, role: session.role } });
  });
}
