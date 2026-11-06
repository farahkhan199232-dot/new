import type { Group, Micro, Transfer } from "./types";

/**
 * Net balance per member: positive = the group owes them, negative = they owe.
 * Settlements move value from debtor to creditor (fees are paid on top and do not
 * change balances).
 */
export function netBalances(g: Pick<Group, "members" | "expenses" | "settlements">): Record<string, Micro> {
  const net: Record<string, Micro> = {};
  for (const m of g.members) net[m.id] = 0;
  for (const e of g.expenses) {
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    for (const [id, share] of Object.entries(e.shares)) net[id] = (net[id] ?? 0) - share;
  }
  for (const s of g.settlements) {
    net[s.from] = (net[s.from] ?? 0) + s.amount;
    net[s.to] = (net[s.to] ?? 0) - s.amount;
  }
  return net;
}

/**
 * Minimal-ish settle-up plan: repeatedly match the largest debtor with the largest
 * creditor. Produces at most n-1 transfers and never asks anyone to pay more than they owe.
 * Deterministic (ties broken by member id) so every client shows the same plan.
 */
export function settlePlan(net: Record<string, Micro>): Transfer[] {
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const sort = (a: { id: string; v: number }, b: { id: string; v: number }) => b.v - a.v || (a.id < b.id ? -1 : 1);
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort(sort);
    creditors.sort(sort);
    const d = debtors[0], c = creditors[0];
    const amt = Math.min(d.v, c.v);
    out.push({ from: d.id, to: c.id, amount: amt });
    d.v -= amt;
    c.v -= amt;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}
