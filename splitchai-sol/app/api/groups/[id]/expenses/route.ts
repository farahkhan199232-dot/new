import { bad, clean, ok } from "@/lib/http";
import { parseUsdc } from "@/lib/money";
import { customSplit, equalSplit } from "@/lib/split";
import { getGroup, newId, saveGroup } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await getGroup(id);
  if (!g) return bad("group not found", 404);
  const body = await req.json().catch(() => ({}));
  const description = clean(body.description, 60);
  const amount = parseUsdc(String(body.amount ?? ""));
  const ids = new Set(g.members.map((m) => m.id));
  if (!description) return bad("description required");
  if (!amount || amount <= 0) return bad("enter an amount like 12.50");
  if (amount > 100_000_000_000) return bad("amount too large");
  if (!ids.has(body.paidBy)) return bad("who paid?");
  let shares: Record<string, number>;
  try {
    if (body.mode === "custom") {
      const raw: Record<string, number> = {};
      for (const [mid, v] of Object.entries(body.shares ?? {})) {
        if (!ids.has(mid)) return bad("unknown member in split");
        const p = String(v).trim() === "" ? 0 : parseUsdc(String(v));
        if (p === null) return bad("bad custom amount");
        raw[mid] = p;
      }
      shares = customSplit(amount, raw);
    } else {
      const parts: string[] = (Array.isArray(body.participants) ? body.participants : [...ids]).filter((x: string) => ids.has(x));
      shares = equalSplit(amount, parts);
    }
  } catch (e) {
    return bad((e as Error).message);
  }
  g.expenses.push({ id: newId(6), description, amount, paidBy: body.paidBy, shares, splitMode: body.mode === "custom" ? "custom" : "equal", createdAt: Date.now() });
  await saveGroup(g);
  return ok(g);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await getGroup(id);
  if (!g) return bad("group not found", 404);
  const eid = new URL(req.url).searchParams.get("eid");
  const before = g.expenses.length;
  g.expenses = g.expenses.filter((e) => e.id !== eid);
  if (g.expenses.length === before) return bad("expense not found", 404);
  await saveGroup(g);
  return ok(g);
}
