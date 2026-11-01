// SAMPLE DATA for the demo only. Not a real group.
import type { Group, Ev } from "./shg.ts";
import { addMonths } from "./shg.ts";

export const DEMO_GROUP_ID = "demo";

export function demoGroup(month: string): Group {
  const members = [
    { id: "m1", name: "Sunita Pawar", nameHi: "सुनीता पवार", role: "leader" as const, joined: addMonths(month, -11) },
    { id: "m2", name: "Rekha Jadhav", nameHi: "रेखा जाधव", role: "treasurer" as const, joined: addMonths(month, -11) },
    { id: "m3", name: "Meena Shinde", nameHi: "मीना शिंदे", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m4", name: "Lata Kamble", nameHi: "लता कांबळे", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m5", name: "Asha Gaikwad", nameHi: "आशा गायकवाड", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m6", name: "Kavita More", nameHi: "कविता मोरे", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m7", name: "Savita Patil", nameHi: "सविता पाटील", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m8", name: "Usha Bhosale", nameHi: "उषा भोसले", role: "member" as const, joined: addMonths(month, -11) },
    { id: "m9", name: "Pooja Salunkhe", nameHi: "पूजा सलुंखे", role: "member" as const, joined: addMonths(month, -2) },
    { id: "m10", name: "Shobha Kale", nameHi: "शोभा काळे", role: "member" as const, joined: addMonths(month, -11) },
  ];

  const events: Ev[] = [];
  let evId = 0;

  // Contributions: ₹200 for each member from their join month to `month`, except Lata (m4) and Shobha (m10) skip `month`
  for (const member of members) {
    for (let i = 0; addMonths(member.joined, i) <= month; i++) {
      const contMonth = addMonths(member.joined, i);
      // Skip Lata and Shobha in the current month
      if ((member.id === "m4" || member.id === "m10") && contMonth === month) continue;
      evId++;
      events.push({
        id: `e${evId}`,
        type: "contribution",
        memberId: member.id,
        amount: 200,
        at: contMonth + "-05T10:00:00.000Z",
        by: "m2",
        month: contMonth,
      });
    }
  }

  // Loan L1: Meena (m3), ₹5000, 10 months, requested in addMonths(month, -4)
  const l1Month = addMonths(month, -4);
  evId++;
  events.push({
    id: `e${evId}`,
    type: "loan_request",
    loanId: "L1",
    memberId: "m3",
    amount: 5000,
    tenureMonths: 10,
    purpose: "Sewing machine for tailoring work",
    at: l1Month + "-05T10:00:00.000Z",
    by: "m2",
    month: l1Month,
  });

  // L1 approved by m1 and m2 in the same month
  evId++;
  events.push({
    id: `e${evId}`,
    type: "loan_approve",
    loanId: "L1",
    at: l1Month + "-05T10:00:00.000Z",
    by: "m1",
    month: l1Month,
  });
  evId++;
  events.push({
    id: `e${evId}`,
    type: "loan_approve",
    loanId: "L1",
    at: l1Month + "-05T10:00:00.000Z",
    by: "m2",
    month: l1Month,
  });

  // L1 repayments: ₹550 in addMonths(month, -3), -2, -1
  for (const offset of [-3, -2, -1]) {
    const repMonth = addMonths(month, offset);
    evId++;
    events.push({
      id: `e${evId}`,
      type: "repayment",
      loanId: "L1",
      amount: 550,
      at: repMonth + "-05T10:00:00.000Z",
      by: "m2",
      month: repMonth,
    });
  }

  // Loan L2: Kavita (m6), ₹3000, 6 months, requested in `month`, approved only by m1
  evId++;
  events.push({
    id: `e${evId}`,
    type: "loan_request",
    loanId: "L2",
    memberId: "m6",
    amount: 3000,
    tenureMonths: 6,
    purpose: "Buffalo fodder and vet bill",
    at: month + "-05T10:00:00.000Z",
    by: "m2",
    month: month,
  });

  evId++;
  events.push({
    id: `e${evId}`,
    type: "loan_approve",
    loanId: "L2",
    at: month + "-05T10:00:00.000Z",
    by: "m1",
    month: month,
  });

  return {
    id: DEMO_GROUP_ID,
    name: "Jai Maa Durga Mahila Bachat Gat",
    village: "Wadgaon, Pune district",
    rules: {
      monthlySaving: 200,
      interestPctPerMonth: 1,
      maxLoanMultiple: 3,
      maxLoanPctOfCash: 50,
      minMonthsMember: 6,
      maxTenureMonths: 12,
      approvalsNeeded: 2,
    },
    members,
    events,
  };
}
