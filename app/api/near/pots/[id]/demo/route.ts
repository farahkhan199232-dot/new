import { reviewSpend } from "@/lib/near/agent";
import { DEMO_MEMBERS, DEMO_PAYEE, NEAR_DEMO_POT } from "@/lib/near/config";
import { callAs, demoAccount, transferAs } from "@/lib/near/server";
import { isAccountId, toYocto } from "@/lib/near/units";
import { viewAccount } from "@/lib/near/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public demo pot only: act as one of its testnet demo members so judges can try every flow
 * without a wallet. Every action is a real NEAR testnet transaction signed by that demo account.
 */
const ONE = 10n ** 24n;

async function topUp(member: string) {
  // Keep demo members able to chip in: the demo café sends its takings back when a member runs low.
  const acct = await viewAccount(member);
  if (acct && BigInt(acct.amount) >= (13n * ONE) / 10n) return;
  const cafe = await viewAccount(DEMO_PAYEE);
  if (!cafe || BigInt(cafe.amount) < 2n * ONE) return;
  await transferAs(demoAccount(DEMO_PAYEE), member, ONE);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (id !== NEAR_DEMO_POT) return Response.json({ error: "Demo actions only work on the demo pot. Connect a NEAR wallet for your own pot." }, { status: 403 });
    const b = await req.json();
    const as = String(b.as || "");
    if (!DEMO_MEMBERS.includes(as)) return Response.json({ error: "Pick a demo member" }, { status: 400 });
    const acct = demoAccount(as);

    switch (b.action) {
      case "deposit": {
        const amount = BigInt(toYocto(b.amount));
        if (amount <= 0n || amount > ONE) return Response.json({ error: "Demo deposits are 0.01 to 1 NEAR" }, { status: 400 });
        await topUp(as);
        const tx = await callAs(acct, "deposit", { pot_id: id }, amount);
        return Response.json({ tx });
      }
      case "request": {
        const to = String(b.to || "").trim().toLowerCase();
        if (!isAccountId(to)) return Response.json({ error: "Payee must be a NEAR account id" }, { status: 400 });
        const amount = toYocto(b.amount);
        if (BigInt(amount) <= 0n || BigInt(amount) > 5n * ONE) return Response.json({ error: "Demo spends are up to 5 NEAR" }, { status: 400 });
        const tx = await callAs(acct, "request_spend", { pot_id: id, to, amount, category: String(b.category || ""), memo: String(b.memo || "").slice(0, 200) });
        const spendId = tx.value as number;
        // The agent reviews right away (same as the wallet flow, where the page calls /review).
        let review = null;
        let reviewError = "";
        try {
          review = await reviewSpend(id, spendId);
        } catch (e) {
          reviewError = (e as Error).message;
        }
        return Response.json({ tx, spendId, review, reviewError });
      }
      case "approve": {
        const tx = await callAs(acct, "approve_spend", { pot_id: id, spend_id: Number(b.spendId) });
        return Response.json({ tx });
      }
      case "reject": {
        const tx = await callAs(acct, "reject_spend", { pot_id: id, spend_id: Number(b.spendId), reason: String(b.reason || "not needed").slice(0, 120) });
        return Response.json({ tx });
      }
      case "withdraw": {
        const tx = await callAs(acct, "withdraw", { pot_id: id, amount: toYocto(b.amount) });
        return Response.json({ tx });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
