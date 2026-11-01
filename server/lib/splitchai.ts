/**
 * SplitChai core: money, splitting, the group's spending rules and the
 * settle-up math. Pure functions, shared by every action, so the UI and the
 * agent always get the same answer.
 *
 * Adapted from Chai Pot (github.com/farahkhan199232-dot/new, lib/money.ts,
 * lib/policy.ts, lib/ledger.ts, MIT): integer minor units, equal split with
 * leftover cents, and the deterministic rules engine. New in this project:
 * exact/percent/shares splits, member balances from expenses + settlements,
 * greedy minimal settle-up transfers.
 */

export const CATEGORIES = [
  "food",
  "groceries",
  "transport",
  "stay",
  "activities",
  "utilities",
  "shopping",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type SplitMode = "equal" | "exact" | "percent" | "shares";
export type ExpenseStatus = "approved" | "pending_approval" | "rejected" | "void";
export type Decision = "approved" | "pending_approval" | "rejected";

export interface Rules {
  /** Bills above this need member approval (minor units). */
  perExpenseCap: number;
  /** Total approved spend per calendar day before approval is needed. */
  dailyCap: number;
  allowedCategories: Category[];
  /** Distinct member approvals needed for anything above a cap. */
  approvalsRequired: number;
}

export interface RuleCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** "2,400.50" or 2400.5 -> 240050. */
export function toMinor(input: string | number): number {
  const s = String(input).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${input}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** Equal split; leftover cents go to the first members so shares sum to the total. */
export function splitEqual(total: number, ids: string[]): Record<string, number> {
  if (ids.length === 0) throw new Error("Pick at least one person to split with");
  const base = Math.floor(total / ids.length);
  let rem = total - base * ids.length;
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
}

/** Split by weights (shares or percents); remainder cents go to the largest weights first. */
export function splitWeighted(total: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) throw new Error("Give at least one person a share above zero");
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const out: Record<string, number> = {};
  let assigned = 0;
  const fracs: Array<[string, number]> = [];
  for (const [id, w] of entries) {
    const exact = (total * w) / sum;
    out[id] = Math.floor(exact);
    assigned += out[id];
    fracs.push([id, exact - out[id]]);
  }
  fracs.sort((a, b) => b[1] - a[1]);
  for (let i = 0; assigned < total; i = (i + 1) % fracs.length) {
    const id = fracs[i]![0];
    out[id] = (out[id] ?? 0) + 1;
    assigned += 1;
  }
  return out;
}

export interface SplitInput {
  mode: SplitMode;
  /** For equal: who shares the bill. */
  participantIds?: string[];
  /** For exact (minor units), percent (0-100) or shares (any positive weight). */
  values?: Record<string, number>;
}

export function computeSplits(total: number, input: SplitInput, memberIds: string[]): Record<string, number> {
  const known = new Set(memberIds);
  const check = (ids: string[]) => {
    for (const id of ids) if (!known.has(id)) throw new Error(`Unknown member id: ${id}`);
  };
  if (input.mode === "equal") {
    const ids = input.participantIds?.length ? input.participantIds : memberIds;
    check(ids);
    return splitEqual(total, [...new Set(ids)]);
  }
  const values = input.values ?? {};
  check(Object.keys(values));
  if (input.mode === "exact") {
    const sum = Object.values(values).reduce((s, v) => s + v, 0);
    if (Object.values(values).some((v) => !Number.isInteger(v) || v < 0))
      throw new Error("Exact amounts must be whole minor units, zero or more");
    if (sum !== total) throw new Error(`Exact amounts add up to ${sum}, but the bill is ${total} (minor units)`);
    return Object.fromEntries(Object.entries(values).filter(([, v]) => v > 0));
  }
  if (input.mode === "percent") {
    const sum = Object.values(values).reduce((s, v) => s + v, 0);
    if (Math.abs(sum - 100) > 0.01) throw new Error(`Percentages add up to ${sum}, not 100`);
  }
  return splitWeighted(total, values);
}

export interface RuleContext {
  currency: string;
  /** Approved spend already on the same day (minor units). */
  spentToday: number;
}

export function evaluateRules(
  rules: Rules,
  ctx: RuleContext,
  p: { amount: number; category: string },
): { decision: Decision; checks: RuleCheck[]; reasons: string[] } {
  const fmt = (n: number) => formatMoney(n, ctx.currency);
  const checks: RuleCheck[] = [];
  const hard: string[] = [];
  const soft: string[] = [];

  const catOk = (rules.allowedCategories as string[]).includes(p.category);
  checks.push({
    name: "Category",
    ok: catOk,
    detail: catOk
      ? `${p.category} is allowed`
      : `${p.category} is not an allowed category (${rules.allowedCategories.join(", ")})`,
  });
  if (!catOk) hard.push(`category "${p.category}" is not allowed in this pot`);

  const billOk = p.amount <= rules.perExpenseCap;
  checks.push({ name: "Per-bill cap", ok: billOk, detail: `${fmt(p.amount)} vs cap ${fmt(rules.perExpenseCap)}` });
  if (!billOk) soft.push("over the per-bill cap");

  const dayOk = ctx.spentToday + p.amount <= rules.dailyCap;
  checks.push({
    name: "Daily cap",
    ok: dayOk,
    detail: `${fmt(ctx.spentToday)} already today + ${fmt(p.amount)} vs cap ${fmt(rules.dailyCap)}`,
  });
  if (!dayOk) soft.push("would go over today's cap");

  if (hard.length) return { decision: "rejected", checks, reasons: hard };
  if (soft.length)
    return {
      decision: "pending_approval",
      checks,
      reasons: [
        ...soft,
        `needs ${rules.approvalsRequired} member approval${rules.approvalsRequired === 1 ? "" : "s"}`,
      ],
    };
  return { decision: "approved", checks, reasons: ["within all of the pot's rules"] };
}

export function validateRules(r: Rules): string | null {
  if (!Number.isInteger(r.perExpenseCap) || r.perExpenseCap <= 0) return "Per-bill cap must be above zero";
  if (!Number.isInteger(r.dailyCap) || r.dailyCap <= 0) return "Daily cap must be above zero";
  if (r.dailyCap < r.perExpenseCap) return "Daily cap must be at least the per-bill cap";
  if (!r.allowedCategories.length) return "Allow at least one category";
  if (!Number.isInteger(r.approvalsRequired) || r.approvalsRequired < 1) return "At least 1 approval is needed above a cap";
  return null;
}

export interface MemberBalance {
  memberId: string;
  name: string;
  paid: number;
  share: number;
  settledOut: number;
  settledIn: number;
  /** Positive: the group owes them. Negative: they owe the group. */
  net: number;
}

export function computeBalances(
  members: Array<{ id: string; name: string }>,
  expenses: Array<{ status: string; paidBy: string; amount: number; splits: Record<string, number> }>,
  settlements: Array<{ fromMember: string; toMember: string; amount: number }>,
): MemberBalance[] {
  const rows = new Map<string, MemberBalance>();
  for (const m of members)
    rows.set(m.id, { memberId: m.id, name: m.name, paid: 0, share: 0, settledOut: 0, settledIn: 0, net: 0 });
  for (const e of expenses) {
    if (e.status !== "approved") continue;
    const payer = rows.get(e.paidBy);
    if (payer) payer.paid += e.amount;
    for (const [id, s] of Object.entries(e.splits)) {
      const r = rows.get(id);
      if (r) r.share += s;
    }
  }
  for (const s of settlements) {
    const from = rows.get(s.fromMember);
    const to = rows.get(s.toMember);
    if (from) from.settledOut += s.amount;
    if (to) to.settledIn += s.amount;
  }
  return [...rows.values()].map((r) => ({ ...r, net: r.paid - r.share + r.settledOut - r.settledIn }));
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Greedy largest-debtor-pays-largest-creditor: at most n-1 transfers that clear every balance. */
export function suggestTransfers(balances: Array<{ memberId: string; net: number }>): Transfer[] {
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.memberId, amt: -b.net }));
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.memberId, amt: b.net }));
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amt = Math.min(d.amt, c.amt);
    if (amt > 0) out.push({ from: d.id, to: c.id, amount: amt });
    d.amt -= amt;
    c.amt -= amt;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return out;
}

/** Calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function dayKey(ts: number | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
