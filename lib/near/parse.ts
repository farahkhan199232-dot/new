import { generateJson } from "../gemini";

export interface ParsedRequest {
  to: string;
  amount_near: number;
  category: string;
  memo: string;
}

/** Plain words -> a spend request the member reviews and signs. Nothing is sent from here. */
export async function parseRequest(text: string, categories: string[], knownAccounts: string[]): Promise<ParsedRequest> {
  const out = await generateJson<ParsedRequest>(
    [{ text: JSON.stringify({ request: text.slice(0, 500), allowed_categories: categories, known_accounts: knownAccounts }) }],
    {
      type: "OBJECT",
      properties: {
        to: { type: "STRING", description: "NEAR account id of the payee, lowercase; empty if none given" },
        amount_near: { type: "NUMBER" },
        category: { type: "STRING", description: "one of allowed_categories if it fits, else the best single word" },
        memo: { type: "STRING", description: "short description of what it is for, under 80 chars" },
      },
      required: ["to", "amount_near", "category", "memo"],
    },
    "Extract a payment request for a group pot on NEAR. Amounts are in NEAR. If the payee is a short name that matches a known account, use the full known account id. Never invent an account id.",
    {},
    30_000,
  );
  return { to: String(out.to || "").trim().toLowerCase(), amount_near: Number(out.amount_near) || 0, category: String(out.category || "").toLowerCase(), memo: String(out.memo || "").slice(0, 120) };
}
