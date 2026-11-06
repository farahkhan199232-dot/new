import { equalSplit } from "./split";
import type { Group } from "./types";

const t0 = Date.UTC(2026, 10, 6, 12, 0);
export function demoGroup(): Group {
  const members = [
    { id: "farah", name: "Farah", wallet: "Fx2QFVJoZ8YhrJdedkY16Go3wis1wCeXrQpi9R6NoHsH" },
    { id: "aisha", name: "Aisha", wallet: "29EjTt8QBtTwjHyao6bCDQbnBG5gP77xt4iBb9xCGd48" },
    { id: "bilal", name: "Bilal", wallet: "GacNYH51CoU8RvqeQBpJr5VdNU5RVio4w5NF55YEgqky" },
    { id: "chirag", name: "Chirag" },
  ];
  const all = members.map((m) => m.id);
  return {
    id: "demo",
    name: "Goa trip ☕ (demo)",
    createdAt: t0,
    feeBps: 30,
    members,
    expenses: [
      { id: "e1", description: "Beach villa, 2 nights", amount: 240_000_000, paidBy: "farah", shares: equalSplit(240_000_000, all), splitMode: "equal", createdAt: t0 + 1e6 },
      { id: "e2", description: "Scooter rentals", amount: 48_000_000, paidBy: "aisha", shares: equalSplit(48_000_000, all), splitMode: "equal", createdAt: t0 + 2e6 },
      { id: "e3", description: "Seafood dinner", amount: 90_000_000, paidBy: "bilal", shares: { farah: 20_000_000, aisha: 25_000_000, bilal: 20_000_000, chirag: 25_000_000 }, splitMode: "custom", createdAt: t0 + 3e6 },
      { id: "e4", description: "Chai + vada pav run", amount: 6_000_000, paidBy: "chirag", shares: equalSplit(6_000_000, ["farah", "aisha", "chirag"]), splitMode: "equal", createdAt: t0 + 4e6 },
    ],
    settlements: [],
  };
}
