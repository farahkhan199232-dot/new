import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, toJsonSchema } from "./nebius.ts";

test("toJsonSchema lowercases types and maps nullable", () => {
  const out = toJsonSchema({ type: "OBJECT", properties: { a: { type: "NUMBER", nullable: true }, b: { type: "ARRAY", items: { type: "STRING" } } }, required: ["a"] }) as any;
  assert.equal(out.type, "object");
  assert.deepEqual(out.properties.a.type, ["number", "null"]);
  assert.equal(out.properties.b.items.type, "string");
  assert.equal(out.additionalProperties, false);
});

test("extractJson handles think blocks and fences", () => {
  assert.deepEqual(extractJson('<think>hmm</think>```json\n{"x":1}\n```'), { x: 1 });
  assert.deepEqual(extractJson('Sure: {"y":2} done'), { y: 2 });
});
