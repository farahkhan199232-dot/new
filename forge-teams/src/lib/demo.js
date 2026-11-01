// Demo seeding: one realistic team pot plus expense-request issues in a Jira project.
import { createPot, logIssue } from './service.js';
import { createIssue } from './jira.js';
import { listPots } from './store.js';

export const DEMO_ISSUES = [
  ['Expense: team lunch at Big Chill Cafe ₹3,200', 'Friday sprint-demo lunch for 8 people at Big Chill Cafe. Total ₹3,200, receipt attached.'],
  ['Expense: Figma seats for Q4 ₹9,600', 'Two extra Figma editor seats for the design sprint. Vendor: Figma. ₹9,600 for the quarter.'],
  ['Expense: offsite venue deposit ₹25,000', 'Deposit for the December team offsite venue at Lonavala Retreat. ₹25,000, balance due later.'],
  ['Expense: coffee and snacks from Blue Tokai ₹2,400', 'Snacks and coffee for the planning week from Blue Tokai. ₹2,400.'],
  ['Expense: more coffee from Blue Tokai ₹2,900', 'Second coffee order from Blue Tokai for the hack week. ₹2,900.'],
  ['Expense: Amazon gift cards for the team ₹10,000 urgent', 'Need ₹10,000 of Amazon gift cards ASAP as a thank-you for the launch.'],
];

export async function seedDemo({ projectKey, ownerId }) {
  let pots = await listPots();
  let pot = pots.find((p) => p.name === 'Team Lunches & Offsites');
  if (!pot) {
    pot = await createPot({ name: 'Team Lunches & Offsites', currency: 'INR', budget: 60000, ownerId, policy: { autoApproveLimit: 4000_00, hardCap: 40000_00, blockedCategories: ['gifts'] } });
  }
  if (!pots.find((p) => p.name === 'Tools & Subscriptions')) {
    await createPot({ name: 'Tools & Subscriptions', currency: 'INR', budget: 30000, ownerId, policy: { autoApproveLimit: 10000_00, hardCap: 30000_00, blockedCategories: [] } });
  }
  const created = [];
  if (projectKey) {
    for (const [summary, description] of DEMO_ISSUES) {
      // Seeded issues use a separate label so the create-trigger does not race with us;
      // we review them here one by one instead.
      const key = await createIssue(projectKey, summary, description, ['expense-demo']);
      const r = await logIssue(key, { potRef: pot.id, actorId: ownerId });
      created.push({ key, decision: r.entry.statusLabel });
    }
  }
  return { potId: pot.id, created };
}
