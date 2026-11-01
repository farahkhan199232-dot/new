import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "pot",
  resourceTable: schema.pots,
  sharesTable: schema.potShares,
  displayName: "Pot",
  titleColumn: "name",
  getResourcePath: (pot) => `/pots/${pot.id}`,
  getDb,
});
