import { json, fail } from "@/lib/http.ts";
import { resetDemo } from "@/lib/store.ts";
import { DEMO_POT_ID } from "@/lib/seed.ts";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (id !== DEMO_POT_ID) throw new Error("Only the demo pot can be reset");
    return json({ pot: await resetDemo() });
  } catch (e) {
    return fail(e);
  }
}
