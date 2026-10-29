import { paypalConfigured, paypalEnv } from "@/lib/paypal";
import { geminiConfigured, GEMINI_MODEL } from "@/lib/gemini";
import { usdcEnabled } from "@/lib/chain-server";
import { storeKind } from "@/lib/store";
import { qlooConfigured } from "@/lib/qloo";

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
    usdc: usdcEnabled(),
    store: storeKind,
    taste: qlooConfigured(),
  });
}
