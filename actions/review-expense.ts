import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { isAgentCaller, loadMembers, loadPot, logActivity, resolveMember, rulesOf } from "../server/lib/pots.js";
import { formatMoney, parseJson } from "../server/lib/splitchai.js";

export default defineAction({
  description:
    "A member approves or rejects an expense that is pending approval. People only: the agent cannot approve or reject, so ask the user to tap Approve in the pot.",
  schema: z.object({
    expenseId: z.string().describe("Expense id"),
    memberId: z.string().describe("Member id or name of the person approving"),
    decision: z.enum(["approve", "reject"]).describe("approve or reject"),
  }),
  run: async (args, ctx) => {
    if (isAgentCaller(ctx))
      fail("Only a person can approve or reject an expense. Ask a member to review it in the pot.", {
        errorCode: "human_approval_required",
        statusCode: 403,
      });
    return getDb().transaction(async (tx) => {
      const e = schema.expenses;
      const [row] = await tx.select().from(e).where(eq(e.id, args.expenseId)).limit(1);
      if (!row) fail("Expense not found.", { errorCode: "not_found", statusCode: 404 });
      const pot = await loadPot(row.potId, tx, true);
      const [locked] = await tx.select().from(e).where(eq(e.id, row.id)).for("update");
      const fresh = locked ?? fail("Expense not found.", { errorCode: "not_found", statusCode: 404 });
      if (fresh.status !== "pending_approval")
        fail(`This expense is ${fresh.status.replace("_", " ")}, not waiting for approval.`, {
          errorCode: "not_pending",
          statusCode: 409,
        });
      const members = await loadMembers(pot.id, tx);
      const memberId = resolveMember(members, args.memberId);
      const who = members.find((m) => m.id === memberId)!.name;
      const label = `${fresh.description} · ${formatMoney(fresh.amount, pot.currency)}`;
      if (args.decision === "reject") {
        await tx.update(e).set({ status: "rejected" }).where(and(eq(e.id, fresh.id)));
        await logActivity(tx, pot, ctx, "review", `${who} rejected ${label}`);
        return { id: fresh.id, status: "rejected" as const };
      }
      const approvals = parseJson<string[]>(fresh.approvals, []);
      if (approvals.includes(memberId))
        fail(`${who} already approved this.`, { errorCode: "already_approved", statusCode: 409 });
      approvals.push(memberId);
      const needed = rulesOf(pot).approvalsRequired;
      const status = approvals.length >= needed ? "approved" : "pending_approval";
      await tx.update(e).set({ approvals: JSON.stringify(approvals), status }).where(eq(e.id, fresh.id));
      await logActivity(
        tx,
        pot,
        ctx,
        "review",
        `${who} approved ${label} (${approvals.length}/${needed})${status === "approved" ? " — now counted" : ""}`,
      );
      return { id: fresh.id, status, approvals: approvals.length, needed };
    });
  },
});
