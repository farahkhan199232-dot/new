import type { Pot } from "./types";
import { splitEqual } from "./money";

export const DEMO_POT_ID = "demo";

/** PayPal sandbox personal account used as the demo payee (receives sandbox payouts). */
export const DEMO_PAYEE = process.env.DEMO_PAYEE_EMAIL || "sb-syijz53572713@personal.example.com";

/**
 * Seeded demo pot so judges can click through. Everything seeded is marked
 * `sample: true` and shown with a "sample" badge: no seeded entry claims a real
 * PayPal transaction. Real sandbox payments made in the demo are recorded normally.
 */
export function demoPot(now = Date.now()): Pot {
  const h = 3600_000;
  const members = [
    { id: "farah", name: "Farah", email: "farah@example.com" },
    { id: "aman", name: "Aman", email: "aman@example.com" },
    { id: "riya", name: "Riya", email: "riya@example.com" },
    { id: "kabir", name: "Kabir", email: "kabir@example.com" },
  ];
  const ids = members.map((m) => m.id);
  return {
    id: DEMO_POT_ID,
    name: "Goa Trip Pot",
    currency: "USD",
    timezone: "Asia/Kolkata",
    createdAt: now - 48 * h,
    createdBy: "farah",
    isDemo: true,
    members,
    contributionTarget: 6000,
    policy: { perBillCap: 4000, dailyCap: 9000, allowedCategories: ["food", "groceries", "transport", "stay"], approvalsRequired: 2 },
    contributions: [
      { id: "seed-c1", memberId: "farah", amount: 6000, method: "seed", ref: "sample", createdAt: now - 47 * h, sample: true },
      { id: "seed-c2", memberId: "aman", amount: 6000, method: "seed", ref: "sample", createdAt: now - 46 * h, sample: true },
      { id: "seed-c3", memberId: "riya", amount: 3000, method: "seed", ref: "sample", createdAt: now - 30 * h, sample: true },
    ],
    refunds: [],
    spends: [
      {
        id: "seed-s1",
        description: "Chai and bun maska at Café Goa",
        payeeEmail: DEMO_PAYEE,
        payeeName: "Café Goa",
        category: "food",
        amount: 1840,
        splits: splitEqual(1840, ids),
        status: "paid",
        requestedBy: "aman",
        approvals: [],
        createdAt: now - 26 * h,
        paidAt: now - 26 * h,
        sample: true,
      },
      {
        id: "seed-s2",
        description: "Beach villa deposit, night 2",
        payeeEmail: DEMO_PAYEE,
        payeeName: "Palolem Beach Villas",
        category: "stay",
        amount: 7200,
        splits: splitEqual(7200, ids),
        status: "pending_approval",
        requestedBy: "riya",
        approvals: ["aman"],
        createdAt: now - 3 * h,
        sample: true,
      },
    ],
    audit: [
      {
        id: "seed-a3",
        at: now - 3 * h,
        actor: "agent",
        kind: "policy_decision",
        decision: "needs_approval",
        spendId: "seed-s2",
        summary: "Held $72.00 to Palolem Beach Villas for approval",
        reasoning: "Villa deposit for all 4 members; categorised as stay. $72.00 is above the $40.00 per-bill cap, so it needs 2 approvals.",
        checks: [
          { name: "Category", ok: true, detail: "stay is allowed" },
          { name: "Funds", ok: true, detail: "$131.60 in pot" },
          { name: "Per-bill cap", ok: false, detail: "$72.00 vs cap $40.00" },
          { name: "Daily cap", ok: true, detail: "$0.00 spent today + $72.00 vs cap $90.00" },
        ],
        sample: true,
      },
      {
        id: "seed-a2",
        at: now - 26 * h,
        actor: "agent",
        kind: "policy_decision",
        decision: "auto_pay",
        spendId: "seed-s1",
        summary: "Auto-paid $18.40 to Café Goa (sample)",
        reasoning: "Food bill within the $40.00 per-bill cap and the $90.00 daily cap.",
        sample: true,
      },
      { id: "seed-a1", at: now - 48 * h, actor: "farah", kind: "pot_created", summary: "Farah created the pot", sample: true },
    ],
  };
}
