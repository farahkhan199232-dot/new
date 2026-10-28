import { withPot } from "@/lib/http";
import { memberName, requireMember } from "@/lib/agent";
import { captureOrder } from "@/lib/paypal";
import { audit, newId } from "@/lib/store";
import { formatMoney } from "@/lib/money";

/**
 * Body: { actor, orderId }. Captures the order server-side and records the
 * contribution only from PayPal's response (amount, currency, custom_id).
 */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const cap = await captureOrder(String(b.orderId ?? ""));
  if (cap.customId !== `${pot.id}:${actor}`) throw new Error("This PayPal order belongs to a different pot or member");
  if (cap.currency !== pot.currency) throw new Error(`Paid in ${cap.currency}, pot uses ${pot.currency}`);
  if (pot.contributions.some((c) => c.ref === cap.captureId)) return { captured: true };
  if (cap.captureStatus !== "COMPLETED")
    throw new Error(`PayPal capture is ${cap.captureStatus}; it will not count until PayPal completes it`);
  pot.contributions.push({
    id: newId(),
    memberId: actor,
    amount: cap.amount,
    method: "paypal",
    orderId: cap.orderId,
    ref: cap.captureId,
    payerEmail: cap.payerEmail,
    createdAt: Date.now(),
  });
  audit(pot, {
    actor,
    kind: "contribution",
    summary: `${memberName(pot, actor)} added ${formatMoney(cap.amount, pot.currency)} via PayPal (capture ${cap.captureId})`,
    data: { orderId: cap.orderId, captureId: cap.captureId },
  });
  return { captured: true };
});
