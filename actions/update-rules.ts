import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadPot, logActivity, rulesOf } from "../server/lib/pots.js";
import { CATEGORIES, formatMoney, toMinor, validateRules } from "../server/lib/splitchai.js";

export default defineAction({
  description:
    "Change a pot's spending rules. Pass only what changes. Caps are MAJOR units. New rules apply to future expenses only.",
  schema: z.object({
    potId: z.string().describe("Pot id"),
    perExpenseCap: z.coerce.number().positive().optional().describe("Bills above this need approval (major units)"),
    dailyCap: z.coerce.number().positive().optional().describe("Approved spend per day before approval (major units)"),
    allowedCategories: z.array(z.enum(CATEGORIES)).min(1).optional().describe("Full list of allowed categories"),
    approvalsRequired: z.coerce.number().int().min(1).max(5).optional().describe("Approvals needed above a cap"),
  }),
  run: async (args, ctx) =>
    getDb().transaction(async (tx) => {
      const pot = await loadPot(args.potId, tx, true);
      const cur = rulesOf(pot);
      const next = {
        perExpenseCap: args.perExpenseCap !== undefined ? toMinor(String(args.perExpenseCap)) : cur.perExpenseCap,
        dailyCap: args.dailyCap !== undefined ? toMinor(String(args.dailyCap)) : cur.dailyCap,
        allowedCategories: args.allowedCategories ?? cur.allowedCategories,
        approvalsRequired: args.approvalsRequired ?? cur.approvalsRequired,
      };
      const err = validateRules(next);
      if (err) fail(err, { errorCode: "invalid_rules" });
      await tx
        .update(schema.pots)
        .set({
          perExpenseCap: next.perExpenseCap,
          dailyCap: next.dailyCap,
          allowedCategories: JSON.stringify(next.allowedCategories),
          approvalsRequired: next.approvalsRequired,
        })
        .where(eq(schema.pots.id, pot.id));
      const f = (n: number) => formatMoney(n, pot.currency);
      await logActivity(
        tx,
        pot,
        ctx,
        "rules",
        `Rules: per-bill cap ${f(next.perExpenseCap)}, daily cap ${f(next.dailyCap)}, ${next.approvalsRequired} approval(s), categories ${next.allowedCategories.join(", ")}`,
      );
      return { potId: pot.id, rules: next };
    }),
});
