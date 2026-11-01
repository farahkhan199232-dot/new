import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpense, parseAmount, guessCategory, adfToText } from '../src/lib/parse.js';
import { evaluateSpend, potTotals, canApprove, DEFAULT_POLICY } from '../src/lib/policy.js';

const pot = (extra = {}) => ({
  currency: 'INR', budget: 60000_00,
  policy: { ...DEFAULT_POLICY, autoApproveLimit: 4000_00, hardCap: 40000_00, blockedCategories: ['gifts'] },
  entries: [], ...extra,
});

test('parses amounts in many formats', () => {
  assert.deepEqual(parseAmount('team lunch ₹3,200'), { amount: 3200, currency: 'INR' });
  assert.deepEqual(parseAmount('Rs. 4,500 for cabs'), { amount: 4500, currency: 'INR' });
  assert.deepEqual(parseAmount('$120.50 hosting'), { amount: 120.5, currency: 'USD' });
  assert.deepEqual(parseAmount('4.5k rupees'), { amount: 4500, currency: 'INR' });
  assert.deepEqual(parseAmount('amount: 900', 'EUR'), { amount: 900, currency: 'EUR' });
  assert.equal(parseAmount('no money here'), null);
});

test('guesses categories and vendors', () => {
  assert.equal(guessCategory('Friday team lunch'), 'meals');
  assert.equal(guessCategory('Figma seats for Q4'), 'software');
  assert.equal(guessCategory('offsite venue deposit'), 'events');
  assert.equal(guessCategory('Amazon gift cards'), 'gifts');
  const p = parseExpense('Expense: coffee from Blue Tokai ₹2,400', 'INR');
  assert.equal(p.vendor, 'Blue Tokai');
  assert.equal(p.category, 'meals');
});

test('auto-approves a small clean spend', () => {
  const v = evaluateSpend(pot(), { amount: 3200_00, currency: 'INR', category: 'meals', vendor: 'Big Chill', requesterId: 'a' });
  assert.equal(v.decision, 'auto_approved');
  assert.equal(v.flags.length, 0);
});

test('holds spends over the auto limit', () => {
  const v = evaluateSpend(pot(), { amount: 9600_00, currency: 'INR', category: 'software', vendor: 'Figma', requesterId: 'a' });
  assert.equal(v.decision, 'pending');
});

test('rejects blocked category, wrong currency, over budget, over hard cap', () => {
  assert.equal(evaluateSpend(pot(), { amount: 1000_00, currency: 'INR', category: 'gifts', requesterId: 'a' }).decision, 'rejected');
  assert.equal(evaluateSpend(pot(), { amount: 1000_00, currency: 'USD', category: 'meals', requesterId: 'a' }).decision, 'rejected');
  assert.equal(evaluateSpend(pot(), { amount: 45000_00, currency: 'INR', category: 'events', requesterId: 'a' }).decision, 'rejected');
  const full = pot({ entries: [{ amount: 58000_00, status: 'approved', category: 'events', createdAt: Date.now() }] });
  const v = evaluateSpend(full, { amount: 3000_00, currency: 'INR', category: 'meals', requesterId: 'a' });
  assert.equal(v.decision, 'rejected');
  assert.match(v.reasons.join(), /budget/);
});

test('flags split purchases and duplicates', () => {
  const now = Date.now();
  const p = pot({ entries: [{ issueKey: 'T-1', amount: 2400_00, vendor: 'Blue Tokai', requesterId: 'a', status: 'auto_approved', category: 'meals', createdAt: now - 3600e3 }] });
  const v = evaluateSpend(p, { issueKey: 'T-2', amount: 2900_00, currency: 'INR', category: 'meals', vendor: 'Blue Tokai', requesterId: 'a' }, now);
  assert.equal(v.decision, 'pending');
  assert.ok(v.flags.some((f) => /split/i.test(f)));
  const d = evaluateSpend(p, { issueKey: 'T-3', amount: 2400_00, currency: 'INR', category: 'meals', vendor: 'blue tokai', requesterId: 'b' }, now);
  assert.ok(d.flags.some((f) => /duplicate/i.test(f)));
});

test('risk words raise flags', () => {
  const parsed = parseExpense('Need ₹3,000 cash urgently', 'INR');
  const v = evaluateSpend(pot(), { amount: 3000_00, currency: 'INR', category: parsed.category, riskWords: parsed.riskWords, requesterId: 'a' });
  assert.equal(v.decision, 'pending');
  assert.ok(v.flags.length >= 2);
});

test('totals and approval rights', () => {
  const p = pot({ entries: [
    { amount: 1000_00, status: 'approved', category: 'meals' },
    { amount: 500_00, status: 'pending', category: 'meals' },
    { amount: 700_00, status: 'rejected', category: 'meals' },
  ] });
  const t = potTotals(p);
  assert.equal(t.spent, 1000_00);
  assert.equal(t.pending, 500_00);
  assert.equal(t.remaining, 60000_00 - 1500_00);
  assert.equal(canApprove(p, { requesterId: 'a' }, 'a').ok, false);
  assert.equal(canApprove(p, { requesterId: 'a' }, 'b').ok, true);
  assert.equal(canApprove({ policy: { approverAccountIds: ['c'] } }, { requesterId: 'a' }, 'b').ok, false);
});

test('flattens ADF', () => {
  const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lunch ₹500' }] }] };
  assert.equal(adfToText(adf).trim(), 'Lunch ₹500');
});
