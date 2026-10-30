import { test } from "node:test";
import assert from "node:assert/strict";
import { depthOf, earringMatch, hexToLab, lipMatch, matchProduct, skincareMatch, topConcerns, topMatch, undertoneOf } from "./match.ts";
import { product } from "./catalog.ts";
import type { SkinProfile } from "./types.ts";

// Real YouCam Skin Tone Analysis output for the demo selfie: skin_color #9e795f.
const profile: SkinProfile = {
  skinHex: "#9e795f", undertone: "warm", depth: "medium", analyzedAt: 0, source: "cached",
  scores: [
    { type: "dark_circle_v2", ui: 62, raw: 41.7 },
    { type: "moisture", ui: 69, raw: 46.9 },
    { type: "oiliness", ui: 69, raw: 54.5 },
    { type: "pore", ui: 72, raw: 59.2 },
    { type: "radiance", ui: 78, raw: 74.9 },
    { type: "texture", ui: 82, raw: 83.8 },
    { type: "acne", ui: 83, raw: 85.6 },
    { type: "redness", ui: 99, raw: 100 },
  ],
};

test("hexToLab matches known values", () => {
  const w = hexToLab("#ffffff");
  assert.ok(Math.abs(w.L - 100) < 0.05 && Math.abs(w.a) < 0.05 && Math.abs(w.b) < 0.05);
  const k = hexToLab("#000000");
  assert.ok(Math.abs(k.L) < 0.01);
  assert.throws(() => hexToLab("red"));
});

test("undertone and depth from the YouCam skin colour", () => {
  assert.equal(undertoneOf("#9e795f"), "warm");
  assert.equal(depthOf("#9e795f"), "medium");
  assert.equal(depthOf("#f1c7aa"), "light");
  assert.equal(depthOf("#5a3a28"), "deep");
});

test("a warm brick shade beats a pale gloss on warm medium skin", () => {
  const brick = lipMatch("#8E3B2F", profile);
  const pale = lipMatch("#F0A493", profile);
  assert.ok(brick.score > 85, brick.why);
  assert.ok(pale.score < 50, pale.why);
  assert.match(pale.why, /washed out/);
});

test("metal follows undertone", () => {
  assert.ok(earringMatch("gold", "warm").score > earringMatch("silver", "warm").score);
  assert.ok(earringMatch("silver", "cool").score > earringMatch("gold", "cool").score);
  assert.equal(earringMatch("gold", "neutral").score, earringMatch("silver", "neutral").score);
});

test("jewel tones for warm medium skin, pastels for light or cool", () => {
  assert.ok(topMatch("jewel", "warm", "medium").score > topMatch("pastel", "warm", "medium").score);
  assert.ok(topMatch("pastel", "cool", "light").score > topMatch("jewel", "cool", "light").score);
});

test("skincare scores rise as the Skin AI concern score falls", () => {
  const eye = skincareMatch(profile.scores[0]);
  const calm = skincareMatch(profile.scores[7]);
  assert.ok(eye.score > 80, eye.why);
  assert.ok(calm.score < 40, calm.why);
  assert.equal(skincareMatch(undefined).score, 50);
});

test("matchProduct routes every catalog kind and topConcerns is worst-first", () => {
  for (const id of ["lip-chai-rose", "ear-gold-jhumka", "top-emerald-kurta", "care-eye-cream"]) {
    const m = matchProduct(product(id), profile);
    assert.ok(m.score >= 5 && m.score <= 98 && m.why.length > 0);
  }
  assert.deepEqual(topConcerns(profile).map((c) => c.type), ["dark_circle_v2", "moisture", "oiliness"]);
});

test("reasons read as clean sentences", () => {
  assert.equal(earringMatch("silver", "warm").why, "Silver is usually less flattering on a warm undertone.");
});
