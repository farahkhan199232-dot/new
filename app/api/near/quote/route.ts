import { dryQuoteUsdcOnBase } from "@/lib/near/intents";
import { toYocto } from "@/lib/near/units";

export const dynamic = "force-dynamic";

/** NEAR Intents 1Click dry quote: what `near` NEAR would settle to as USDC on Base. No funds move. */
export async function GET(req: Request) {
  try {
    const near = new URL(req.url).searchParams.get("near") || "1";
    return Response.json({ quote: await dryQuoteUsdcOnBase(toYocto(near)) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
