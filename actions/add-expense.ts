import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { insertExpense, loadMembers, loadPot } from "../server/lib/pots.js";
import { expenseFields } from "../server/lib/expense-fields.js";


export default defineAction({
  description:
    "Add one expense to a pot. The pot's rules decide the status: approved, pending_approval (over a cap: a member must approve it in the UI; the agent cannot approve) or rejected (category not allowed). Report the status and reasons to the user; do not retry a rejection.",
  schema: z.object({ potId: z.string().describe("Pot id"), ...expenseFields }),
  link: ({ args }) => ({
    url: buildDeepLink({ view: "pots", to: `/pots/${encodeURIComponent(args.potId)}`, params: { potId: args.potId } }),
    label: "Open pot",
  }),
  run: async ({ potId, ...input }, ctx) =>
    getDb().transaction(async (tx) => {
      // Locking the pot row serializes writes so the daily cap can't be raced past.
      const pot = await loadPot(potId, tx, true);
      const members = await loadMembers(pot.id, tx);
      return insertExpense(tx, pot, members, input, ctx);
    }),
});
