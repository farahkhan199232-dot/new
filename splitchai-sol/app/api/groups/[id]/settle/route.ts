import { fetchParsedTx } from "@/lib/chain";
import { MINT, TREASURY } from "@/lib/config";
import { bad, ok } from "@/lib/http";
import { getGroup, saveGroup } from "@/lib/store";
import { extractSettlements } from "@/lib/verify";

export const maxDuration = 30;

/** Record a settlement only after reading the confirmed transaction back from Solana devnet. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const sig = String(body.signature ?? "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) return bad("invalid signature");
  const tx = await fetchParsedTx(sig);
  if (!tx) return bad("transaction not found on devnet yet, try again in a few seconds", 404);
  const g = await getGroup(id); // read after the RPC wait so we merge with the latest state
  if (!g) return bad("group not found", 404);
  const r = extractSettlements(g, sig, tx, MINT, TREASURY);
  if (!r.ok) return bad(r.error, r.error === "already recorded" ? 409 : 422);
  g.settlements.push(...r.settlements);
  await saveGroup(g);
  return ok({ group: g, recorded: r.settlements.length, fee: r.fee, slot: tx.slot, networkFeeLamports: tx.fee ?? null, blockTime: tx.blockTime ?? null });
}
