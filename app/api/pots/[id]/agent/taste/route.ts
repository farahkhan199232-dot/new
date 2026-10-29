import { withPot } from "@/lib/http";
import { requireMember } from "@/lib/agent";
import { audit } from "@/lib/store";
import { tastePicks, TASTE_CATEGORIES } from "@/lib/qloo";
import { explainTastePicks, geminiConfigured } from "@/lib/gemini";
import type { Category } from "@/lib/types";

export const maxDuration = 60;

/**
 * Taste Picks. Body: { actor, location, category: "food" | "stay" | "activities" }.
 * Qloo Insights, seeded with the merchants this pot already paid and capped by the money left per member.
 * Suggestions only: nothing is paid until a member asks the agent to pay and the policy engine agrees.
 */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const category = String(b.category ?? "food") as Category;
  if (!TASTE_CATEGORIES[category]) throw new Error("Pick food, stay or activities");
  const result = await tastePicks(pot, String(b.location ?? ""), category);

  let summary = "";
  let model = "";
  const reasons: Record<string, string> = {};
  if (result.picks.length && geminiConfigured()) {
    try {
      const ctx = JSON.stringify({
        pot: pot.name,
        pastMerchants: result.seeds.map((s) => s.name),
        pastBills: pot.spends.slice(-6).map((s) => ({ what: s.description, category: s.category })),
        maxPriceLevel: result.maxPriceLevel,
        picks: result.picks.map((p) => ({ entityId: p.entityId, name: p.name, tags: p.tags, keywords: p.keywords, priceLevel: p.priceLevel, rating: p.rating, affinity: p.affinity })),
      });
      const ex = await explainTastePicks(ctx);
      summary = ex.summary;
      model = ex._model;
      for (const r of ex.reasons ?? []) if (r?.entityId && r?.why) reasons[r.entityId] = r.why;
    } catch {
      /* explanations are optional; Qloo picks still show */
    }
  }

  const seedText = result.seeds.length ? `seeded with ${result.seeds.map((s) => s.name).join(", ")}` : "no past merchants matched, so popular picks";
  audit(pot, {
    actor: "agent",
    kind: "agent_taste",
    summary: `Taste Picks for ${category} in ${result.location}: ${result.picks.length} places from Qloo (${seedText}, price level up to ${result.maxPriceLevel})`,
    reasoning: summary || undefined,
    data: { requestedBy: actor, location: result.location, category, picks: result.picks.map((p) => p.name), model: model || null },
  });

  return { taste: { ...result, summary, reasons, model } };
});
