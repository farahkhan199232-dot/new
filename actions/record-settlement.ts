import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { isAgentCaller, loadMembers, loadPot, logActivity, requireUser, resolveMember } from "../server/lib/pots.js";
import { formatMoney, toMinor } from "../server/lib/splitchai.js";

export default defineAction({
  description:
    "Record that one member paid another back (cash, UPI, bank). This only records it; no money moves through the app. Use get-pot's transfers for suggested settle-ups.",
  schema: z.object({
    potId: z.string().describe("Pot id"),
    from: z.string().describe("Member id or name who paid"),
    to: z.string().describe("Member id or name who received"),
    amount: z.union([z.number(), z.string()]).describe("Amount in MAJOR units, e.g. 1250"),
    note: z.string().max(120).optional().describe('Optional note, e.g. "UPI"'),
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    return getDb().transaction(async (tx) => {
      const pot = await loadPot(args.potId, tx, true);
      const members = await loadMembers(pot.id, tx);
      const from = resolveMember(members, args.from);
      const to = resolveMember(members, args.to);
      if (from === to) fail("Pick two different people.", { errorCode: "same_member" });
      let amount: number;
      try {
        amount = toMinor(args.amount);
      } catch {
        fail(`"${args.amount}" is not a valid amount.`, { errorCode: "invalid_amount" });
      }
      if (amount <= 0) fail("Amount must be above zero.", { errorCode: "invalid_amount" });
      const row = {
        id: crypto.randomUUID(),
        potId: pot.id,
        fromMember: from,
        toMember: to,
        amount,
        note: args.note ?? null,
        source: isAgentCaller(ctx) ? "agent" : "ui",
        ownerEmail,
        orgId: pot.orgId ?? null,
        createdAt: new Date().toISOString(),
      };
      await tx.insert(schema.settlements).values(row);
      const n = (id: string) => members.find((m) => m.id === id)!.name;
      const summary = `${n(from)} paid ${n(to)} ${formatMoney(amount, pot.currency)}${row.note ? ` (${row.note})` : ""}`;
      await logActivity(tx, pot, ctx, "settlement", summary);
      return { id: row.id, summary };
    });
  },
});
