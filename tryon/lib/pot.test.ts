import { test } from "node:test";
import assert from "node:assert/strict";
import type { GiftPot } from "./types.ts";
import { addProposal, chipIn, funded, leader, lockVote, shares, tally, vote } from "./pot.ts";
import { splitEqual } from "./money.ts";

function pot(): GiftPot {
  return {
    id: "t", title: "Test", recipient: "Aisha", occasion: "Birthday", currency: "INR", budget: 300000,
    members: [{ id: "a", name: "Riya" }, { id: "b", name: "Kabir" }, { id: "c", name: "Meera" }],
    hasPhoto: true, proposals: [], votes: {}, contributions: [], audit: [], createdAt: 0,
  };
}
const base = { image: "/x.jpg", why: "", source: "cached" as const };

test("splitEqual sums to the total and spreads leftover paise", () => {
  const s = splitEqual(79900, ["a", "b", "c"]);
  assert.deepEqual(Object.values(s), [26634, 26633, 26633]);
  assert.equal(Object.values(s).reduce((x, y) => x + y, 0), 79900);
});

test("proposing counts as the proposer's vote", () => {
  const p = pot();
  const prop = addProposal(p, { ...base, productId: "lip-brick-masala", memberId: "a", match: 95 });
  assert.equal(p.votes.a, prop.id);
});

test("over-budget products are rejected", () => {
  const p = pot();
  p.budget = 100000;
  assert.throws(() => addProposal(p, { ...base, productId: "top-emerald-kurta", memberId: "a", match: 91 }), /over the/);
});

test("re-trying a product replaces the old card and drops dangling votes", () => {
  const p = pot();
  const first = addProposal(p, { ...base, productId: "lip-chai-rose", memberId: "a", match: 53 });
  vote(p, "b", first.id);
  const second = addProposal(p, { ...base, productId: "lip-chai-rose", memberId: "c", match: 53 });
  assert.equal(p.proposals.length, 1);
  assert.equal(p.votes.b, undefined);
  assert.equal(p.votes.c, second.id);
});

test("most votes wins, ties break on Skin AI match", () => {
  const p = pot();
  const lip = addProposal(p, { ...base, productId: "lip-brick-masala", memberId: "a", match: 95 });
  const ear = addProposal(p, { ...base, productId: "ear-gold-jhumka", memberId: "b", match: 92 });
  assert.equal(leader(p)!.id, lip.id); // 1-1 tie, higher match
  vote(p, "c", ear.id);
  assert.equal(leader(p)!.id, ear.id);
  assert.deepEqual(tally(p).find((t) => t.proposalId === ear.id)!.votes, 2);
});

test("lock, chip in, and the order is placed once fully funded", () => {
  const p = pot();
  const ear = addProposal(p, { ...base, productId: "ear-gold-jhumka", memberId: "a", match: 92 });
  assert.throws(() => lockVote(p, "a"), /two votes/);
  vote(p, "b", ear.id);
  lockVote(p, "c");
  assert.throws(() => vote(p, "c", ear.id), /closed/);
  const s = shares(p);
  assert.equal(s.a + s.b + s.c, 249900);
  chipIn(p, "a");
  assert.throws(() => chipIn(p, "a"), /already/);
  chipIn(p, "b");
  assert.equal(p.order, undefined);
  chipIn(p, "c");
  assert.equal(funded(p), 249900);
  const order = (p as GiftPot).order;
  assert.ok(order && order.productId === "ear-gold-jhumka");
});

test("unknown members cannot act", () => {
  const p = pot();
  assert.throws(() => addProposal(p, { ...base, productId: "lip-chai-rose", memberId: "zz", match: 50 }), /Pick who you are/);
});
