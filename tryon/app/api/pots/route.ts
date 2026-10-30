import { json, fail } from "@/lib/http.ts";
import { savePot } from "@/lib/store.ts";
import { audit, newId } from "@/lib/pot.ts";
import { toMinor } from "@/lib/money.ts";
import type { GiftPot } from "@/lib/types.ts";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const recipient = String(b.recipient || "").trim().slice(0, 40);
    const names: string[] = (Array.isArray(b.members) ? b.members : String(b.members || "").split(","))
      .map((s: unknown) => String(s).trim().slice(0, 30)).filter(Boolean);
    if (!recipient) throw new Error("Who is the gift for?");
    if (names.length < 2) throw new Error("Add at least two friends to chip in");
    if (names.length > 12) throw new Error("Up to 12 friends per pot");
    const budget = toMinor(b.budget || "3500");
    if (budget < 10000) throw new Error("Budget should be at least ₹100");
    const pot: GiftPot = {
      id: newId(6), title: String(b.title || `${recipient}'s gift`).slice(0, 60), recipient,
      occasion: String(b.occasion || "Birthday").slice(0, 40), currency: "INR", budget,
      members: names.map((name, i) => ({ id: `m${i + 1}`, name })),
      hasPhoto: false, proposals: [], votes: {}, contributions: [], audit: [], createdAt: Date.now(),
    };
    audit(pot, "create", `Gift pot created for ${recipient} with ${names.join(", ")}`);
    await savePot(pot);
    return json({ pot });
  } catch (e) {
    return fail(e);
  }
}
