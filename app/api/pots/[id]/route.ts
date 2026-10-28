import { getPot } from "@/lib/store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pot = await getPot((await params).id);
  return pot ? json({ pot }) : json({ error: "Pot not found" }, 404);
}
