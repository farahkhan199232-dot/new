import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { insertExpense, loadMembers, loadPot } from "../server/lib/pots.js";
import { expenseFields } from "../server/lib/expense-fields.js";

export default defineAction({
  description:
    "Add several expenses at once (e.g. lines from a pasted receipt, a chat log or a bank SMS list). All-or-nothing: one invalid line fails the batch. Each line gets its own rules verdict.",
  schema: z.object({
    potId: z.string().describe("Pot id"),
    expenses: z.array(z.object(expenseFields)).min(1).max(25).describe("Expenses to add, in order"),
  }),
  run: async ({ potId, expenses }, ctx) =>
    getDb().transaction(async (tx) => {
      const pot = await loadPot(potId, tx, true);
      const members = await loadMembers(pot.id, tx);
      const added = [];
      for (const input of expenses) added.push(await insertExpense(tx, pot, members, input, ctx));
      return { added };
    }),
});
