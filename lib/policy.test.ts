import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, evaluatePolicy, spentOnDay, validatePolicy } from "./policy.ts";
import type { Policy, Spend } from "./types.ts";

const policy: Policy = { perBillCap: 5000, dailyCap: 12000, allowedCategories: ["food", "transport"], approvalsRequired: 2 };
const ctx = { currency: "USD", potBalance: 20000, spentToday: 0 };
const ok = { amount: 2400, category: "food" as const, payeeEmail: "host@example.com" };

test("within limits -> auto_pay", () => {
  const r = evaluatePolicy(policy, ctx, ok);
  assert.equal(r.decision, "auto_pay");
  assert.ok(r.checks.every((c) => c.ok));
});

test("exactly at the per-bill cap is still auto_pay", () => {
  assert.equal(evaluatePolicy(policy, ctx, { ...ok, amount: 5000 }).decision, "auto_pay");
});

test("over per-bill cap -> needs_approval", () => {
  const r = evaluatePolicy(policy, ctx, { ...ok, amount: 5001 });
  assert.equal(r.decision, "needs_approval");
  assert.ok(r.reasons.some((x) => x.includes("per-bill")));
});

test("daily cap counts what was already spent today", () => {
  const r = evaluatePolicy(policy, { ...ctx, spentToday: 10000 }, { ...ok, amount: 2500 });
  assert.equal(r.decision, "needs_approval");
  assert.ok(r.reasons.some((x) => x.includes("today")));
});

test("disallowed category -> reject even if small", () => {
  const r = evaluatePolicy(policy, ctx, { ...ok, category: "shopping" });
  assert.equal(r.decision, "reject");
});

test("insufficient funds -> reject, beats approval", () => {
  const r = evaluatePolicy(policy, { ...ctx, potBalance: 3000 }, { ...ok, amount: 9000 });
  assert.equal(r.decision, "reject");
  assert.ok(r.reasons.includes("not enough money in the pot"));
});

test("missing payee email -> reject", () => {
  assert.equal(evaluatePolicy(policy, ctx, { ...ok, payeeEmail: "Saravana" }).decision, "reject");
});

test("spentOnDay only counts paid spends on the same local day", () => {
  // 2026-10-28 23:00 IST and 2026-10-29 00:30 IST
  const late = Date.UTC(2026, 9, 28, 17, 30);
  const nextDay = Date.UTC(2026, 9, 28, 19, 0);
  assert.equal(dayKey(late, "Asia/Kolkata"), "2026-10-28");
  assert.equal(dayKey(nextDay, "Asia/Kolkata"), "2026-10-29");
  const base = { description: "", payeeEmail: "a@b.co", category: "food", splits: {}, requestedBy: "a", approvals: [] } as const;
  const spends: Spend[] = [
    { ...base, id: "1", amount: 1000, status: "paid", createdAt: late, paidAt: late, splits: {}, approvals: [] },
    { ...base, id: "2", amount: 2000, status: "paid", createdAt: nextDay, paidAt: nextDay, splits: {}, approvals: [] },
    { ...base, id: "3", amount: 4000, status: "pending_approval", createdAt: nextDay, splits: {}, approvals: [] },
  ];
  assert.equal(spentOnDay({ spends, timezone: "Asia/Kolkata" }, nextDay), 2000);
});

test("validatePolicy", () => {
  assert.equal(validatePolicy(policy), null);
  assert.ok(validatePolicy({ ...policy, dailyCap: 100 }));
  assert.ok(validatePolicy({ ...policy, allowedCategories: [] }));
  assert.ok(validatePolicy({ ...policy, approvalsRequired: 0 }));
});
