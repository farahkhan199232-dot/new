import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, toJsonSchema, OTARI_BASE } from "./otari.ts";

test("toJsonSchema lowercases types and maps nullable", () => {
  const out = toJsonSchema({ type: "OBJECT", properties: { a: { type: "NUMBER", nullable: true }, b: { type: "ARRAY", items: { type: "STRING" } } }, required: ["a"] }) as any;
  assert.equal(out.type, "object");
  assert.deepEqual(out.properties.a.type, ["number", "null"]);
  assert.equal(out.properties.b.items.type, "string");
  assert.equal(out.additionalProperties, false);
});

test("extractJson handles think blocks, fences and prose", () => {
  assert.deepEqual(extractJson('<think>hmm</think>```json\n{"x":1}\n```'), { x: 1 });
  assert.deepEqual(extractJson('I searched the web. {"risk":"low"} done'), { risk: "low" });
});

test("Otari base URL is normalised to the host (calls go to /api/v1)", () => {
  assert.ok(!/\/v1$/.test(OTARI_BASE));
});

test("tool helpers return null without OTARI_API_KEY (core flow never waits on them)", async () => {
  const { checkPayeeOnWeb, auditReceiptWithCode, otariConfigured } = await import("./otari.ts");
  if (otariConfigured()) return;
  assert.equal(await checkPayeeOnWeb("Bill: $40 groceries", {}, "t"), null);
  assert.equal(await auditReceiptWithCode("{}", {}, "t"), null);
});
