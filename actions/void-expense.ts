import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadPot, logActivity } from "../server/lib/pots.js";
import { formatMoney } from "../server/lib/splitchai.js";

export default defineAction({
  description: "Remove (void) an expense entered by mistake. It stays in the log but no longer counts toward balances.",
  schema: z.object({ expenseId: z.string().describe("Expense id") }),
  run: async ({ expenseId }, ctx) =>
    getDb().transaction(async (tx) => {
      const e = schema.expenses;
      const [row] = await tx.select().from(e).where(eq(e.id, expenseId)).limit(1);
      if (!row) fail("Expense not found.", { errorCode: "not_found", statusCode: 404 });
      const pot = await loadPot(row.potId, tx, true);
      if (row.status === "void") fail("Already removed.", { errorCode: "already_void", statusCode: 409 });
      await tx.update(e).set({ status: "void" }).where(eq(e.id, row.id));
      await logActivity(tx, pot, ctx, "void", `Removed ${row.description} · ${formatMoney(row.amount, pot.currency)}`);
      return { id: row.id, status: "void" as const };
    }),
});
