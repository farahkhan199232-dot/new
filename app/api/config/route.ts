import { paypalConfigured, paypalEnv } from "@/lib/paypal";
import { aiConfigured, AI_MODEL_LABEL, AI_PROVIDER } from "@/lib/ai";
import { OTARI_FALLBACK_MODEL, OTARI_TOOL_MODEL } from "@/lib/otari";
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
    ai: aiConfigured(),
    model: AI_MODEL_LABEL,
    provider: AI_PROVIDER,
    fallbackModel: OTARI_FALLBACK_MODEL,
    toolModel: OTARI_TOOL_MODEL,
    otariTools: ["otari_web_search", "otari_code_execution"],
    usdc: usdcEnabled(),
    store: storeKind,
  });
}
