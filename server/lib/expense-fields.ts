import { z } from "zod";

import { CATEGORIES } from "./splitchai.js";

export const expenseFields = {
  description: z.string().min(1).max(200).describe('What it was for, e.g. "Dinner at Thalassa"'),
  amount: z.union([z.number(), z.string()]).describe("Bill total in MAJOR units of the pot currency, e.g. 2400 or 2400.50"),
  category: z.enum(CATEGORIES).describe("Expense category; the pot's rules may block some"),
  paidBy: z.string().describe("Member id or name of who paid"),
  splitMode: z
    .enum(["equal", "exact", "percent", "shares"])
    .default("equal")
    .describe("equal: split evenly among splitWith (or everyone). exact/percent/shares: use splitValues"),
  splitWith: z
    .array(z.string())
    .optional()
    .describe("For equal: the ONLY people sharing the bill (ids or names). Omit for everyone. The payer is not added automatically"),
  exclude: z
    .array(z.string())
    .optional()
    .describe('For equal: people to leave out, e.g. "everyone except Ravi" -> exclude ["Ravi"] and omit splitWith. The payer stays in unless listed'),
  splitValues: z
    .record(z.string(), z.number())
    .optional()
    .describe("For exact (major units, must sum to amount), percent (sum 100) or shares (weights): member id or name -> value"),
  date: z.string().optional().describe("Day it was spent, YYYY-MM-DD in the pot timezone; defaults to today"),
};
