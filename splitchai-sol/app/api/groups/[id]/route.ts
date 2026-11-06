import { bad, ok } from "@/lib/http";
import { getGroup } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await getGroup(id);
  if (!g) return bad("group not found", 404);
  return ok(g);
}
