import type { Pot } from "./types.ts";

export interface MemberLedger {
  memberId: string;
  name: string;
  contributed: number;
  refunded: number;
  spent: number;
  /** contributed - refunded - spent. Negative means the member owes the pot. */
  balance: number;
  /** How much of the per-member contribution target is still unpaid. */
  targetRemaining: number;
}

export interface Ledger {
  members: MemberLedger[];
  totals: { contributed: number; refunded: number; spent: number; pending: number; potBalance: number };
}

/** Per-member ledger. Only paid spends move money; pending/rejected/failed ones do not. */
export function computeLedger(pot: Pick<Pot, "members" | "contributions" | "refunds" | "spends" | "contributionTarget">): Ledger {
  const rows = new Map<string, MemberLedger>();
  for (const m of pot.members)
    rows.set(m.id, { memberId: m.id, name: m.name, contributed: 0, refunded: 0, spent: 0, balance: 0, targetRemaining: 0 });
  const row = (id: string) => rows.get(id);

  for (const c of pot.contributions) {
    const r = row(c.memberId);
    if (r) r.contributed += c.amount;
  }
  for (const f of pot.refunds) {
    const r = row(f.memberId);
    if (r) r.refunded += f.amount;
  }
  let pending = 0;
  for (const s of pot.spends) {
    if (s.status === "pending_approval") pending += s.amount;
    if (s.status !== "paid") continue;
    for (const [id, share] of Object.entries(s.splits)) {
      const r = row(id);
      if (r) r.spent += share;
    }
  }

  const members = [...rows.values()].map((r) => ({
    ...r,
    balance: r.contributed - r.refunded - r.spent,
    targetRemaining: Math.max(0, pot.contributionTarget - r.contributed),
  }));
  const totals = members.reduce(
    (t, r) => ({
      contributed: t.contributed + r.contributed,
      refunded: t.refunded + r.refunded,
      spent: t.spent + r.spent,
      pending,
      potBalance: t.potBalance + r.balance,
    }),
    { contributed: 0, refunded: 0, spent: 0, pending, potBalance: 0 },
  );
  return { members, totals };
}

/**
 * Most that can be refunded from one contribution: not more than is left on that
 * payment, not more than the member's unspent balance, not more than the pot holds.
 */
export function refundableAmount(pot: Pick<Pot, "members" | "contributions" | "refunds" | "spends" | "contributionTarget">, contributionId: string): number {
  const c = pot.contributions.find((x) => x.id === contributionId);
  if (!c || c.method !== "paypal") return 0;
  const already = pot.refunds.filter((r) => r.contributionId === c.id).reduce((s, r) => s + r.amount, 0);
  const ledger = computeLedger(pot);
  const me = ledger.members.find((m) => m.memberId === c.memberId);
  return Math.max(0, Math.min(c.amount - already, me?.balance ?? 0, ledger.totals.potBalance));
}
