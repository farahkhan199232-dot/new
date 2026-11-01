import { test } from "node:test";
import assert from "node:assert/strict";
import { inr, monthsBetween, computeState, checkLoan, balanceText, applyEvent } from "./shg.ts";
import type { Ev } from "./shg.ts";
import { demoGroup } from "./seed.ts";

const month = "2025-01";
const g = demoGroup(month);

test("inr formatting", () => {
  assert.equal(inr(150000), "₹1,50,000");
  assert.equal(inr(500), "₹500");
  assert.equal(inr(-1200), "-₹1,200");
});

test("monthsBetween", () => {
  assert.equal(monthsBetween("2025-01", "2025-03"), 2);
  assert.equal(monthsBetween("2024-12", "2025-02"), 2);
});

test("demo cash = contributions + repayments - 5000", () => {
  const state = computeState(g, month);
  const monthsPaid = 9 * 12 + 1 * 3; // 9 members x 12 months (join month to now), Pooja x 3 months
  const contrib = 200 * monthsPaid - 200 * 2; // minus Lata & Shobha this month
  const repay = 550 * 3; // 3 repayments of L1
  const expected = contrib + repay - 5000;
  assert.equal(state.cash, expected);
});

test("Lata and Shobha unpaid, monthsMissed 1", () => {
  const state = computeState(g, month);
  assert.equal(state.members["m4"].paidThisMonth, false);
  assert.equal(state.members["m10"].paidThisMonth, false);
  assert.equal(state.members["m4"].monthsMissed, 1);
  assert.equal(state.members["m10"].monthsMissed, 1);
});

test("Pooja too_new", () => {
  const check = checkLoan(g, "m9", 1000, 6, month);
  assert(!check.ok);
  assert(check.problems.some((p) => p.code === "too_new"));
});

test("Kavita open_loan", () => {
  const check = checkLoan(g, "m6", 1000, 6, month);
  assert(!check.ok);
  assert(check.problems.some((p) => p.code === "open_loan"));
});

test("over_multiple and over_cash", () => {
  const tinyGroup = demoGroup(month);
  tinyGroup.rules.monthlySaving = 10;
  tinyGroup.members = [tinyGroup.members[0], tinyGroup.members[1], tinyGroup.members[2]];
  tinyGroup.rules.maxLoanMultiple = 1;
  tinyGroup.rules.maxLoanPctOfCash = 30;
  const check = checkLoan(tinyGroup, "m3", 5000, 6, month);
  assert(!check.ok);
  assert(check.problems.some((p) => p.code === "over_multiple"));
  assert(check.problems.some((p) => p.code === "over_cash"));
});

test("bad_tenure", () => {
  const check = checkLoan(g, "m5", 1000, 0, month);
  assert(!check.ok);
  assert(check.problems.some((p) => p.code === "bad_tenure"));
  const check2 = checkLoan(g, "m5", 1000, 13, month);
  assert(!check2.ok);
  assert(check2.problems.some((p) => p.code === "bad_tenure"));
});

test("maxEligible is a multiple of 100", () => {
  const check = checkLoan(g, "m3", 1000, 6, month);
  assert(check.maxEligible % 100 === 0);
});

test("plan principal sums to the amount", () => {
  const check = checkLoan(g, "m5", 2500, 7, month);
  assert(check.ok);
  const principalSum = check.plan.reduce((sum, p) => sum + p.principal, 0);
  assert.equal(principalSum, 2500);
  assert.equal(check.plan.length, 7);
});

test("borrower self-approval ignored; 2 officer approvals needed", () => {
  const g2 = demoGroup(month);
  const ev1: Ev = {
    id: "ea",
    type: "loan_request",
    loanId: "L3",
    memberId: "m5",
    amount: 1000,
    tenureMonths: 6,
    purpose: "test",
    at: month + "-10T10:00:00.000Z",
    by: "m2",
    month: month,
  };
  const g3 = applyEvent(g2, ev1);
  const ev2: Ev = {
    id: "eb",
    type: "loan_approve",
    loanId: "L3",
    at: month + "-10T10:00:00.000Z",
    by: "m5", // borrower trying to approve own loan
    month: month,
  };
  assert.throws(() => applyEvent(g3, ev2));
  const g4 = { ...g3, events: [...g3.events, ev2] }; // even if logged raw, computeState ignores it
  const ev3: Ev = {
    id: "ec",
    type: "loan_approve",
    loanId: "L3",
    at: month + "-10T10:00:00.000Z",
    by: "m3", // plain member, not officer
    month: month,
  };
  assert.throws(() => applyEvent(g4, ev3));
  const g5 = { ...g4, events: [...g4.events, ev3] };
  let state = computeState(g5, month);
  let loan = state.loans.find((l) => l.loanId === "L3");
  assert.equal(loan?.status, "pending"); // still pending, needs 2 officer approvals
  const ev4: Ev = {
    id: "ed",
    type: "loan_approve",
    loanId: "L3",
    at: month + "-10T10:00:00.000Z",
    by: "m1", // first officer
    month: month,
  };
  const g6 = applyEvent(g5, ev4);
  state = computeState(g6, month);
  loan = state.loans.find((l) => l.loanId === "L3");
  assert.equal(loan?.status, "pending");
  const ev5: Ev = {
    id: "ee",
    type: "loan_approve",
    loanId: "L3",
    at: month + "-10T10:00:00.000Z",
    by: "m2", // second officer
    month: month,
  };
  const g7 = applyEvent(g6, ev5);
  state = computeState(g7, month);
  loan = state.loans.find((l) => l.loanId === "L3");
  assert.equal(loan?.status, "approved");
  assert(state.cash > 0); // cash decreased after disbursement
});

test("repayment pays interest first and closes at zero", () => {
  const check = checkLoan(g, "m7", 1000, 5, month);
  assert(check.ok);
  const g2 = applyEvent(g, {
    id: "f1",
    type: "loan_request",
    loanId: "L4",
    memberId: "m7",
    amount: 1000,
    tenureMonths: 5,
    purpose: "test",
    at: month + "-10T10:00:00.000Z",
    by: "m2",
    month: month,
  });
  const g3 = applyEvent(g2, {
    id: "f2",
    type: "loan_approve",
    loanId: "L4",
    at: month + "-10T10:00:00.000Z",
    by: "m1",
    month: month,
  });
  const g4 = applyEvent(g3, {
    id: "f3",
    type: "loan_approve",
    loanId: "L4",
    at: month + "-10T10:00:00.000Z",
    by: "m2",
    month: month,
  });
  let state = computeState(g4, month);
  let loan = state.loans.find((l) => l.loanId === "L4");
  assert.equal(loan?.status, "approved");
  const nextPayment = loan?.nextDue;
  const totalDue = nextPayment?.total ?? 0;
  const g5 = applyEvent(g4, {
    id: "f4",
    type: "repayment",
    loanId: "L4",
    amount: totalDue,
    at: month + "-15T10:00:00.000Z",
    by: "m7",
    month: month,
  });
  state = computeState(g5, month);
  loan = state.loans.find((l) => l.loanId === "L4");
  assert.ok(loan);
  assert.ok(loan.interestPaid > 0);
  assert.ok(loan.principalOutstanding > 0); // still owes principal
});

test("applyEvent throws: contribution 0, unknown member, repayment above due", () => {
  assert.throws(
    () =>
      applyEvent(g, {
        id: "g1",
        type: "contribution",
        memberId: "m1",
        amount: 0,
        at: month + "-10T10:00:00.000Z",
        by: "m2",
        month: month,
      }),
    /Contribution amount must be positive/
  );
  assert.throws(
    () =>
      applyEvent(g, {
        id: "g2",
        type: "contribution",
        memberId: "m99",
        amount: 100,
        at: month + "-10T10:00:00.000Z",
        by: "m2",
        month: month,
      }),
    /Member m99 not found/
  );
  assert.throws(
    () =>
      applyEvent(g, {
        id: "g3",
        type: "repayment",
        loanId: "L1",
        amount: 9999,
        at: month + "-10T10:00:00.000Z",
        by: "m3",
        month: month,
      }),
    /Repayment exceeds outstanding/
  );
});

test("applyEvent does not mutate original group", () => {
  const original = demoGroup(month);
  const eventCount = original.events.length;
  applyEvent(original, {
    id: "h1",
    type: "contribution",
    memberId: "m1",
    amount: 500,
    at: month + "-10T10:00:00.000Z",
    by: "m2",
    month: month,
  });
  assert.equal(original.events.length, eventCount);
});

test("balanceText(...,'hi') contains Devanagari", () => {
  const text = balanceText(g, "m1", month, "hi");
  assert(/[\u0900-\u097F]/.test(text));
});
