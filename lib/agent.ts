import type { Category, Pot, ReceiptItem, Spend } from "./types";
import { CATEGORIES } from "./types";
import { convertMinor, formatMoney, majorToMinor, splitEqual } from "./money";
import { evaluatePolicy, isEmail, spentOnDay } from "./policy";
import { computeLedger } from "./ledger";
import { AI_MODEL_LABEL as GEMINI_MODEL, interpretRequest, parseReceipt, type ReceiptParse } from "./gemini";
import { createPayout, getPayoutBatch, paypalConfigured, PayPalNotConfigured } from "./paypal";
import { audit, newId } from "./store";
import { reviewHeldSpend } from "./nebius";

/**
 * The Chai Pot agent. Gemini interprets (receipt photo or plain-language request);
 * the deterministic policy engine decides; PayPal Payouts executes. Every step is
 * written to the pot's audit log with the model's reasoning and the policy checks.
 */

export const memberName = (pot: Pot, id: string) => (id === "agent" ? "Agent" : pot.members.find((m) => m.id === id)?.name ?? id);

export function requireMember(pot: Pot, actor: unknown): string {
  if (typeof actor !== "string" || !pot.members.some((m) => m.id === actor)) throw new Error("Pick which member you are first");
  return actor;
}

/** After approvals the caps are lifted; say so instead of printing the sentinel cap value. */
function liftedCapChecks(checks: { name: string; ok: boolean; detail: string }[], why: string) {
  return checks.map((c) =>
    c.name === "Per-bill cap" || c.name === "Daily cap" ? { ...c, ok: true, detail: `Lifted: ${why}` } : c,
  );
}

function toCategory(c: string): Category {
  return (CATEGORIES as readonly string[]).includes(c) ? (c as Category) : "other";
}

/** Map names the model returned to member ids; empty or unknown -> everyone. */
function resolveSplit(pot: Pot, names: string[]): string[] {
  const ids = new Set<string>();
  for (const n of names) {
    const q = n.trim().toLowerCase();
    if (!q || q === "everyone" || q === "all") continue;
    const m = pot.members.find((x) => x.name.toLowerCase() === q || x.name.toLowerCase().startsWith(q) || q.startsWith(x.name.toLowerCase()));
    if (m) ids.add(m.id);
  }
  return ids.size ? [...ids] : pot.members.map((m) => m.id);
}

function toPotCurrency(pot: Pot, amountMajor: number, currency: string | null) {
  const minor = majorToMinor(amountMajor);
  const cur = (currency || pot.currency).toUpperCase();
  if (cur === pot.currency) return { amount: minor };
  const { amount, rate } = convertMinor(minor, cur, pot.currency);
  return { amount, original: { amount: minor, currency: cur, rate } };
}

interface Proposal {
  description: string;
  payeeEmail: string;
  payeeName?: string;
  category: Category;
  amount: number;
  original?: Spend["original"];
  splitAmong: string[];
  items?: ReceiptItem[];
  reasoning: string;
  requestedBy: string;
  source: Record<string, unknown>;
}

/** Policy check + create the spend + pay or hold. Mutates pot. */
async function decideAndAct(pot: Pot, p: Proposal): Promise<Spend> {
  const ledger = computeLedger(pot);
  const result = evaluatePolicy(
    pot.policy,
    { currency: pot.currency, potBalance: ledger.totals.potBalance, spentToday: spentOnDay(pot, Date.now()) },
    { amount: p.amount, category: p.category, payeeEmail: p.payeeEmail },
  );
  const spend: Spend = {
    id: newId(),
    description: p.description,
    payeeEmail: p.payeeEmail.trim().toLowerCase(),
    payeeName: p.payeeName,
    category: p.category,
    amount: p.amount,
    original: p.original,
    splits: splitEqual(p.amount, p.splitAmong),
    status: result.decision === "reject" ? "rejected" : "pending_approval",
    requestedBy: p.requestedBy,
    approvals: [],
    createdAt: Date.now(),
    items: p.items,
  };
  if (result.decision === "reject") spend.rejectedBy = "agent";
  pot.spends.unshift(spend);

  const fx = p.original
    ? ` Converted ${formatMoney(p.original.amount, p.original.currency)} at indicative rate ${p.original.rate.toFixed(4)}.`
    : "";
  const verb = { auto_pay: "Approved", needs_approval: "Held for approval:", reject: "Rejected" }[result.decision];
  audit(pot, {
    actor: "agent",
    kind: "policy_decision",
    decision: result.decision,
    spendId: spend.id,
    checks: result.checks,
    summary: `${verb} ${formatMoney(p.amount, pot.currency)} to ${p.payeeName || p.payeeEmail || "unknown payee"} (${result.reasons.join("; ")})`,
    reasoning: `${p.reasoning}${fx}`.trim(),
    data: { model: GEMINI_MODEL, requestedBy: memberName(pot, p.requestedBy), ...p.source },
  });

  if (result.decision === "auto_pay") await executeSpend(pot, spend);
  if (result.decision === "needs_approval") await addRiskReview(pot, spend, result.reasons);
  return spend;
}

/** Nemotron 3 Ultra writes an advisory risk review for a held bill (Nebius build only; never blocks the flow). */
async function addRiskReview(pot: Pot, spend: Spend, reasons: string[]) {
  const history = pot.spends
    .filter((s) => s.id !== spend.id)
    .slice(0, 15)
    .map((s) => `- ${new Date(s.createdAt).toISOString().slice(0, 10)} ${formatMoney(s.amount, pot.currency)} ${s.category} to ${s.payeeName || s.payeeEmail} (${s.status})`)
    .join("\n");
  const context = [
    `Pot: ${pot.name} (${pot.currency}), ${pot.members.length} members: ${pot.members.map((m) => m.name).join(", ")}`,
    `Policy: per-bill cap ${formatMoney(pot.policy.perBillCap, pot.currency)}, daily cap ${formatMoney(pot.policy.dailyCap, pot.currency)}, approvals needed ${pot.policy.approvalsRequired}, allowed categories ${pot.policy.allowedCategories.join(", ")}`,
    `Held bill: ${spend.description}; ${formatMoney(spend.amount, pot.currency)}; category ${spend.category}; payee ${spend.payeeName || ""} <${spend.payeeEmail}>; requested by ${memberName(pot, spend.requestedBy)}; split among ${Object.keys(spend.splits).map((id) => memberName(pot, id)).join(", ")}`,
    `Why the policy held it: ${reasons.join("; ")}`,
    `Recent bills:\n${history || "(none)"}`,
  ].join("\n");
  const r = await reviewHeldSpend(context);
  if (!r) return;
  spend.review = { risk: r.risk, summary: r.summary, questions: (r.questions_for_approvers ?? []).slice(0, 3), model: r._model };
  audit(pot, {
    actor: "agent",
    kind: "risk_review",
    spendId: spend.id,
    summary: `Risk review (${r.risk}) for ${formatMoney(spend.amount, pot.currency)} to ${spend.payeeName || spend.payeeEmail}`,
    reasoning: [r.summary, ...(r.questions_for_approvers ?? []).slice(0, 3).map((q) => `Check: ${q}`)].join(" "),
    data: { model: r._model, provider: "Nebius Token Factory", advisory: true },
  });
}

/** Send the PayPal payout. Never marks a spend paid unless PayPal accepted it. */
export async function executeSpend(pot: Pot, spend: Spend): Promise<void> {
  try {
    if (!paypalConfigured()) throw new PayPalNotConfigured();
    const out = await createPayout({
      // Deterministic per bill so a retry can't pay twice. pot.createdAt is part of it because
      // "Reset demo" re-seeds the same bill ids, and PayPal rejects a reused sender_batch_id.
      senderBatchId: `chaipot-${pot.id}-${pot.createdAt.toString(36)}-${spend.id}`.slice(0, 127),
      email: spend.payeeEmail,
      amount: spend.amount,
      currency: pot.currency,
      note: `${spend.description} — paid by the ${pot.name} Chai Pot agent`,
    });
    spend.status = "paid";
    spend.paidAt = Date.now();
    // A seeded bill approved in the demo is now a real sandbox payout, not a sample.
    spend.sample = false;
    spend.payout = { batchId: out.batchId, status: out.status };
    spend.error = undefined;
    audit(pot, {
      actor: "agent",
      kind: "payout",
      spendId: spend.id,
      summary: `Sent ${formatMoney(spend.amount, pot.currency)} to ${spend.payeeEmail} via PayPal Payouts (batch ${out.batchId}, ${out.status})`,
      data: { batchId: out.batchId, status: out.status },
    });
  } catch (e) {
    spend.status = "failed";
    spend.error = (e as Error).message;
    audit(pot, { actor: "agent", kind: "payout_failed", spendId: spend.id, summary: `Payout failed: ${spend.error}` });
  }
}

export async function syncPayout(pot: Pot, spend: Spend) {
  if (!spend.payout?.batchId) return;
  const s = await getPayoutBatch(spend.payout.batchId);
  spend.payout = { ...spend.payout, ...s };
}

/** Plain-language request -> Gemini -> policy -> act. */
export async function handleTextRequest(pot: Pot, actor: string, text: string) {
  const requester = memberName(pot, actor);
  const it = await interpretRequest({
    text,
    potCurrency: pot.currency,
    members: pot.members.map((m) => m.name),
    requester,
    allowed: pot.policy.allowedCategories,
  });
  const missing = [...(it.missing_info ?? [])];
  if (!it.is_payment_request) missing.push("a payment request");
  if (!(typeof it.amount === "number" && it.amount > 0) && !missing.some((m) => m.includes("amount"))) missing.push("amount");
  if (!(it.payee_email && isEmail(it.payee_email)) && !missing.some((m) => m.includes("email"))) missing.push("payee email");
  if (missing.length) {
    audit(pot, {
      actor: "agent",
      kind: "agent_needs_info",
      summary: `Need more info from ${requester}: ${missing.join(", ")}`,
      reasoning: it.reasoning,
      data: { request: text, model: it._model, interpretation: it },
    });
    return { spend: null, interpretation: it, missing };
  }
  const conv = toPotCurrency(pot, it.amount!, it.currency);
  const spend = await decideAndAct(pot, {
    description: it.description || "Group bill",
    payeeEmail: it.payee_email!,
    payeeName: it.payee_name ?? undefined,
    category: toCategory(it.category),
    ...conv,
    splitAmong: resolveSplit(pot, it.split_among ?? []),
    reasoning: it.reasoning,
    requestedBy: actor,
    source: { request: text, interpretation: it, model: it._model },
  });
  return { spend, interpretation: it, missing: [] };
}

/** Receipt photo -> itemized JSON + suggested equal split. Stored in the audit log for the pay step. */
export async function handleReceipt(pot: Pot, actor: string, imageBase64: string, mimeType: string) {
  const r = await parseReceipt(imageBase64, mimeType);
  if (!(r.total > 0)) throw new Error(`Could not read a total from this receipt${r.notes ? `: ${r.notes}` : ""}`);
  const conv = toPotCurrency(pot, r.total, r.currency);
  const rate = conv.original?.rate ?? 1;
  const items: ReceiptItem[] = (r.items ?? []).map((i) => ({
    name: i.name,
    quantity: i.quantity,
    total: Math.round(majorToMinor(Math.max(0, i.total)) * rate),
  }));
  const everyone = pot.members.map((m) => m.id);
  const entry = audit(pot, {
    actor: "agent",
    kind: "agent_receipt",
    summary: `Read receipt from ${r.merchant}: ${items.length} items, total ${formatMoney(conv.amount, pot.currency)}`,
    reasoning: r.notes || undefined,
    data: {
      model: r._model,
      requestedBy: memberName(pot, actor),
      requestedById: actor,
      receipt: r,
      amount: conv.amount,
      original: conv.original,
      category: toCategory(r.category),
      items,
      suggestedSplit: splitEqual(conv.amount, everyone),
    },
  });
  return entry;
}

/** Pay a receipt the agent already read. Amount comes from the stored parse, not the client. */
export async function payReceipt(pot: Pot, actor: string, receiptAuditId: string, payeeEmail: string, splitAmong: string[]) {
  const e = pot.audit.find((a) => a.id === receiptAuditId && a.kind === "agent_receipt");
  if (!e?.data) throw new Error("Receipt not found; upload it again");
  const d = e.data as { receipt: ReceiptParse; amount: number; original?: Spend["original"]; category: Category; items: ReceiptItem[] };
  if ((e.data as { spendId?: string }).spendId) throw new Error("This receipt was already submitted");
  const ids = splitAmong.filter((id) => pot.members.some((m) => m.id === id));
  const spend = await decideAndAct(pot, {
    description: `${d.receipt.merchant}${d.receipt.date ? ` (${d.receipt.date})` : ""}`,
    payeeEmail,
    payeeName: d.receipt.merchant,
    category: d.category,
    amount: d.amount,
    original: d.original,
    splitAmong: ids.length ? ids : pot.members.map((m) => m.id),
    items: d.items,
    reasoning: `Receipt total read by the agent; split equally between ${(ids.length ? ids : pot.members.map((m) => m.id)).map((i) => memberName(pot, i)).join(", ")}.`,
    requestedBy: actor,
    source: { receiptAuditId, model: (e.data as { model?: string }).model ?? GEMINI_MODEL },
  });
  (e.data as { spendId?: string }).spendId = spend.id;
  return spend;
}

export async function approveSpend(pot: Pot, spend: Spend, actor: string) {
  if (spend.status !== "pending_approval") throw new Error("This bill is not waiting for approval");
  if (actor === spend.requestedBy) throw new Error("The requester can't approve their own bill");
  if (spend.approvals.includes(actor)) throw new Error("You already approved this");
  spend.approvals.push(actor);
  audit(pot, {
    actor,
    kind: "approval",
    spendId: spend.id,
    summary: `${memberName(pot, actor)} approved ${spend.description} (${spend.approvals.length}/${pot.policy.approvalsRequired})`,
  });
  if (spend.approvals.length < pot.policy.approvalsRequired) return;

  // Approvals lift the caps only. Category, funds and payee are re-checked now.
  const ledger = computeLedger(pot);
  const r = evaluatePolicy(
    { ...pot.policy, perBillCap: Number.MAX_SAFE_INTEGER, dailyCap: Number.MAX_SAFE_INTEGER },
    { currency: pot.currency, potBalance: ledger.totals.potBalance, spentToday: 0 },
    { amount: spend.amount, category: spend.category, payeeEmail: spend.payeeEmail },
  );
  if (r.decision === "reject") {
    spend.status = "rejected";
    spend.rejectedBy = "agent";
    audit(pot, {
      actor: "agent",
      kind: "policy_decision",
      decision: "reject",
      spendId: spend.id,
      checks: liftedCapChecks(r.checks, `${pot.policy.approvalsRequired} member approvals`),
      summary: `Approved by members but blocked at payment time: ${r.reasons.join("; ")}`,
    });
    return;
  }
  audit(pot, {
    actor: "agent",
    kind: "policy_decision",
    decision: "auto_pay",
    spendId: spend.id,
    checks: liftedCapChecks(r.checks, `${pot.policy.approvalsRequired} member approvals`),
    summary: `${pot.policy.approvalsRequired} approvals reached; paying ${formatMoney(spend.amount, pot.currency)}`,
  });
  await executeSpend(pot, spend);
}

export function rejectSpend(pot: Pot, spend: Spend, actor: string) {
  if (spend.status !== "pending_approval") throw new Error("This bill is not waiting for approval");
  spend.status = "rejected";
  spend.rejectedBy = actor;
  audit(pot, { actor, kind: "rejection", spendId: spend.id, summary: `${memberName(pot, actor)} rejected ${spend.description}` });
}

/** Retry a payout that failed (e.g. sandbox was not configured yet). Funds/category/payee re-checked. */
export async function retrySpend(pot: Pot, spend: Spend, actor: string) {
  if (spend.status !== "failed") throw new Error("Only failed payouts can be retried");
  const ledger = computeLedger(pot);
  const r = evaluatePolicy(
    { ...pot.policy, perBillCap: Number.MAX_SAFE_INTEGER, dailyCap: Number.MAX_SAFE_INTEGER },
    { currency: pot.currency, potBalance: ledger.totals.potBalance, spentToday: 0 },
    { amount: spend.amount, category: spend.category, payeeEmail: spend.payeeEmail },
  );
  audit(pot, { actor, kind: "policy_decision", decision: r.decision === "reject" ? "reject" : "auto_pay", spendId: spend.id, checks: liftedCapChecks(r.checks, "caps were checked when the bill was first decided"), summary: `${memberName(pot, actor)} retried the payout for ${spend.description}` });
  if (r.decision === "reject") {
    spend.status = "rejected";
    spend.rejectedBy = "agent";
    return;
  }
  await executeSpend(pot, spend);
}
