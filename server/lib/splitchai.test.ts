import { describe, expect, it } from "vitest";

import {
  computeBalances,
  computeSplits,
  evaluateRules,
  splitEqual,
  splitWeighted,
  suggestTransfers,
  toMinor,
  validateRules,
} from "./splitchai";

const rules = {
  perExpenseCap: 300000,
  dailyCap: 800000,
  allowedCategories: ["food", "transport", "stay"] as never,
  approvalsRequired: 1,
};

describe("money", () => {
  it("parses major units to minor", () => {
    expect(toMinor("2,400.5")).toBe(240050);
    expect(toMinor(1150)).toBe(115000);
    expect(() => toMinor("-3")).toThrow();
  });
  it("equal split keeps every paisa", () => {
    const s = splitEqual(1000, ["a", "b", "c"]);
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(1000);
    expect(s).toEqual({ a: 334, b: 333, c: 333 });
  });
  it("weighted split sums to total", () => {
    const s = splitWeighted(1001, { a: 1, b: 2 });
    expect(s.a! + s.b!).toBe(1001);
  });
  it("exact split must add up", () => {
    expect(() => computeSplits(1000, { mode: "exact", values: { a: 400, b: 500 } }, ["a", "b"])).toThrow();
    expect(computeSplits(1000, { mode: "percent", values: { a: 25, b: 75 } }, ["a", "b"])).toEqual({ a: 250, b: 750 });
  });
});

describe("rules", () => {
  it("approves within limits", () => {
    expect(evaluateRules(rules, { currency: "INR", spentToday: 0 }, { amount: 240000, category: "food" }).decision).toBe(
      "approved",
    );
  });
  it("needs approval over the per-bill cap", () => {
    expect(evaluateRules(rules, { currency: "INR", spentToday: 0 }, { amount: 900000, category: "stay" }).decision).toBe(
      "pending_approval",
    );
  });
  it("needs approval over the daily cap", () => {
    expect(
      evaluateRules(rules, { currency: "INR", spentToday: 700000 }, { amount: 200000, category: "food" }).decision,
    ).toBe("pending_approval");
  });
  it("rejects a blocked category even under the cap", () => {
    expect(evaluateRules(rules, { currency: "INR", spentToday: 0 }, { amount: 100, category: "shopping" }).decision).toBe(
      "rejected",
    );
  });
  it("validates rules", () => {
    expect(validateRules({ ...rules, dailyCap: 100 })).toMatch(/Daily cap/);
  });
});

describe("balances and settle-up", () => {
  const members = [
    { id: "f", name: "Farah" },
    { id: "a", name: "Aisha" },
    { id: "r", name: "Ravi" },
  ];
  it("only approved expenses count, settlements reduce debt, transfers clear all", () => {
    const expenses = [
      { status: "approved", paidBy: "a", amount: 3000, splits: { f: 1000, a: 1000, r: 1000 } },
      { status: "pending_approval", paidBy: "f", amount: 9000, splits: { f: 3000, a: 3000, r: 3000 } },
    ];
    let b = computeBalances(members, expenses, []);
    expect(b.map((x) => x.net)).toEqual([-1000, 2000, -1000]);
    b = computeBalances(members, expenses, [{ fromMember: "f", toMember: "a", amount: 1000 }]);
    expect(b.map((x) => x.net)).toEqual([0, 1000, -1000]);
    expect(suggestTransfers(b)).toEqual([{ from: "r", to: "a", amount: 1000 }]);
  });
});
