import { withPot } from "@/lib/http";
import { approveSpend, rejectSpend, requireMember, retrySpend, syncPayout } from "@/lib/agent";

export const maxDuration = 60;

/** Body: { actor, spendId, action: "approve" | "reject" | "retry" | "sync" } */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const spend = pot.spends.find((s) => s.id === b.spendId);
  if (!spend) throw new Error("Bill not found");
  if (spend.sample && b.action === "sync") throw new Error("Sample entries have no PayPal payout");
  switch (b.action) {
    case "approve":
      await approveSpend(pot, spend, actor);
      break;
    case "reject":
      rejectSpend(pot, spend, actor);
      break;
    case "retry":
      await retrySpend(pot, spend, actor);
      break;
    case "sync":
      await syncPayout(pot, spend);
      break;
    default:
      throw new Error("Unknown action");
  }
  return {};
});
