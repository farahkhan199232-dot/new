import { withPot } from "@/lib/http";
import { handleTextRequest, requireMember } from "@/lib/agent";

export const maxDuration = 60;

/** Body: { actor, text }. e.g. "pay the $24 dinner at Saravana to host@example.com" */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const text = String(b.text ?? "").trim();
  if (text.length < 4) throw new Error("Tell the agent what to pay");
  const r = await handleTextRequest(pot, actor, text);
  return { spendId: r.spend?.id ?? null, missing: r.missing };
});
