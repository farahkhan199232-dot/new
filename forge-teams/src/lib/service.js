// Core Chai Pot for Teams operations, shared by UI resolvers, Rovo actions and triggers.
import { listPots, getPot, savePot, deletePot } from './store.js';
import { parseExpense, CATEGORIES } from './parse.js';
import { evaluateSpend, potTotals, canApprove, validatePolicy, DEFAULT_POLICY, DECISION_LABEL } from './policy.js';
import { formatMoney, toMinor } from './money.js';
import { getIssue, commentDecision, setDecisionLabel, displayName } from './jira.js';

const rid = () => Math.random().toString(36).slice(2, 10);

export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

export async function createPot({ name, currency = 'USD', budget, ownerId, policy = {} }) {
  if (!name || !String(name).trim()) throw new Error('Pot name is required');
  const b = toMinor(budget, currency);
  if (!(b > 0)) throw new Error('Budget must be greater than zero');
  const pot = {
    id: `${slug(name) || 'pot'}-${rid().slice(0, 4)}`,
    name: String(name).trim(),
    currency,
    budget: b,
    ownerId: ownerId || null,
    policy: { ...DEFAULT_POLICY, autoApproveLimit: toMinor(Math.min(Number(budget) / 10, 5000), currency), hardCap: b, ...policy },
    entries: [],
    createdAt: Date.now(),
  };
  return savePot(pot);
}

export async function findPot(potRef) {
  const pots = await listPots();
  if (!pots.length) return null;
  if (!potRef) return pots[0];
  const r = String(potRef).toLowerCase();
  return pots.find((p) => p.id === potRef) || pots.find((p) => p.name.toLowerCase() === r) ||
    pots.find((p) => p.name.toLowerCase().includes(r) || r.includes(p.name.toLowerCase())) || pots[0];
}

/** Pick the pot for an issue: label pot-<slug> wins, else the given ref, else the first pot. */
export async function potForIssue(issue, potRef) {
  const lbl = (issue.labels || []).find((l) => l.startsWith('pot-'));
  if (lbl) {
    const pots = await listPots();
    const hit = pots.find((p) => slug(p.name) === lbl.slice(4) || p.id.startsWith(lbl.slice(4)));
    if (hit) return hit;
  }
  return findPot(potRef);
}

export function summarizePot(pot) {
  const t = potTotals(pot);
  const f = (n) => formatMoney(n, pot.currency);
  return {
    id: pot.id,
    name: pot.name,
    currency: pot.currency,
    budget: f(t.budget),
    spent: f(t.spent),
    pending: f(t.pending),
    remaining: f(t.remaining),
    usedPct: t.usedPct,
    byCategory: Object.fromEntries(Object.entries(t.byCategory).map(([k, v]) => [k, f(v)])),
    counts: t.counts,
    policy: {
      autoApproveLimit: f(pot.policy.autoApproveLimit),
      hardCap: f(pot.policy.hardCap),
      blockedCategories: pot.policy.blockedCategories,
    },
    raw: { ...t, autoApproveLimit: pot.policy.autoApproveLimit, hardCap: pot.policy.hardCap },
  };
}

function entryView(pot, e) {
  return { ...e, amountText: formatMoney(e.amount, pot.currency), statusLabel: DECISION_LABEL[e.status] || e.status };
}

export async function potDetail(potId) {
  const pot = await getPot(potId);
  if (!pot) return null;
  return { ...summarizePot(pot), policyRaw: pot.policy, entries: [...pot.entries].reverse().map((e) => entryView(pot, e)), categories: CATEGORIES };
}

/** Build a spend request from an issue (or raw text). */
export async function requestFromIssue(issueKey, pot) {
  const issue = await getIssue(issueKey);
  const text = `${issue.summary}\n${issue.description}`;
  const parsed = parseExpense(text, pot?.currency || 'USD');
  return { issue, parsed, text };
}

function toReq(parsed, extra) {
  return {
    amount: parsed.amount != null ? toMinor(parsed.amount, parsed.currency) : null,
    currency: parsed.currency,
    category: parsed.category,
    vendor: parsed.vendor,
    riskWords: parsed.riskWords,
    ...extra,
  };
}

/** Dry run: what would the policy say about this issue? Nothing is recorded. */
export async function previewIssue(issueKey, potRef) {
  const pots = await listPots();
  if (!pots.length) return { needsSetup: true };
  const issue = await getIssue(issueKey);
  const pot = await potForIssue(issue, potRef);
  const parsed = parseExpense(`${issue.summary}\n${issue.description}`, pot.currency);
  const req = toReq(parsed, { requesterId: issue.reporterId, issueKey });
  const verdict = evaluateSpend(pot, req);
  const existing = pot.entries.find((e) => e.issueKey === issueKey) || null;
  return {
    issue: { key: issue.key, summary: issue.summary, reporterName: issue.reporterName },
    pot: summarizePot(pot),
    pots: pots.map((p) => ({ id: p.id, name: p.name })),
    parsed: { ...parsed, amountText: req.amount ? formatMoney(req.amount, pot.currency) : null },
    verdict,
    existing: existing ? entryView(pot, existing) : null,
  };
}

/** Evaluate and record an issue's spend in the pot, comment + label the issue. */
export async function logIssue(issueKey, { potRef, actorId, overrides = {}, comment = true } = {}) {
  const issue = await getIssue(issueKey);
  const pot = await potForIssue(issue, potRef);
  if (!pot) throw new Error('No pot exists yet. Create one on the Chai Pot for Teams page first.');
  const parsed = { ...parseExpense(`${issue.summary}\n${issue.description}`, pot.currency), ...overrides };
  const req = toReq(parsed, { requesterId: issue.reporterId, issueKey });
  const verdict = evaluateSpend(pot, req);
  const now = Date.now();
  const prev = pot.entries.find((e) => e.issueKey === issueKey);
  if (prev && ['approved', 'rejected'].includes(prev.status)) {
    return { alreadyDecided: true, entry: entryView(pot, prev), pot: summarizePot(pot) };
  }
  const entry = {
    id: prev?.id || rid(),
    issueKey,
    summary: issue.summary.slice(0, 120),
    amount: req.amount || 0,
    category: req.category,
    vendor: req.vendor,
    requesterId: issue.reporterId,
    requesterName: issue.reporterName,
    status: verdict.decision,
    reasons: verdict.reasons,
    flags: verdict.flags,
    riskScore: verdict.riskScore,
    loggedBy: actorId || 'chai-pot',
    createdAt: prev?.createdAt || now,
    decidedAt: verdict.decision === 'pending' ? null : now,
    decidedBy: verdict.decision === 'pending' ? null : 'policy',
  };
  pot.entries = prev ? pot.entries.map((e) => (e.issueKey === issueKey ? entry : e)) : [...pot.entries, entry];
  await savePot(pot);
  const s = summarizePot(pot);
  if (comment) {
    const lines = [
      `${formatMoney(entry.amount, pot.currency)} · ${entry.category}${entry.vendor ? ` · ${entry.vendor}` : ''} → pot "${pot.name}"`,
      `Decision: ${DECISION_LABEL[entry.status]} — ${entry.reasons.join('; ')}`,
      ...entry.flags.map((f) => `⚠️ ${f}`),
      `Pot after this: ${s.remaining} left of ${s.budget} (${s.usedPct}% used)`,
    ];
    await commentDecision(issueKey, {
      title: DECISION_LABEL[entry.status],
      lines,
      footer: entry.status === 'pending' ? 'A teammate (not the requester) can approve or reject this in the Chai Pot panel on this issue.' : undefined,
    });
    await setDecisionLabel(issueKey, entry.status);
  }
  return { entry: entryView(pot, entry), pot: s };
}

/** Human approval / rejection of a pending entry. */
export async function decide(issueKey, decision, actorId, note = '') {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('decision must be approved or rejected');
  const pots = await listPots();
  const pot = pots.find((p) => p.entries.some((e) => e.issueKey === issueKey));
  if (!pot) throw new Error(`${issueKey} is not logged in any pot yet`);
  const entry = pot.entries.find((e) => e.issueKey === issueKey);
  if (entry.status !== 'pending') return { ok: false, why: `Already ${DECISION_LABEL[entry.status].toLowerCase()}`, entry: entryView(pot, entry) };
  const perm = canApprove(pot, entry, actorId);
  if (!perm.ok) return { ok: false, why: perm.why, entry: entryView(pot, entry) };
  if (decision === 'approved') {
    const left = pot.budget - pot.entries.filter((e) => e !== entry && ['approved', 'auto_approved', 'pending'].includes(e.status)).reduce((s, e) => s + e.amount, 0);
    if (entry.amount > left) return { ok: false, why: 'Not enough budget left to approve this', entry: entryView(pot, entry) };
  }
  entry.status = decision;
  entry.decidedAt = Date.now();
  entry.decidedBy = actorId;
  entry.decidedByName = await displayName(actorId);
  if (note) entry.note = String(note).slice(0, 300);
  await savePot(pot);
  const s = summarizePot(pot);
  await commentDecision(issueKey, {
    title: `${DECISION_LABEL[decision]} by ${entry.decidedByName || 'a teammate'}`,
    lines: [
      `${formatMoney(entry.amount, pot.currency)} · ${entry.category} → pot "${pot.name}"`,
      ...(note ? [`Note: ${note}`] : []),
      `Pot now: ${s.remaining} left of ${s.budget} (${s.usedPct}% used)`,
    ],
  });
  await setDecisionLabel(issueKey, decision);
  return { ok: true, entry: entryView(pot, entry), pot: s };
}

export async function updatePolicy(potId, patch, actorId) {
  const pot = await getPot(potId);
  if (!pot) throw new Error('Pot not found');
  if (pot.ownerId && actorId && pot.ownerId !== actorId) throw new Error('Only the pot owner can change its policy');
  const cur = pot.currency;
  const next = { ...pot.policy };
  if (patch.autoApproveLimit != null) next.autoApproveLimit = toMinor(patch.autoApproveLimit, cur);
  if (patch.hardCap != null) next.hardCap = toMinor(patch.hardCap, cur);
  if (patch.blockedCategories) next.blockedCategories = patch.blockedCategories.filter((c) => CATEGORIES.includes(c));
  if (patch.budget != null) pot.budget = toMinor(patch.budget, cur);
  const err = validatePolicy(next);
  if (err) throw new Error(err);
  pot.policy = next;
  await savePot(pot);
  return potDetail(potId);
}

export async function removePot(potId, actorId) {
  const pot = await getPot(potId);
  if (pot?.ownerId && actorId && pot.ownerId !== actorId) throw new Error('Only the pot owner can delete it');
  await deletePot(potId);
  return true;
}

export async function allSummaries() {
  const pots = await listPots();
  return pots.map(summarizePot);
}

export async function pendingApprovals(potRef) {
  const pots = potRef ? [await findPot(potRef)].filter(Boolean) : await listPots();
  const out = [];
  for (const pot of pots) {
    for (const e of pot.entries) if (e.status === 'pending') out.push({ pot: pot.name, ...entryView(pot, e) });
  }
  return out;
}

/** Policy check without an issue (used by the Rovo agent / MCP tool). */
export async function checkSpend({ amount, currency, category, vendor, description, potRef, requesterId }) {
  const pot = await findPot(potRef);
  if (!pot) return { error: 'No pots exist yet. Create one on the Chai Pot for Teams page in Jira (Apps menu).' };
  const parsed = parseExpense(`${description || ''} ${vendor ? `vendor: ${vendor}` : ''}`, pot.currency);
  const cat = CATEGORIES.includes(String(category || '').toLowerCase()) ? String(category).toLowerCase() : parsed.category;
  const cur = currency ? String(currency).toUpperCase() : pot.currency;
  const req = {
    amount: amount != null && Number(amount) > 0 ? toMinor(amount, cur) : (parsed.amount != null ? toMinor(parsed.amount, parsed.currency) : null),
    currency: cur,
    category: cat,
    vendor: vendor || parsed.vendor,
    riskWords: parsed.riskWords,
    requesterId,
  };
  const v = evaluateSpend(pot, req);
  return {
    pot: pot.name,
    request: { amount: req.amount ? formatMoney(req.amount, pot.currency) : null, currency: cur, category: cat, vendor: req.vendor },
    decision: DECISION_LABEL[v.decision],
    reasons: v.reasons,
    riskFlags: v.flags,
    riskScore: v.riskScore,
    checks: v.checks,
    potAfter: summarizePot(pot).remaining,
  };
}
