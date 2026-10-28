import { withPot } from "@/lib/http";
import { requireMember } from "@/lib/agent";
import { toMinor } from "@/lib/money";
import { createOrder } from "@/lib/paypal";

/** Body: { actor, amount }. Creates a PayPal order (Orders API v2) for the member's contribution. */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const amount = toMinor(b.amount);
  if (amount < 100 || amount > 1_000_000) throw new Error("Contribution must be between 1 and 10,000");
  const order = await createOrder({ amount, currency: pot.currency, potId: pot.id, memberId: actor, potName: pot.name });
  return { orderId: order.id };
});
