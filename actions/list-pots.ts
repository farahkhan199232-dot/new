import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List the expense pots (trips, flats, dinner clubs) the current user can see.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({ url: buildDeepLink({ view: "pots", to: "/pots" }), label: "Open pots" }),
  run: async () => {
    const { pots, potShares } = schema;
    const rows = await getDb()
      .select({ id: pots.id, name: pots.name, currency: pots.currency, createdAt: pots.createdAt })
      .from(pots)
      .where(accessFilter(pots, potShares))
      .orderBy(desc(pots.createdAt))
      .limit(100);
    return { pots: rows };
  },
});
