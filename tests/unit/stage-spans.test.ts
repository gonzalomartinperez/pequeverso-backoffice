import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { parseOpsSummary } from "../../src/features/operations/adapters/validate.ts";

// ADR 0016: run detail ships without per-stage spans until the API contract adds them (M4.9).
// When the API releases an optional `stages` field, this test fails on purpose: re-pin, then
// consume it in a task PR and supersede the ADR.
const schema = JSON.parse(readFileSync("contracts/ops/ops.schema.json", "utf8"));
const example = JSON.parse(readFileSync("contracts/ops/ops.summary.example.json", "utf8"));

it("pins the absence of per-run stage spans in the ops contract", () => {
  const run = schema.$defs.RecentRunOut;
  assert.equal(run.additionalProperties, false);
  assert.ok(!("stages" in run.properties), "the API now publishes stages: consume them");
  assert.ok(
    !Object.keys(schema.$defs).some((name) => /stage|span/i.test(name)),
    "the API now publishes a stage definition",
  );
});

it("tolerates an additive stages field (expand) without exposing it", () => {
  const first = example.recent[0];
  assert.ok(first, "the pinned example has a recent run");
  const expanded = {
    ...example,
    recent: [
      { ...first, stages: [{ name: "retrieve", duration_ms: 12 }] },
      ...example.recent.slice(1),
    ],
  };
  const summary = parseOpsSummary(expanded);
  assert.deepEqual(summary.recent, parseOpsSummary(example).recent);
  assert.ok(!("stages" in (summary.recent[0] ?? {})));
});
