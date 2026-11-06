import { DEFAULT_FEE_BPS } from "@/lib/config";
import { bad, clean, ok } from "@/lib/http";
import { newId, saveGroup } from "@/lib/store";
import type { Group } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body.name, 50);
  const you = clean(body.yourName, 30);
  if (!name || !you) return bad("group name and your name are required");
  const others: string[] = Array.isArray(body.members) ? body.members.map((m: unknown) => clean(m, 30)).filter(Boolean).slice(0, 15) : [];
  const g: Group = {
    id: newId(),
    name,
    createdAt: Date.now(),
    feeBps: body.fee === false ? 0 : DEFAULT_FEE_BPS,
    members: [you, ...others].map((n) => ({ id: newId(6), name: n })),
    expenses: [],
    settlements: [],
  };
  await saveGroup(g);
  return ok({ id: g.id, memberId: g.members[0].id });
}
