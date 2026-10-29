import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLevelFor, seedNames, toPick, qlooConfigured } from "./qloo.ts";

test("priceLevelFor maps per-person money left to Qloo price levels", () => {
  assert.equal(priceLevelFor(5), 1);
  assert.equal(priceLevelFor(15), 2);
  assert.equal(priceLevelFor(30), 3);
  assert.equal(priceLevelFor(200), 4);
});

test("seedNames prefers same-category merchants, skips rejected and duplicates", () => {
  const s = (payeeName: string, category: string, createdAt: number, status = "paid") => ({ payeeName, category, createdAt, status }) as any;
  const pot = { spends: [s("Cafe Goa", "food", 1), s("Villa", "stay", 3), s("cafe goa", "food", 2), s("Bad Bar", "food", 4, "rejected"), s("Fish Shack", "food", 5)] };
  assert.deepEqual(seedNames(pot, "food"), ["Fish Shack", "cafe goa", "Villa"]);
});

test("toPick reads Qloo entity fields defensively", () => {
  const p = toPick({ entity_id: "X", name: "Shack", query: { affinity: 0.9529 }, tags: [{ name: "Place" }, { name: "Seafood" }], properties: { price_level: 2, business_rating: 3.79, keywords: [{ name: "sea view" }], images: [{ url: "https://img" }] } });
  assert.equal(p.priceLevel, 2);
  assert.equal(p.rating, 3.8);
  assert.equal(p.affinity, 0.95);
  assert.deepEqual(p.tags, ["Seafood"]);
  assert.equal(p.image, "https://img");
  const empty = toPick({ entity_id: "Y", name: "Z" });
  assert.deepEqual(empty.tags, []);
});

test("without QLOO_API_KEY the feature reports not configured", () => {
  if (!process.env.QLOO_API_KEY) assert.equal(qlooConfigured(), false);
});
