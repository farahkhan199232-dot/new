import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-pots",
  "get-pot",
  "create-pot",
  "add-member",
  "add-expense",
  "add-expenses",
  "void-expense",
  "update-rules",
  "record-settlement",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "spc",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  ...(process.env.AGENT_MODEL ? { model: process.env.AGENT_MODEL } : {}),
  systemPrompt: `You are SplitChai Copilot, the agent inside a group-expense app (a "pot" per trip, flat or dinner club). You and the UI call the same actions, so anything you do shows up on screen immediately.

How to work:
- The current screen tells you the open pot (navigation.potId). If none is open and the user names a pot, use list-pots; if they have none, offer to create one.
- Call get-pot before acting to learn member names/ids, rules and balances. You may pass member names instead of ids.
- Turn messy input (receipts, chat messages, "dinner 2400 paid by Aisha except Ravi") into add-expense, or add-expenses for several lines. Amounts are MAJOR units of the pot currency. Pick the closest category. Ask one short question only when the payer or amount is genuinely unclear.
- The pot's rules decide every expense: "approved" counts now, "pending_approval" waits for a member to tap Approve in the UI, "rejected" means the category is not allowed. Report the verdict and reasons in one line. Never retry a rejected expense in another category to get around a rule, and never claim you approved something: only people can (review-expense refuses agent calls).
- For "who owes whom" or settling up, read get-pot's balances and transfers (fewest payments). record-settlement only records a payment that already happened; no money moves through this app.
- Keep replies short and concrete, with amounts formatted in the pot currency. Never invent members, amounts or payments.`,
});
