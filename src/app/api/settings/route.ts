import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-utils";

export async function GET() {
  return handle(async () => {
    const settings = await db.storeSettings.findUnique({ where: { id: "singleton" } });
    let dto: Record<string, unknown> | null = null;
    if (settings) {
      const { faq, instagramGallery, testimonials, ...rest } = settings;
      dto = {
        ...rest,
        faq: JSON.parse(faq || "[]"),
        instagramGallery: JSON.parse(instagramGallery || "[]"),
        testimonials: JSON.parse(testimonials || "[]"),
      };
    }
    return ok({ settings: dto });
  });
}
