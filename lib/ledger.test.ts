import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLedger, refundableAmount } from "./ledger.ts";
import { convertMinor, splitEqual, toDecimalString, toMinor } from "./money.ts";
import type { Pot } from "./types.ts";

const members = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Bilal" },
  { id: "c", name: "Chitra" },
];

function pot(): Pick<Pot, "members" | "contributions" | "refunds" | "spends" | "contributionTarget"> {
  return {
    members,
    contributionTarget: 5000,
    contributions: [
      { id: "c1", memberId: "a", amount: 5000, method: "paypal", ref: "CAP1", createdAt: 0 },
      { id: "c2", memberId: "b", amount: 5000, method: "paypal", ref: "CAP2", createdAt: 0 },
      { id: "c3", memberId: "c", amount: 2000, method: "usdc", ref: "0xabc", createdAt: 0 },
    ],
    refunds: [],
    spends: [
      {
        id: "s1", description: "dinner", payeeEmail: "x@y.co", category: "food", amount: 3000,
        splits: splitEqual(3000, ["a", "b", "c"]), status: "paid", requestedBy: "a", approvals: [], createdAt: 0,
      },
      {
        id: "s2", description: "scuba", payeeEmail: "x@y.co", category: "activities", amount: 9000,
        splits: splitEqual(9000, ["a", "b", "c"]), status: "pending_approval", requestedBy: "b", approvals: [], createdAt: 0,
      },
      {
        id: "s3", description: "rejected", payeeEmail: "x@y.co", category: "food", amount: 700,
        splits: { a: 700 }, status: "rejected", requestedBy: "a", approvals: [], createdAt: 0,
      },
    ],
  };
}

test("money helpers", () => {
  assert.equal(toMinor("2,400.5"), 240050);
  assert.equal(toMinor(12), 1200);
  assert.throws(() => toMinor("-1"));
  assert.throws(() => toMinor("1.234"));
  assert.equal(toDecimalString(240050), "2400.50");
  assert.equal(toDecimalString(5), "0.05");
  assert.deepEqual(splitEqual(1000, ["a", "b", "c"]), { a: 334, b: 333, c: 333 });
  assert.equal(convertMinor(240000, "INR", "USD").amount, 2880);
});

test("ledger: only paid spends reduce balances", () => {
  const l = computeLedger(pot());
  assert.equal(l.totals.contributed, 12000);
  assert.equal(l.totals.spent, 3000);
  assert.equal(l.totals.pending, 9000);
  assert.equal(l.totals.potBalance, 9000);
  const byId = Object.fromEntries(l.members.map((m) => [m.memberId, m]));
  assert.equal(byId.a.balance, 5000 - 1000);
  assert.equal(byId.c.balance, 2000 - 1000);
  assert.equal(byId.c.targetRemaining, 3000);
  assert.equal(byId.a.targetRemaining, 0);
});

test("ledger balances always sum to pot balance", () => {
  const l = computeLedger(pot());
  assert.equal(l.members.reduce((s, m) => s + m.balance, 0), l.totals.potBalance);
});

test("refunds reduce balance and are capped", () => {
  const p = pot();
  assert.equal(refundableAmount(p, "c1"), 4000); // capped by Asha's unspent balance
  assert.equal(refundableAmount(p, "c3"), 0); // USDC contributions are not PayPal-refundable
  p.refunds.push({ id: "r1", contributionId: "c1", memberId: "a", amount: 1500, ref: "R1", status: "COMPLETED", createdAt: 0, requestedBy: "a" });
  const l = computeLedger(p);
  assert.equal(l.members.find((m) => m.memberId === "a")!.balance, 2500);
  assert.equal(refundableAmount(p, "c1"), 2500);
});
