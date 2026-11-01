import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadMembers, loadPot, logActivity, requireUser } from "../server/lib/pots.js";

export default defineAction({
  description: "Add a person to a pot. Names must be unique within the pot.",
  schema: z.object({
    potId: z.string().describe("Pot id"),
    name: z.string().min(1).max(40).describe("Display name"),
    email: z.string().email().optional().describe("Optional email"),
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    return getDb().transaction(async (tx) => {
      const pot = await loadPot(args.potId, tx, true);
      const members = await loadMembers(pot.id, tx);
      const name = args.name.trim();
      if (members.some((m) => m.name.toLowerCase() === name.toLowerCase()))
        fail(`${name} is already in this pot.`, { errorCode: "duplicate_member", statusCode: 409 });
      const row = {
        id: crypto.randomUUID(),
        potId: pot.id,
        name,
        email: args.email ?? null,
        ownerEmail,
        orgId: pot.orgId ?? null,
        createdAt: new Date().toISOString(),
      };
      await tx.insert(schema.potMembers).values(row);
      await logActivity(tx, pot, ctx, "member", `Added ${name}`);
      return { id: row.id, name };
    });
  },
});
