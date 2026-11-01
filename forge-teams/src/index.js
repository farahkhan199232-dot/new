import Resolver from '@forge/resolver';
import {
  allSummaries, potDetail, createPot, updatePolicy, removePot, previewIssue, logIssue, decide,
  pendingApprovals, checkSpend, findPot, summarizePot,
} from './lib/service.js';
import { seedDemo } from './lib/demo.js';
import { getIssue } from './lib/jira.js';

const resolver = new Resolver();
const safe = (fn) => async (req) => {
  try { return { ok: true, data: await fn(req) }; } catch (e) { console.error(e); return { ok: false, error: String(e.message || e) }; }
};

resolver.define('listPots', safe(() => allSummaries()));
resolver.define('getPot', safe(({ payload }) => potDetail(payload.potId)));
resolver.define('createPot', safe(({ payload, context }) => createPot({ ...payload, ownerId: context.accountId })));
resolver.define('updatePolicy', safe(({ payload, context }) => updatePolicy(payload.potId, payload.patch, context.accountId)));
resolver.define('deletePot', safe(({ payload, context }) => removePot(payload.potId, context.accountId)));
resolver.define('previewIssue', safe(({ payload, context }) => previewIssue(context.extension?.issue?.key || payload.issueKey, payload.potId)));
resolver.define('logIssue', safe(({ payload, context }) => logIssue(context.extension?.issue?.key || payload.issueKey, { potRef: payload.potId, actorId: context.accountId })));
resolver.define('decide', safe(({ payload, context }) => decide(context.extension?.issue?.key || payload.issueKey, payload.decision, context.accountId, payload.note)));
resolver.define('pending', safe(() => pendingApprovals()));
resolver.define('seedDemo', safe(({ payload, context }) => seedDemo({ projectKey: payload.projectKey, ownerId: context.accountId })));
resolver.define('whoami', safe(({ context }) => ({ accountId: context.accountId })));

export const handler = resolver.getDefinitions();

// ---------- Rovo actions (also exposed as MCP tools) ----------
const issueKeyFrom = (payload) => {
  const k = payload?.issueKey && /^[A-Z][A-Z0-9_]+-\d+$/.test(String(payload.issueKey).trim()) ? String(payload.issueKey).trim() : null;
  return k || payload?.context?.jira?.issueKey || null;
};

export async function actionPotSummary(payload) {
  const pots = await allSummaries();
  if (!pots.length) return 'No Chai Pot budgets exist yet. Open Apps → Chai Pot for Teams in Jira to create one.';
  const want = payload?.potName ? await findPot(payload.potName) : null;
  const list = want ? [summarizePot(want)] : pots;
  return { pots: list.map(({ raw, ...p }) => p), pendingApprovals: await pendingApprovals(want?.id) };
}

export async function actionCheckSpend(payload, context) {
  return checkSpend({
    amount: payload.amount, currency: payload.currency, category: payload.category, vendor: payload.vendor,
    description: payload.description, potRef: payload.potName, requesterId: context?.principal?.accountId || payload?.context?.accountId,
  });
}

export async function actionLogExpense(payload, context) {
  const key = issueKeyFrom(payload);
  if (!key) return 'Tell me which Jira work item holds the expense request (e.g. TEAM-12), or open it and ask again.';
  const r = await logIssue(key, { potRef: payload.potName, actorId: context?.principal?.accountId });
  if (r.alreadyDecided) return { issueKey: key, note: `Already ${r.entry.statusLabel}`, entry: r.entry };
  return { issueKey: key, decision: r.entry.statusLabel, amount: r.entry.amountText, category: r.entry.category, vendor: r.entry.vendor, reasons: r.entry.reasons, riskFlags: r.entry.flags, potRemaining: r.pot.remaining, potBudget: r.pot.budget };
}

export async function actionPending(payload) {
  const list = await pendingApprovals(payload?.potName);
  if (!list.length) return 'Nothing is waiting for approval.';
  return list.map((e) => ({ pot: e.pot, issueKey: e.issueKey, summary: e.summary, amount: e.amountText, requester: e.requesterName, reasons: e.reasons, riskFlags: e.flags, riskScore: e.riskScore }));
}

export async function actionReadIssue(payload) {
  const key = issueKeyFrom(payload);
  if (!key) return 'No work item key given.';
  const i = await getIssue(key);
  return { key: i.key, summary: i.summary, description: i.description.slice(0, 2000), reporter: i.reporterName, labels: i.labels };
}

// ---------- Jira event trigger: auto-review new expense requests ----------
export async function onIssueCreated(event) {
  try {
    const key = event?.issue?.key;
    if (!key) return;
    const issue = await getIssue(key);
    const looksLikeExpense = issue.labels.includes('expense') || /^(expense|spend|reimburse|purchase)\b/i.test(issue.summary) || /expense/i.test(issue.issueType);
    if (!looksLikeExpense) return;
    const pots = await allSummaries();
    if (!pots.length) return;
    await logIssue(key, { actorId: 'chai-pot-trigger' });
  } catch (e) {
    console.error('onIssueCreated failed', e);
  }
}
