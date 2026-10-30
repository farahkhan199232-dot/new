import type { AuditEntry, Contribution, GiftPot, Proposal } from "./types.ts";
import { product } from "./catalog.ts";
import { formatMoney, splitEqual } from "./money.ts";

/**
 * Gift-pot rules. Pure functions over a GiftPot so they are easy to test;
 * API routes load the pot, call one of these, and save it.
 */

export function newId(bytes = 8): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, bytes * 2);
}

export function audit(pot: GiftPot, kind: string, text: string): AuditEntry {
  const e: AuditEntry = { id: newId(), at: Date.now(), kind, text };
  pot.audit.unshift(e);
  if (pot.audit.length > 200) pot.audit.length = 200;
  return e;
}

export function member(pot: GiftPot, memberId: string) {
  const m = pot.members.find((x) => x.id === memberId);
  if (!m) throw new Error("Pick who you are first");
  return m;
}

export function addProposal(pot: GiftPot, p: Omit<Proposal, "id" | "createdAt">): Proposal {
  if (pot.lockedProposalId) throw new Error("Voting is closed for this pot");
  const m = member(pot, p.memberId);
  const prod = product(p.productId);
  if (prod.price > pot.budget) throw new Error(`${prod.name} (${formatMoney(prod.price)}) is over the ${formatMoney(pot.budget)} budget`);
  // One live proposal per product: re-trying the same product replaces the old card.
  pot.proposals = pot.proposals.filter((x) => x.productId !== p.productId);
  const prop: Proposal = { ...p, id: newId(), createdAt: Date.now() };
  pot.proposals.unshift(prop);
  // Proposing counts as your vote unless you already voted.
  if (!pot.votes[m.id]) pot.votes[m.id] = prop.id;
  for (const [mid, pid] of Object.entries(pot.votes)) if (!pot.proposals.some((x) => x.id === pid)) delete pot.votes[mid];
  audit(pot, "propose", `${m.name} proposed ${prod.name} (${p.match}% match)`);
  return prop;
}

export function vote(pot: GiftPot, memberId: string, proposalId: string) {
  if (pot.lockedProposalId) throw new Error("Voting is closed for this pot");
  const m = member(pot, memberId);
  const prop = pot.proposals.find((x) => x.id === proposalId);
  if (!prop) throw new Error("That proposal no longer exists");
  pot.votes[m.id] = prop.id;
  audit(pot, "vote", `${m.name} voted for ${product(prop.productId).name}`);
}

export function tally(pot: GiftPot): { proposalId: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const p of pot.proposals) counts.set(p.id, 0);
  for (const pid of Object.values(pot.votes)) if (counts.has(pid)) counts.set(pid, counts.get(pid)! + 1);
  return [...counts.entries()].map(([proposalId, votes]) => ({ proposalId, votes }));
}

/** Most votes wins; ties go to the better Skin AI match, then the earlier proposal. */
export function leader(pot: GiftPot): Proposal | undefined {
  const t = new Map(tally(pot).map((x) => [x.proposalId, x.votes]));
  return [...pot.proposals].sort(
    (a, b) => (t.get(b.id)! - t.get(a.id)!) || (b.match - a.match) || (a.createdAt - b.createdAt),
  )[0];
}

export function lockVote(pot: GiftPot, memberId: string): Proposal {
  const m = member(pot, memberId);
  if (pot.lockedProposalId) throw new Error("Already locked");
  const win = leader(pot);
  if (!win) throw new Error("Propose at least one gift first");
  if (Object.keys(pot.votes).length < Math.min(2, pot.members.length)) throw new Error("Wait for at least two votes");
  pot.lockedProposalId = win.id;
  const prod = product(win.productId);
  audit(pot, "lock", `${m.name} closed the vote: ${prod.name} wins. Each friend chips in ${formatMoney(shares(pot)[m.id])}.`);
  return win;
}

export function target(pot: GiftPot): number {
  const p = pot.proposals.find((x) => x.id === pot.lockedProposalId);
  return p ? product(p.productId).price : 0;
}

export function shares(pot: GiftPot): Record<string, number> {
  return splitEqual(target(pot), pot.members.map((m) => m.id));
}

export function paidBy(pot: GiftPot, memberId: string): number {
  return pot.contributions.filter((c) => c.memberId === memberId).reduce((s, c) => s + c.amount, 0);
}

export function funded(pot: GiftPot): number {
  return pot.contributions.reduce((s, c) => s + c.amount, 0);
}

/** Demo chip-in: records the member's equal share. No money moves in this build. */
export function chipIn(pot: GiftPot, memberId: string): Contribution {
  const m = member(pot, memberId);
  if (!pot.lockedProposalId) throw new Error("Close the vote first");
  if (pot.order) throw new Error("The gift is already ordered");
  const owed = shares(pot)[m.id] - paidBy(pot, m.id);
  if (owed <= 0) throw new Error(`${m.name} has already chipped in`);
  const c: Contribution = { id: newId(), memberId: m.id, amount: owed, createdAt: Date.now(), method: "demo" };
  pot.contributions.push(c);
  audit(pot, "chip", `${m.name} chipped in ${formatMoney(owed)} (demo payment)`);
  if (funded(pot) >= target(pot)) placeOrder(pot);
  return c;
}

function placeOrder(pot: GiftPot) {
  const p = pot.proposals.find((x) => x.id === pot.lockedProposalId)!;
  const prod = product(p.productId);
  pot.order = { id: "CPT-" + newId(4).toUpperCase(), placedAt: Date.now(), amount: target(pot), productId: prod.id };
  audit(pot, "order", `Pot fully funded. Demo order ${pot.order.id} placed for ${prod.name} (${formatMoney(prod.price)}), shipping to ${pot.recipient}.`);
}
