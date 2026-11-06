import { describe, expect, it } from "vitest";
import { equalSplit, customSplit } from "@/lib/split";
import { netBalances, settlePlan } from "@/lib/balances";
import { feeFor, formatUsdc, parseUsdc } from "@/lib/money";
import type { Group } from "@/lib/types";

describe("money", () => {
  it("parses and formats", () => {
    expect(parseUsdc("12.5")).toBe(12_500_000);
    expect(parseUsdc("$1,200.00")).toBe(1_200_000_000);
    expect(parseUsdc("0.000001")).toBe(1);
    expect(parseUsdc("1.0000001")).toBeNull();
    expect(parseUsdc("abc")).toBeNull();
    expect(formatUsdc(12_500_000)).toBe("$12.50");
    expect(formatUsdc(-3_330_000)).toBe("-$3.33");
    expect(formatUsdc(1)).toBe("$0.000001");
    expect(formatUsdc(5_000_000, { sign: true })).toBe("+$5.00");
  });
  it("fee is 0.3% rounded down", () => {
    expect(feeFor(100_000_000, 30)).toBe(300_000);
    expect(feeFor(333, 30)).toBe(0);
    expect(feeFor(100_000_000, 0)).toBe(0);
  });
});

describe("split", () => {
  it("equal split sums exactly and spreads remainder", () => {
    const s = equalSplit(10_000_000, ["a", "b", "c"]);
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(10_000_000);
    expect(s).toEqual({ a: 3_333_334, b: 3_333_333, c: 3_333_333 });
  });
  it("equal split dedupes and rejects empties", () => {
    expect(equalSplit(4, ["a", "a", "b"])).toEqual({ a: 2, b: 2 });
    expect(() => equalSplit(4, [])).toThrow();
    expect(() => equalSplit(0, ["a"])).toThrow();
  });
  it("custom split must add up", () => {
    expect(customSplit(10, { a: 7, b: 3, c: 0 })).toEqual({ a: 7, b: 3 });
    expect(() => customSplit(10, { a: 7, b: 2 })).toThrow(/add up/);
    expect(() => customSplit(10, { a: -1, b: 11 })).toThrow();
  });
});

const grp = (): Group => ({
  id: "g1", name: "Goa", createdAt: 0, feeBps: 30,
  members: [{ id: "a", name: "Aisha" }, { id: "b", name: "Bilal" }, { id: "c", name: "Chirag" }, { id: "d", name: "Dia" }],
  expenses: [], settlements: [],
});

describe("balances + settle plan", () => {
  it("nets expenses and settlements", () => {
    const g = grp();
    g.expenses.push({ id: "e1", description: "Villa", amount: 400, paidBy: "a", shares: equalSplit(400, ["a", "b", "c", "d"]), splitMode: "equal", createdAt: 0 });
    g.expenses.push({ id: "e2", description: "Cab", amount: 60, paidBy: "b", shares: { a: 20, c: 20, d: 20 }, splitMode: "custom", createdAt: 0 });
    let net = netBalances(g);
    expect(net).toEqual({ a: 280, b: -40, c: -120, d: -120 });
    expect(Object.values(net).reduce((x, y) => x + y, 0)).toBe(0);
    g.settlements.push({ id: "s", from: "c", to: "a", amount: 120, fee: 0, signature: "x", verifiedAt: 0 });
    net = netBalances(g);
    expect(net.c).toBe(0);
    expect(net.a).toBe(160);
  });
  it("plan settles everyone with at most n-1 transfers", () => {
    const net = { a: 280, b: -40, c: -120, d: -120 };
    const plan = settlePlan(net);
    expect(plan.length).toBeLessThanOrEqual(3);
    const after = { ...net } as Record<string, number>;
    for (const t of plan) { after[t.from] += t.amount; after[t.to] -= t.amount; expect(t.amount).toBeGreaterThan(0); }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
  it("plan collapses chains (a owes b, b owes c => a pays c)", () => {
    const plan = settlePlan({ a: -50, b: 0, c: 50 });
    expect(plan).toEqual([{ from: "a", to: "c", amount: 50 }]);
  });
  it("random groups always fully settle", () => {
    for (let k = 0; k < 200; k++) {
      const n = 2 + (k % 9);
      const vals = Array.from({ length: n - 1 }, () => Math.floor(Math.random() * 2e7) - 1e7);
      vals.push(-vals.reduce((x, y) => x + y, 0));
      const net = Object.fromEntries(vals.map((v, i) => [`m${i}`, v]));
      const plan = settlePlan(net);
      expect(plan.length).toBeLessThanOrEqual(n - 1);
      const after = { ...net };
      for (const t of plan) { after[t.from] += t.amount; after[t.to] -= t.amount; }
      expect(Object.values(after).every((v) => v === 0)).toBe(true);
    }
  });
});
