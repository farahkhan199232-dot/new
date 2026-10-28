import { resetDemo, DEMO_POT_ID_EXPORT } from "@/lib/store";
import { json } from "@/lib/http";

/** Resets the seeded demo pot only. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await params).id !== DEMO_POT_ID_EXPORT) return json({ error: "Only the demo pot can be reset" }, 400);
  return json({ pot: await resetDemo() });
}
