import { test } from "node:test";
import assert from "node:assert/strict";
import { available, precheck } from "./precheck.ts";
import type { NearPot } from "./types.ts";

const ONE = 10n ** 24n;
const now = 1_800_000_000_000; // ms
const day = String((BigInt(now) * 1_000_000n) / 86_400_000_000_000n);

const pot = (o: Partial<NearPot> = {}): NearPot => ({
  id: 0, name: "Goa", creator: "a.testnet", members: ["a.testnet", "b.testnet", "c.testnet"], agent: "agent.testnet",
  per_spend_cap: String(2n * ONE), daily_cap: String(3n * ONE), approvals_needed: 1, categories: ["food", "transport"],
  balance: String(9n * ONE), spent_total: "0", spent_today: "0", day, spend_count: 0, created_at: "0",
  contributions: ["a", "b", "c"].map((x) => ({ account: `${x}.testnet`, deposited: String(3n * ONE), withdrawn: "0" })),
  ...o,
});

test("inside caps auto-pays", () => {
  assert.equal(precheck(pot(), { amount: String(ONE), category: "food" }, now).outcome, "auto_pay");
});
test("above per-spend cap needs votes", () => {
  assert.equal(precheck(pot(), { amount: String(5n * ONE / 2n), category: "food" }, now).outcome, "needs_votes");
});
test("daily cap counts only today's spending", () => {
  const p = pot({ spent_today: String(2n * ONE) });
  assert.equal(precheck(p, { amount: String(2n * ONE), category: "food" }, now).outcome, "needs_votes");
  const old = pot({ spent_today: String(2n * ONE), day: String(BigInt(day) - 1n) });
  assert.equal(precheck(old, { amount: String(2n * ONE), category: "food" }, now).outcome, "auto_pay");
});
test("bad category or no funds rejects", () => {
  assert.equal(precheck(pot(), { amount: String(ONE), category: "casino" }, now).outcome, "reject");
  assert.equal(precheck(pot({ balance: "1" }), { amount: String(ONE), category: "food" }, now).outcome, "reject");
});
test("available = deposits - withdrawals - equal share of paid bills", () => {
  const p = pot({ spent_total: String(3n * ONE / 2n), balance: String(15n * ONE / 2n) });
  assert.equal(available(p, "a.testnet"), 5n * ONE / 2n);
  assert.equal(available(p, "zed.testnet"), 0n);
});
