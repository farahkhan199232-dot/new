import { paypalConfigured, paypalEnv } from "@/lib/paypal";
import { geminiConfigured, AI_MODEL_LABEL as GEMINI_MODEL, AI_PROVIDER } from "@/lib/gemini";
import { usdcEnabled } from "@/lib/chain-server";
import { storeKind } from "@/lib/store";

export const dynamic = "force-dynamic";

/** What's configured, so the UI can show honest "not configured" states. No secrets. */
export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  return Response.json({
    paypal: paypalConfigured() && !!clientId,
    paypalClientId: paypalConfigured() ? clientId : "",
    paypalEnv,
    ai: geminiConfigured(),
    model: GEMINI_MODEL,
    provider: AI_PROVIDER,
    usdc: usdcEnabled(),
    store: storeKind,
  });
}
