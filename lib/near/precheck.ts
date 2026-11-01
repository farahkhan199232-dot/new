import type { NearPot, NearSpend } from "./types";

/**
 * Mirrors the contract's hard checks (chaipot/near/contract/src/lib.rs `hard_check`) so the UI can
 * say what will happen before a member signs. The contract is the source of truth.
 */
export type Precheck = { outcome: "auto_pay" | "needs_votes" | "reject"; why: string };

const NS_PER_DAY = 86_400_000_000_000n;

export function spentToday(pot: NearPot, nowMs = Date.now()): bigint {
  const today = (BigInt(nowMs) * 1_000_000n) / NS_PER_DAY;
  return BigInt(pot.day) === today ? BigInt(pot.spent_today) : 0n;
}

export function precheck(pot: NearPot, s: Pick<NearSpend, "amount" | "category">, nowMs = Date.now()): Precheck {
  const amount = BigInt(s.amount);
  if (!pot.categories.includes(s.category.toLowerCase())) return { outcome: "reject", why: `category '${s.category}' is not allowed` };
  if (amount > BigInt(pot.balance)) return { outcome: "reject", why: "not enough money in the pot" };
  if (amount > BigInt(pot.per_spend_cap)) return { outcome: "needs_votes", why: "above the per-spend cap" };
  if (spentToday(pot, nowMs) + amount > BigInt(pot.daily_cap)) return { outcome: "needs_votes", why: "would pass today's cap" };
  return { outcome: "auto_pay", why: "inside every limit" };
}

/** Unspent share a member could withdraw (deposits - withdrawals - equal share of paid bills). */
export function available(pot: NearPot, account: string): bigint {
  const c = pot.contributions.find((x) => x.account === account);
  if (!c) return 0n;
  const share = BigInt(pot.spent_total) / BigInt(pot.members.length);
  const v = BigInt(c.deposited) - BigInt(c.withdrawn) - share;
  const bal = BigInt(pot.balance);
  return v < 0n ? 0n : v > bal ? bal : v;
}
