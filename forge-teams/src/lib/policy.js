import { formatMoney } from './money.js';

/**
 * Deterministic team spend-policy engine. Rovo (the LLM) only interprets a request;
 * whether a spend is approved is decided here, by rules the pot owner sets.
 *
 *  reject          -> invalid amount, wrong currency, blocked category, over the hard cap,
 *                     or not enough budget left in the pot
 *  needs_approval  -> over the auto-approve limit, or any risk flag raised
 *  auto_approved   -> within every limit and no risk flags
 */

export const DEFAULT_POLICY = {
  autoApproveLimit: 5000_00, // minor units
  hardCap: 50000_00,
  blockedCategories: ['gifts'],
  monthlyCategoryCaps: {}, // e.g. { meals: 20000_00 }
  approverAccountIds: [], // empty = any teammate except the requester
  splitWindowDays: 7,
};

const DAY = 24 * 3600 * 1000;

export function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Money that counts against the budget: approved + auto-approved + pending (committed). */
export function committed(entries) {
  return entries
    .filter((e) => ['approved', 'auto_approved', 'pending'].includes(e.status))
    .reduce((s, e) => s + e.amount, 0);
}

export function spent(entries) {
  return entries.filter((e) => ['approved', 'auto_approved'].includes(e.status)).reduce((s, e) => s + e.amount, 0);
}

export function potTotals(pot) {
  const entries = pot.entries || [];
  const spentMinor = spent(entries);
  const pendingMinor = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of entries) {
    if (!['approved', 'auto_approved'].includes(e.status)) continue;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }
  return {
    budget: pot.budget,
    spent: spentMinor,
    pending: pendingMinor,
    remaining: pot.budget - spentMinor - pendingMinor,
    usedPct: pot.budget > 0 ? Math.round(((spentMinor + pendingMinor) / pot.budget) * 100) : 0,
    byCategory,
    counts: {
      total: entries.length,
      pending: entries.filter((e) => e.status === 'pending').length,
      rejected: entries.filter((e) => e.status === 'rejected').length,
      flagged: entries.filter((e) => (e.flags || []).length > 0).length,
    },
  };
}

/**
 * @param pot      { currency, budget, policy, entries }
 * @param req      { amount (minor), currency, category, vendor, requesterId, text, issueKey, riskWords }
 * @param now      timestamp
 */
export function evaluateSpend(pot, req, now = Date.now()) {
  const policy = { ...DEFAULT_POLICY, ...(pot.policy || {}) };
  const cur = pot.currency;
  const fmt = (n) => formatMoney(n, cur);
  const entries = (pot.entries || []).filter((e) => e.issueKey !== req.issueKey || !req.issueKey);
  const checks = [];
  const hard = [];
  const soft = [];
  const flags = [...(req.riskWords || [])];

  const amountOk = Number.isInteger(req.amount) && req.amount > 0;
  checks.push({ name: 'Amount', ok: amountOk, detail: amountOk ? fmt(req.amount) : 'No amount found in the request' });
  if (!amountOk) hard.push('no valid amount');

  const curOk = !req.currency || req.currency === cur;
  checks.push({ name: 'Currency', ok: curOk, detail: curOk ? cur : `${req.currency} request, but this pot is in ${cur}` });
  if (!curOk) hard.push(`currency ${req.currency} does not match pot currency ${cur}`);

  const catOk = !policy.blockedCategories.includes(req.category);
  checks.push({ name: 'Category', ok: catOk, detail: catOk ? `${req.category} is allowed` : `${req.category} is blocked by policy` });
  if (!catOk) hard.push(`category "${req.category}" is blocked`);

  if (amountOk) {
    const capOk = req.amount <= policy.hardCap;
    checks.push({ name: 'Hard cap', ok: capOk, detail: `${fmt(req.amount)} vs hard cap ${fmt(policy.hardCap)}` });
    if (!capOk) hard.push('over the hard cap — needs a purchase order, not a pot spend');

    const left = pot.budget - committed(entries);
    const fundsOk = req.amount <= left;
    checks.push({ name: 'Budget left', ok: fundsOk, detail: `${fmt(left)} left of ${fmt(pot.budget)}${fundsOk ? '' : `, short by ${fmt(req.amount - left)}`}` });
    if (!fundsOk) hard.push('not enough budget left in the pot');

    const catCap = policy.monthlyCategoryCaps?.[req.category];
    if (catCap) {
      const mk = monthKey(now);
      const used = entries
        .filter((e) => e.category === req.category && monthKey(e.createdAt) === mk && ['approved', 'auto_approved', 'pending'].includes(e.status))
        .reduce((s, e) => s + e.amount, 0);
      const ok = used + req.amount <= catCap;
      checks.push({ name: `Monthly ${req.category} cap`, ok, detail: `${fmt(used)} used + ${fmt(req.amount)} vs ${fmt(catCap)}` });
      if (!ok) soft.push(`would exceed the monthly ${req.category} cap`);
    }

    const autoOk = req.amount <= policy.autoApproveLimit;
    checks.push({ name: 'Auto-approve limit', ok: autoOk, detail: `${fmt(req.amount)} vs ${fmt(policy.autoApproveLimit)}` });
    if (!autoOk) soft.push('over the auto-approve limit');

    // Split-purchase detection: same requester + same vendor within N days, each under
    // the auto limit but together over it.
    if (req.vendor) {
      const since = now - policy.splitWindowDays * DAY;
      const related = entries.filter(
        (e) => e.createdAt >= since && e.requesterId && e.requesterId === req.requesterId &&
          e.vendor && e.vendor.toLowerCase() === req.vendor.toLowerCase() && e.status !== 'rejected',
      );
      const total = related.reduce((s, e) => s + e.amount, 0) + req.amount;
      if (related.length && autoOk && total > policy.autoApproveLimit) {
        flags.push(`Possible split purchase: ${related.length + 1} requests to ${req.vendor} in ${policy.splitWindowDays} days total ${fmt(total)}`);
      }
      // Duplicate detection: same amount + vendor in the last 30 days.
      const dup = entries.find((e) => e.amount === req.amount && e.vendor && e.vendor.toLowerCase() === req.vendor.toLowerCase() && e.createdAt >= now - 30 * DAY && e.status !== 'rejected');
      if (dup) flags.push(`Possible duplicate of ${dup.issueKey || 'an earlier request'} (same amount and vendor)`);
    }
    if (req.amount >= Math.max(10000_00, policy.autoApproveLimit) && req.amount % 1000_00 === 0) flags.push('Large round-number amount — ask for an itemised receipt');
  }

  if (flags.length) soft.push(`${flags.length} risk flag${flags.length === 1 ? '' : 's'} raised`);

  let decision = 'auto_approved';
  let reasons = ['within all limits, no risk flags'];
  if (hard.length) { decision = 'rejected'; reasons = hard; }
  else if (soft.length) { decision = 'pending'; reasons = [...soft, 'needs a teammate\'s approval']; }

  const riskScore = Math.min(10, (hard.length ? 6 : 0) + soft.length * 2 + flags.length * 2);
  return { decision, reasons, checks, flags, riskScore };
}

/** Who may approve? Approvers list if set, else any teammate; never the requester. */
export function canApprove(pot, entry, accountId) {
  if (!accountId) return { ok: false, why: 'Unknown user' };
  if (entry.requesterId && entry.requesterId === accountId) return { ok: false, why: 'Requesters cannot approve their own spend' };
  const list = pot.policy?.approverAccountIds || [];
  if (list.length && !list.includes(accountId)) return { ok: false, why: 'Only the pot approvers can decide this spend' };
  return { ok: true };
}

export function validatePolicy(p) {
  if (!Number.isInteger(p.autoApproveLimit) || p.autoApproveLimit < 0) return 'Auto-approve limit must be zero or more';
  if (!Number.isInteger(p.hardCap) || p.hardCap <= 0) return 'Hard cap must be positive';
  if (p.hardCap < p.autoApproveLimit) return 'Hard cap must be at least the auto-approve limit';
  return null;
}

export const DECISION_LABEL = { auto_approved: 'Auto-approved', approved: 'Approved', pending: 'Needs approval', rejected: 'Rejected' };
