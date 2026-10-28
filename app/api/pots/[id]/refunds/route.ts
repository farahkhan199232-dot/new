import { withPot } from "@/lib/http";
import { memberName, requireMember } from "@/lib/agent";
import { refundableAmount } from "@/lib/ledger";
import { refundCapture } from "@/lib/paypal";
import { audit, newId } from "@/lib/store";
import { formatMoney, toMinor } from "@/lib/money";

/**
 * Body: { actor, contributionId, amount? }. Refunds a member's unspent money back to
 * their PayPal via Captures refund (v2). Capped by what is refundable.
 */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const c = pot.contributions.find((x) => x.id === b.contributionId);
  if (!c) throw new Error("Contribution not found");
  if (c.memberId !== actor) throw new Error("Only the member who paid can request this refund");
  if (c.method !== "paypal") throw new Error("Only PayPal contributions can be refunded through PayPal");
  const max = refundableAmount(pot, c.id);
  const amount = b.amount ? toMinor(b.amount) : max;
  if (amount <= 0 || amount > max) throw new Error(`You can refund up to ${formatMoney(max, pot.currency)} from this payment`);
  const id = newId();
  const r = await refundCapture({ captureId: c.ref, amount, currency: pot.currency, requestId: `chaipot-refund-${id}`, note: `Refund from ${pot.name}` });
  pot.refunds.push({ id, contributionId: c.id, memberId: actor, amount, ref: r.id, status: r.status, createdAt: Date.now(), requestedBy: actor });
  audit(pot, {
    actor,
    kind: "refund",
    summary: `Refunded ${formatMoney(amount, pot.currency)} to ${memberName(pot, actor)} via PayPal (refund ${r.id}, ${r.status})`,
    data: { captureId: c.ref, refundId: r.id },
  });
  return {};
});
