import { test } from "node:test";
import assert from "node:assert/strict";
import { fromYocto, isAccountId, toYocto } from "./units.ts";

test("toYocto converts whole and fractional NEAR", () => {
  assert.equal(toYocto("1"), "1000000000000000000000000");
  assert.equal(toYocto("0.25"), "250000000000000000000000");
  assert.equal(toYocto(1.5), "1500000000000000000000000");
});

test("toYocto rejects junk", () => {
  assert.throws(() => toYocto("-1"));
  assert.throws(() => toYocto("1e3"));
  assert.throws(() => toYocto("abc"));
});

test("fromYocto formats and trims", () => {
  assert.equal(fromYocto("1500000000000000000000000"), "1.5");
  assert.equal(fromYocto("1000000000000000000000000"), "1");
  assert.equal(fromYocto("123456789000000000000000"), "0.1234");
  assert.equal(fromYocto(0n), "0");
});

test("isAccountId", () => {
  assert.ok(isAccountId("cafe.chai-pot-near.testnet"));
  assert.ok(isAccountId("a".repeat(64)));
  assert.ok(!isAccountId("Cafe.testnet"));
  assert.ok(!isAccountId("bad..testnet"));
  assert.ok(!isAccountId("x"));
});
