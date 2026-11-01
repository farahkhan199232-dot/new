import { GeminiBusy, GeminiNotConfigured } from "@/lib/gemini";
import { reviewPending, reviewSpend } from "@/lib/near/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ask the pot's agent to review a spend (or every spend still waiting for it).
 * Safe for anyone to call: the contract only accepts a review from the agent account, once per spend.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    const body = await req.json().catch(() => ({}));
    const reviews = Number.isInteger(body.spendId) ? [await reviewSpend(id, body.spendId)].filter(Boolean) : await reviewPending(id);
    return Response.json({ reviews });
  } catch (e) {
    const status = e instanceof GeminiNotConfigured || e instanceof GeminiBusy ? 503 : 400;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
