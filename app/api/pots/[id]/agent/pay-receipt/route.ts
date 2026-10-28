import { withPot } from "@/lib/http";
import { payReceipt, requireMember } from "@/lib/agent";

export const maxDuration = 90;

/** Body: { actor, receiptId, payeeEmail, splitAmong: memberId[] } */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const split = Array.isArray(b.splitAmong) ? b.splitAmong.map(String) : [];
  const spend = await payReceipt(pot, actor, String(b.receiptId ?? ""), String(b.payeeEmail ?? ""), split);
  return { spendId: spend.id };
});
