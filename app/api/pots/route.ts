import { newId, savePot, audit } from "@/lib/store";
import { toMinor } from "@/lib/money";
import { isEmail, validatePolicy } from "@/lib/policy";
import { CATEGORIES, CURRENCIES, type Category, type Currency, type Member, type Pot } from "@/lib/types";
import { fail, json } from "@/lib/http";

const isWallet = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

/** Create a pot. Body: { name, currency, members:[{name,email?,wallet?}], contributionTarget, policy:{...}, usdcTreasury? } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const name = String(b.name ?? "").trim().slice(0, 60);
    if (!name) throw new Error("Give the pot a name");
    const currency = (CURRENCIES.includes(b.currency) ? b.currency : "USD") as Currency;
    const raw: { name?: string; email?: string; wallet?: string }[] = Array.isArray(b.members) ? b.members : [];
    const members: Member[] = [];
    for (const m of raw.slice(0, 20)) {
      const n = String(m.name ?? "").trim().slice(0, 40);
      const email = String(m.email ?? "").trim().toLowerCase();
      const wallet = String(m.wallet ?? "").trim().toLowerCase();
      if (!n && !email && !wallet) continue;
      if (email && !isEmail(email)) throw new Error(`Invalid email: ${email}`);
      if (wallet && !isWallet(wallet)) throw new Error(`Invalid wallet address: ${wallet}`);
      if (!email && !wallet) throw new Error(`Add an email or wallet for ${n || "each member"}`);
      members.push({ id: newId(5), name: n || email.split("@")[0] || `${wallet.slice(0, 6)}…`, email: email || undefined, wallet: wallet || undefined });
    }
    if (members.length < 2) throw new Error("A pot needs at least 2 members");
    const cats = (Array.isArray(b.policy?.allowedCategories) ? b.policy.allowedCategories : []).filter((c: string) =>
      (CATEGORIES as readonly string[]).includes(c),
    ) as Category[];
    const policy = {
      perBillCap: toMinor(b.policy?.perBillCap ?? 0),
      dailyCap: toMinor(b.policy?.dailyCap ?? 0),
      allowedCategories: cats,
      approvalsRequired: Math.min(Number(b.policy?.approvalsRequired ?? 1), members.length - 1),
    };
    const err = validatePolicy(policy);
    if (err) throw new Error(err);
    const treasury = String(b.usdcTreasury ?? "").trim().toLowerCase();
    if (treasury && !isWallet(treasury)) throw new Error("Invalid USDC treasury address");
    const pot: Pot = {
      id: newId(6),
      name,
      currency,
      timezone: typeof b.timezone === "string" && b.timezone.length < 64 ? b.timezone : "Asia/Kolkata",
      createdAt: Date.now(),
      createdBy: members[0].id,
      members,
      contributionTarget: toMinor(b.contributionTarget ?? 0),
      policy,
      usdcTreasury: treasury || undefined,
      contributions: [],
      refunds: [],
      spends: [],
      audit: [],
    };
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: pot.timezone });
    } catch {
      pot.timezone = "Asia/Kolkata";
    }
    audit(pot, { actor: members[0].id, kind: "pot_created", summary: `${members[0].name} created ${name} with ${members.length} members` });
    await savePot(pot);
    return json({ pot }, 201);
  } catch (e) {
    return fail(e);
  }
}
