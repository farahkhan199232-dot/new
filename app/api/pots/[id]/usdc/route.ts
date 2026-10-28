import { withPot } from "@/lib/http";
import { memberName, requireMember } from "@/lib/agent";
import { verifyUsdcContribution } from "@/lib/chain-server";
import { audit, newId } from "@/lib/store";
import { formatMoney } from "@/lib/money";

/** Body: { actor, txHash }. Verifies the Settled event on Base before recording a USDC contribution. */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const tx = String(b.txHash ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) throw new Error("Invalid transaction hash");
  if (!pot.usdcTreasury || pot.currency !== "USD") throw new Error("USDC funding is not enabled for this pot");
  if (pot.contributions.some((c) => c.ref === tx.toLowerCase())) return {};
  const v = await verifyUsdcContribution(tx as `0x${string}`, pot.id, pot.usdcTreasury);
  pot.contributions.push({ id: newId(), memberId: actor, amount: v.cents, method: "usdc", ref: tx.toLowerCase(), createdAt: Date.now() });
  audit(pot, {
    actor,
    kind: "contribution",
    summary: `${memberName(pot, actor)} added ${formatMoney(v.cents, "USD")} in USDC on Base`,
    data: { txHash: tx, from: v.from, chainId: v.chainId },
  });
  return {};
});
