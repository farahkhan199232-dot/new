import type { IntentsQuote } from "./types";

/**
 * NEAR Intents 1Click: a DRY quote (dry: true) for settling a pot payout as USDC on Base.
 * Nothing is deposited or swapped. NEAR Intents has no testnet, so on testnet the pot pays in
 * native NEAR and this quote shows what the same spend would settle to cross-chain on mainnet.
 * Docs: https://docs.near-intents.org/
 */
const ONECLICK = process.env.ONECLICK_API || "https://1click.chaindefuser.com";
const WNEAR = "nep141:wrap.near";
const USDC_BASE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
// Placeholder recipient for a dry quote only (no funds move). Real payouts would use the payee's address.
const DRY_RECIPIENT = "0xf19AC42F7d9a902c200E862d69835d2860BDddA6";

export async function dryQuoteUsdcOnBase(amountYocto: string, refundTo = "chai-pot.near"): Promise<IntentsQuote> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  try {
    const r = await fetch(`${ONECLICK}/v0/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dry: true,
        swapType: "EXACT_INPUT",
        slippageTolerance: 100,
        originAsset: WNEAR,
        depositType: "INTENTS",
        destinationAsset: USDC_BASE,
        amount: amountYocto,
        refundTo,
        refundType: "INTENTS",
        recipient: DRY_RECIPIENT,
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const d = await r.json();
    if (!r.ok || !d.quote) throw new Error(d.message || `1Click ${r.status}`);
    return { usdcOut: d.quote.amountOutFormatted, usdIn: Number(d.quote.amountInUsd).toFixed(2), timeEstimateSec: d.quote.timeEstimate, dry: true };
  } catch (e) {
    return { usdcOut: "", usdIn: "", timeEstimateSec: 0, dry: true, error: (e as Error).message };
  }
}
