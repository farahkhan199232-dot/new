import { NextResponse } from "next/server";
import type { Group, Member, Role } from "@/lib/shg.ts";
import { newId, saveGroup, thisMonth } from "@/lib/store.ts";

export const dynamic = "force-dynamic";

/** Create a new SHG pot. Members are typed in by the leader; no phone numbers or IDs are stored. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const names: { name: string; nameHi?: string; role?: Role }[] = Array.isArray(b.members) ? b.members : [];
  const clean = names.map((m) => ({ ...m, name: String(m.name || "").trim().slice(0, 40) })).filter((m) => m.name);
  if (!String(b.name || "").trim() || clean.length < 3 || clean.length > 30)
    return NextResponse.json({ error: "Give the group a name and 3 to 30 members." }, { status: 400 });
  const month = thisMonth();
  const members: Member[] = clean.map((m, i) => ({
    id: "m" + (i + 1), name: m.name, nameHi: String(m.nameHi || m.name).slice(0, 40),
    role: i === 0 ? "leader" : i === 1 ? "treasurer" : "member", joined: month,
  }));
  const num = (v: unknown, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 100) / 100 : d; };
  const r = b.rules || {};
  const g: Group = {
    id: newId(5), name: String(b.name).trim().slice(0, 60), village: String(b.village || "").trim().slice(0, 60),
    rules: {
      monthlySaving: num(r.monthlySaving, 100, 10, 10000), interestPctPerMonth: num(r.interestPctPerMonth, 1, 0, 5),
      maxLoanMultiple: num(r.maxLoanMultiple, 3, 1, 10), maxLoanPctOfCash: num(r.maxLoanPctOfCash, 50, 5, 100),
      minMonthsMember: num(r.minMonthsMember, 6, 0, 36), maxTenureMonths: num(r.maxTenureMonths, 12, 1, 36), approvalsNeeded: 2,
    },
    members, events: [],
  };
  await saveGroup(g);
  return NextResponse.json({ id: g.id });
}
