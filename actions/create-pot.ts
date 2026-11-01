import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity, requireUser } from "../server/lib/pots.js";
import { CATEGORIES, CURRENCIES, toMinor, validateRules } from "../server/lib/splitchai.js";

export default defineAction({
  description:
    "Create a shared expense pot with its members and spending rules. Amounts are in major units of the pot currency (e.g. 2000 = ₹2,000).",
  schema: z.object({
    name: z.string().min(1).max(80).describe('Pot name, e.g. "Goa trip"'),
    currency: z.enum(CURRENCIES).default("INR").describe("ISO currency code for every amount in the pot"),
    members: z.array(z.string().min(1).max(40)).min(2).max(20).describe("Member display names, at least two"),
    perExpenseCap: z.coerce.number().positive().default(3000).describe("Bills above this need approval (major units)"),
    dailyCap: z.coerce.number().positive().default(8000).describe("Approved spend per day before approval is needed (major units)"),
    allowedCategories: z.array(z.enum(CATEGORIES)).min(1).default([...CATEGORIES]).describe("Categories this pot accepts"),
    approvalsRequired: z.coerce.number().int().min(1).max(5).default(1).describe("Member approvals needed above a cap"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({ view: "pots", to: `/pots/${encodeURIComponent(result.id)}`, params: { potId: result.id } }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const names = [...new Set(args.members.map((n) => n.trim()).filter(Boolean))];
    if (names.length < 2) fail("A pot needs at least two different members.", { errorCode: "invalid_members" });
    const rules = {
      perExpenseCap: toMinor(String(args.perExpenseCap)),
      dailyCap: toMinor(String(args.dailyCap)),
      allowedCategories: args.allowedCategories,
      approvalsRequired: args.approvalsRequired,
    };
    const err = validateRules(rules);
    if (err) fail(err, { errorCode: "invalid_rules" });
    const pot = {
      id: crypto.randomUUID(),
      name: args.name.trim(),
      currency: args.currency,
      timezone: "Asia/Kolkata",
      perExpenseCap: rules.perExpenseCap,
      dailyCap: rules.dailyCap,
      allowedCategories: JSON.stringify(rules.allowedCategories),
      approvalsRequired: rules.approvalsRequired,
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
      createdAt: new Date().toISOString(),
    };
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.insert(schema.pots).values(pot);
      await tx.insert(schema.potMembers).values(
        names.map((name, i) => ({
          id: crypto.randomUUID(),
          potId: pot.id,
          name,
          ownerEmail,
          orgId,
          createdAt: new Date(Date.now() + i).toISOString(),
        })),
      );
      await logActivity(tx, pot, ctx, "pot", `Created ${pot.name} with ${names.join(", ")}`);
    });
    return { id: pot.id, name: pot.name, currency: pot.currency, members: names };
  },
});
