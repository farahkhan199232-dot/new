import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadMembers, loadPot, rulesOf } from "../server/lib/pots.js";
import { computeBalances, formatMoney, parseJson, suggestTransfers } from "../server/lib/splitchai.js";

export default defineAction({
  description:
    "Read one pot: members (with ids), rules, every member's balance, suggested settle-up transfers, recent expenses (with status and rule checks), settlements and the activity log. Amounts are minor units (paise/cents) plus a formatted string.",
  schema: z.object({ potId: z.string().describe("Pot id from list-pots or the current screen") }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({ view: "pots", to: `/pots/${encodeURIComponent(args.potId)}`, params: { potId: args.potId } }),
    label: "Open pot",
  }),
  run: async ({ potId }) => {
    const db = getDb();
    const pot = await loadPot(potId, db);
    const members = await loadMembers(potId, db);
    const e = schema.expenses;
    const s = schema.settlements;
    const a = schema.potActivity;
    const [expenseRows, settlementRows, activity] = await Promise.all([
      db.select().from(e).where(eq(e.potId, potId)).orderBy(desc(e.createdAt)).limit(200),
      db.select().from(s).where(eq(s.potId, potId)).orderBy(desc(s.createdAt)).limit(200),
      db
        .select({ id: a.id, actor: a.actor, kind: a.kind, summary: a.summary, createdAt: a.createdAt })
        .from(a)
        .where(eq(a.potId, potId))
        .orderBy(desc(a.createdAt))
        .limit(40),
    ]);
    const fmt = (n: number) => formatMoney(n, pot.currency);
    const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Former member";
    const expenses = expenseRows.map((x) => ({
      id: x.id,
      description: x.description,
      category: x.category,
      amount: x.amount,
      amountFormatted: fmt(x.amount),
      paidBy: x.paidBy,
      paidByName: name(x.paidBy),
      splitMode: x.splitMode,
      splits: parseJson<Record<string, number>>(x.splits, {}),
      status: x.status,
      approvals: parseJson<string[]>(x.approvals, []),
      checks: parseJson<Array<{ name: string; ok: boolean; detail: string }>>(x.checks, []),
      reasons: parseJson<string[]>(x.reasons, []),
      source: x.source,
      spentOn: x.spentOn,
      createdAt: x.createdAt,
    }));
    const settlements = settlementRows.map((x) => ({
      id: x.id,
      from: x.fromMember,
      fromName: name(x.fromMember),
      to: x.toMember,
      toName: name(x.toMember),
      amount: x.amount,
      amountFormatted: fmt(x.amount),
      note: x.note,
      source: x.source,
      createdAt: x.createdAt,
    }));
    const balances = computeBalances(
      members,
      expenses,
      settlements.map((x) => ({ fromMember: x.from, toMember: x.to, amount: x.amount })),
    ).map((b) => ({ ...b, netFormatted: fmt(b.net) }));
    const transfers = suggestTransfers(balances).map((t) => ({
      ...t,
      fromName: name(t.from),
      toName: name(t.to),
      amountFormatted: fmt(t.amount),
    }));
    const approved = expenses.filter((x) => x.status === "approved");
    return {
      pot: { id: pot.id, name: pot.name, currency: pot.currency, timezone: pot.timezone },
      rules: rulesOf(pot),
      members,
      balances,
      transfers,
      expenses,
      settlements,
      activity,
      totals: {
        approvedSpend: approved.reduce((t, x) => t + x.amount, 0),
        approvedSpendFormatted: fmt(approved.reduce((t, x) => t + x.amount, 0)),
        pendingCount: expenses.filter((x) => x.status === "pending_approval").length,
      },
    };
  },
});
