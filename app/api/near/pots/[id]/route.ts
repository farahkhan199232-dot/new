import { getVerdicts } from "@/lib/near/store";
import { getPot, getSpends } from "@/lib/near/view";

export const dynamic = "force-dynamic";

/** Pot + spends straight from the contract, plus the agent's off-chain verdict log for each spend. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 0) return Response.json({ error: "Bad pot id" }, { status: 400 });
    const [pot, spends] = await Promise.all([getPot(id), getSpends(id, 50)]);
    if (!pot) return Response.json({ error: "Pot not found" }, { status: 404 });
    const verdicts = await getVerdicts(id, spends.map((s) => s.id));
    return Response.json({ pot, spends, verdicts });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
