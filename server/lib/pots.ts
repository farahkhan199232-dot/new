import { fail, type ActionRunContext } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import {
  CATEGORIES,
  computeSplits,
  dayKey,
  evaluateRules,
  formatMoney,
  parseJson,
  toMinor,
  type Category,
  type Rules,
  type SplitMode,
} from "./splitchai.js";

const AGENT_CALLERS = new Set(["tool", "a2a", "mcp", "automation", "webmcp"]);

/** True when the agent (or another agent) is calling, not a person in the UI. */
export function isAgentCaller(ctx?: Partial<ActionRunContext>): boolean {
  return Boolean(ctx?.caller && AGENT_CALLERS.has(ctx.caller));
}

export function requireUser(ctx?: Partial<ActionRunContext>): string {
  return ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
}

export function actorOf(ctx?: Partial<ActionRunContext>): string {
  return isAgentCaller(ctx) ? "agent" : (ctx?.userEmail ?? "you");
}

export type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function loadPot(potId: string, db: Db | Tx = getDb(), forUpdate = false) {
  const { pots, potShares } = schema;
  const q = db
    .select()
    .from(pots)
    .where(and(eq(pots.id, potId), accessFilter(pots, potShares)))
    .limit(1);
  const [pot] = forUpdate ? await q.for("update") : await q;
  if (!pot) fail("Pot not found.", { errorCode: "not_found", statusCode: 404 });
  return pot;
}

export function rulesOf(pot: typeof schema.pots.$inferSelect): Rules {
  return {
    perExpenseCap: pot.perExpenseCap,
    dailyCap: pot.dailyCap,
    allowedCategories: parseJson<Category[]>(pot.allowedCategories, [...CATEGORIES]),
    approvalsRequired: pot.approvalsRequired,
  };
}

export async function loadMembers(potId: string, db: Db | Tx = getDb()) {
  const m = schema.potMembers;
  return db
    .select({ id: m.id, name: m.name, email: m.email })
    .from(m)
    .where(eq(m.potId, potId))
    .orderBy(asc(m.createdAt), asc(m.name))
    .limit(100);
}

/** Accept a member id or a (case-insensitive) name, so people and the agent can say "Aisha". */
export function resolveMember(members: Array<{ id: string; name: string }>, ref: string): string {
  const r = ref.trim();
  const byId = members.find((m) => m.id === r);
  if (byId) return byId.id;
  const lower = r.toLowerCase();
  const exact = members.filter((m) => m.name.toLowerCase() === lower);
  if (exact.length === 1 && exact[0]) return exact[0].id;
  const prefix = members.filter((m) => m.name.toLowerCase().startsWith(lower));
  if (prefix.length === 1 && prefix[0]) return prefix[0].id;
  fail(
    `No single member matches "${ref}". Members: ${members.map((m) => m.name).join(", ")}.`,
    { errorCode: "unknown_member", statusCode: 400 },
  );
}

export async function logActivity(
  db: Db | Tx,
  pot: { id: string; orgId: string | null },
  ctx: Partial<ActionRunContext> | undefined,
  kind: string,
  summary: string,
) {
  await db.insert(schema.potActivity).values({
    id: crypto.randomUUID(),
    potId: pot.id,
    actor: actorOf(ctx),
    kind,
    summary,
    ownerEmail: requireUser(ctx),
    orgId: pot.orgId ?? null,
    createdAt: new Date().toISOString(),
  });
}

export interface ExpenseInput {
  description: string;
  amount: number | string;
  category: string;
  paidBy: string;
  splitMode?: SplitMode | undefined;
  splitWith?: string[] | undefined;
  exclude?: string[] | undefined;
  splitValues?: Record<string, number> | undefined;
  date?: string | undefined;
}

/** Add one expense inside an open transaction: split it, run the pot's rules, store the verdict. */
export async function insertExpense(
  tx: Tx,
  pot: typeof schema.pots.$inferSelect,
  members: Array<{ id: string; name: string }>,
  input: ExpenseInput,
  ctx: Partial<ActionRunContext> | undefined,
) {
  const ownerEmail = requireUser(ctx);
  let amount: number;
  try {
    amount = toMinor(input.amount);
  } catch {
    fail(`"${input.amount}" is not a valid amount (use a number like 2400 or 2400.50).`, {
      errorCode: "invalid_amount",
    });
  }
  if (amount <= 0) fail("Amount must be above zero.", { errorCode: "invalid_amount" });
  const category = input.category.trim().toLowerCase();
  if (!(CATEGORIES as readonly string[]).includes(category))
    fail(`Category must be one of ${CATEGORIES.join(", ")}.`, { errorCode: "invalid_category" });

  const memberIds = members.map((m) => m.id);
  const paidBy = resolveMember(members, input.paidBy);
  const mode: SplitMode = input.splitMode ?? "equal";
  let splits: Record<string, number>;
  try {
    if (mode === "equal") {
      const base = input.splitWith?.length ? input.splitWith.map((r) => resolveMember(members, r)) : memberIds;
      const out = new Set((input.exclude ?? []).map((r) => resolveMember(members, r)));
      const ids = base.filter((id) => !out.has(id));
      if (!ids.length) fail("Nobody is left to split this bill with.", { errorCode: "invalid_split" });
      splits = computeSplits(amount, { mode, participantIds: ids }, memberIds);
    } else {
      const values: Record<string, number> = {};
      for (const [ref, v] of Object.entries(input.splitValues ?? {})) {
        const id = resolveMember(members, ref);
        values[id] = mode === "exact" ? toMinor(v) : Number(v);
      }
      splits = computeSplits(amount, { mode, values }, memberIds);
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), { errorCode: "invalid_split" });
  }

  const spentOn =
    input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : dayKey(Date.now(), pot.timezone);
  const e = schema.expenses;
  const sameDay = await tx
    .select({ amount: e.amount })
    .from(e)
    .where(and(eq(e.potId, pot.id), eq(e.spentOn, spentOn), eq(e.status, "approved")))
    .limit(1000);
  const spentToday = sameDay.reduce((s, r) => s + r.amount, 0);
  const verdict = evaluateRules(rulesOf(pot), { currency: pot.currency, spentToday }, { amount, category });

  const row = {
    id: crypto.randomUUID(),
    potId: pot.id,
    description: input.description.trim().slice(0, 200),
    category,
    amount,
    paidBy,
    splitMode: mode,
    splits: JSON.stringify(splits),
    status: verdict.decision,
    approvals: "[]",
    checks: JSON.stringify(verdict.checks),
    reasons: JSON.stringify(verdict.reasons),
    source: isAgentCaller(ctx) ? "agent" : "ui",
    spentOn,
    ownerEmail,
    orgId: pot.orgId ?? null,
    createdAt: new Date().toISOString(),
  };
  await tx.insert(e).values(row);
  const payer = members.find((m) => m.id === paidBy)?.name ?? "someone";
  const verb =
    verdict.decision === "approved" ? "added" : verdict.decision === "pending_approval" ? "flagged for approval" : "blocked";
  await logActivity(
    tx,
    pot,
    ctx,
    "expense",
    `${row.description} · ${formatMoney(amount, pot.currency)} paid by ${payer} — ${verb} (${verdict.reasons.join("; ")})`,
  );
  return {
    id: row.id,
    description: row.description,
    amount,
    amountFormatted: formatMoney(amount, pot.currency),
    category,
    paidBy,
    paidByName: payer,
    splits: Object.fromEntries(
      Object.entries(splits).map(([id, s]) => [members.find((m) => m.id === id)?.name ?? id, formatMoney(s, pot.currency)]),
    ),
    status: verdict.decision,
    reasons: verdict.reasons,
    checks: verdict.checks,
  };
}
