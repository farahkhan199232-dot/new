import type { Micro } from "./types";

/**
 * Split `amount` equally among `memberIds`. Leftover micro-units (from rounding)
 * go one each to the first members in the given order, so shares always sum to amount.
 */
export function equalSplit(amount: Micro, memberIds: string[]): Record<string, Micro> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive integer");
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) throw new Error("pick at least one member");
  const base = Math.floor(amount / ids.length);
  let rem = amount - base * ids.length;
  const out: Record<string, Micro> = {};
  for (const id of ids) {
    out[id] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
}

/** Validate a custom split: every share >= 0, integer, and the total equals amount. */
export function customSplit(amount: Micro, shares: Record<string, Micro>): Record<string, Micro> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive integer");
  const out: Record<string, Micro> = {};
  let sum = 0;
  for (const [id, v] of Object.entries(shares)) {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error("shares must be non-negative");
    if (v === 0) continue;
    out[id] = v;
    sum += v;
  }
  if (Object.keys(out).length === 0) throw new Error("pick at least one member");
  if (sum !== amount) throw new Error(`custom shares add up to ${sum}, expected ${amount}`);
  return out;
}
