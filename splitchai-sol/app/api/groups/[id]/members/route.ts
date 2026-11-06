import { PublicKey } from "@solana/web3.js";
import { bad, clean, ok } from "@/lib/http";
import { getGroup, newId, saveGroup } from "@/lib/store";

/** Add a member by name, or link a wallet to an existing member (once). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await getGroup(id);
  if (!g) return bad("group not found", 404);
  const body = await req.json().catch(() => ({}));
  if (body.memberId) {
    const m = g.members.find((x) => x.id === body.memberId);
    if (!m) return bad("member not found", 404);
    let wallet: string;
    try {
      wallet = new PublicKey(String(body.wallet)).toBase58();
    } catch {
      return bad("invalid Solana address");
    }
    if (m.wallet && m.wallet !== wallet) return bad("this member already linked a different wallet");
    if (g.members.some((x) => x.wallet === wallet && x.id !== m.id)) return bad("wallet already linked to another member");
    m.wallet = wallet;
    await saveGroup(g);
    return ok(g);
  }
  const name = clean(body.name, 30);
  if (!name) return bad("name required");
  if (g.members.length >= 20) return bad("group is full (20)");
  if (g.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return bad("someone already has that name");
  g.members.push({ id: newId(6), name });
  await saveGroup(g);
  return ok(g);
}
