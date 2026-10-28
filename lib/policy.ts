import type { Category, Decision, Policy, PolicyCheck, Pot } from "./types.ts";
import { formatMoney } from "./money.ts";

/**
 * Deterministic spending-policy engine. The AI agent only *interprets* a request;
 * whether money moves is decided here, by rules the members set.
 *
 *  reject          -> category not allowed, invalid payee, or not enough money in the pot
 *  needs_approval  -> over the per-bill cap or would exceed today's cap
 *  auto_pay        -> everything within limits
 */

export interface SpendProposal {
  amount: number; // minor units, pot currency
  category: Category;
  payeeEmail: string;
}

export interface PolicyContext {
  currency: string;
  /** Money currently in the pot (minor units). */
  potBalance: number;
  /** Already paid out today (minor units). */
  spentToday: number;
}

export interface PolicyResult {
  decision: Decision;
  checks: PolicyCheck[];
  reasons: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

export function evaluatePolicy(policy: Policy, ctx: PolicyContext, p: SpendProposal): PolicyResult {
  const fmt = (n: number) => formatMoney(n, ctx.currency);
  const checks: PolicyCheck[] = [];
  const hard: string[] = [];
  const soft: string[] = [];

  const amountOk = Number.isInteger(p.amount) && p.amount > 0;
  checks.push({ name: "Amount", ok: amountOk, detail: amountOk ? fmt(p.amount) : "Amount must be greater than zero" });
  if (!amountOk) hard.push("invalid amount");

  const payeeOk = isEmail(p.payeeEmail);
  checks.push({ name: "Payee", ok: payeeOk, detail: payeeOk ? p.payeeEmail : "No valid payee email" });
  if (!payeeOk) hard.push("no valid payee email");

  const catOk = policy.allowedCategories.includes(p.category);
  checks.push({
    name: "Category",
    ok: catOk,
    detail: catOk ? `${p.category} is allowed` : `${p.category} is not in allowed categories (${policy.allowedCategories.join(", ")})`,
  });
  if (!catOk) hard.push(`category "${p.category}" not allowed`);

  const fundsOk = p.amount <= ctx.potBalance;
  checks.push({
    name: "Funds",
    ok: fundsOk,
    detail: `${fmt(ctx.potBalance)} in pot${fundsOk ? "" : `, short by ${fmt(p.amount - ctx.potBalance)}`}`,
  });
  if (!fundsOk) hard.push("not enough money in the pot");

  const billOk = p.amount <= policy.perBillCap;
  checks.push({ name: "Per-bill cap", ok: billOk, detail: `${fmt(p.amount)} vs cap ${fmt(policy.perBillCap)}` });
  if (!billOk) soft.push("over the per-bill cap");

  const dayOk = ctx.spentToday + p.amount <= policy.dailyCap;
  checks.push({
    name: "Daily cap",
    ok: dayOk,
    detail: `${fmt(ctx.spentToday)} spent today + ${fmt(p.amount)} vs cap ${fmt(policy.dailyCap)}`,
  });
  if (!dayOk) soft.push("would exceed today's cap");

  if (hard.length) return { decision: "reject", checks, reasons: hard };
  if (soft.length)
    return {
      decision: "needs_approval",
      checks,
      reasons: [...soft, `needs ${policy.approvalsRequired} approval${policy.approvalsRequired === 1 ? "" : "s"}`],
    };
  return { decision: "auto_pay", checks, reasons: ["within all limits"] };
}

/** Calendar day (YYYY-MM-DD) of a timestamp in a timezone. */
export function dayKey(ts: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);
}

/** Total paid out on the same calendar day as `now` (pot timezone). */
export function spentOnDay(pot: Pick<Pot, "spends" | "timezone">, now: number): number {
  const today = dayKey(now, pot.timezone);
  return pot.spends
    .filter((s) => s.status === "paid" && dayKey(s.paidAt ?? s.createdAt, pot.timezone) === today)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function validatePolicy(p: Policy): string | null {
  if (!Number.isInteger(p.perBillCap) || p.perBillCap <= 0) return "Per-bill cap must be positive";
  if (!Number.isInteger(p.dailyCap) || p.dailyCap <= 0) return "Daily cap must be positive";
  if (p.dailyCap < p.perBillCap) return "Daily cap must be at least the per-bill cap";
  if (!p.allowedCategories.length) return "Pick at least one allowed category";
  if (!Number.isInteger(p.approvalsRequired) || p.approvalsRequired < 1) return "At least 1 approval is required above the cap";
  return null;
}
