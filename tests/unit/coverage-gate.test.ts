import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluate,
  measure,
  type Ratchet,
  STORE_FILE,
  type Summary,
} from "../../scripts/check-coverage.ts";
import { evaluateDiff, parseChangedLines, parseLcov } from "../../scripts/diff-coverage.ts";

const counter = (covered: number, total: number) => ({
  branches: { covered, total },
  lines: { covered, total },
});
const root = "/repo/";
const summary = (
  store: [number, number],
  auth: [number, number],
  other: [number, number],
): Summary => ({
  total: counter(0, 0),
  [`${root}${STORE_FILE}`]: counter(...store),
  [`${root}src/server/auth.ts`]: counter(...auth),
  [`${root}src/shared/lib/format.ts`]: counter(...other),
});
const ratchet: Ratchet = { branchRepo: 80, branchAuth: 80, linesStore: 80 };

describe("coverage gate (synthetic fixtures)", () => {
  it("passes when floors and ratchet hold, warning below the auth target", () => {
    const measured = measure(summary([9, 10], [19, 20], [8, 10]), root);
    assert.deepEqual(measured, { branchRepo: 90, branchAuth: 93.3, linesStore: 90 });
    assert.deepEqual(evaluate(measured, ratchet), { errors: [], warnings: [] });
    const { warnings } = evaluate({ ...measured, branchAuth: 85 }, ratchet);
    assert.match(warnings[0] ?? "", /below the 90% plan target/);
  });

  it("fails below the floors (negative fixture)", () => {
    const measured = measure(summary([1, 10], [8, 10], [5, 10]), root);
    const { errors } = evaluate(measured, ratchet);
    assert.equal(errors.length, 6);
    assert.match(errors.join("\n"), /branchAuth 45% is below the 80% floor/);
    assert.match(errors.join("\n"), /linesStore 10% is below the 80% floor/);
  });

  it("fails below the ratchet even above the floor", () => {
    const high: Ratchet = { branchRepo: 95, branchAuth: 99, linesStore: 95 };
    const { errors } = evaluate({ branchRepo: 90, branchAuth: 93.3, linesStore: 90 }, high);
    assert.equal(errors.length, 3);
    assert.match(errors[0] ?? "", /regressed below the ratchet 95%/);
  });

  it("rejects a lowered ratchet against the base", () => {
    const base: Ratchet = { branchRepo: 91, branchAuth: 95, linesStore: 90 };
    const { errors } = evaluate({ branchRepo: 99, branchAuth: 99, linesStore: 99 }, ratchet, base);
    assert.equal(errors.length, 3);
    assert.match(errors[0] ?? "", /ratchet branchRepo was lowered from 91 to 80/);
  });

  it("treats a missing store file as 0%", () => {
    const partial: Summary = { total: counter(0, 0), [`${root}src/a.ts`]: counter(1, 1) };
    assert.equal(measure(partial, root).linesStore, 0);
  });
});

describe("diff coverage (synthetic fixtures)", () => {
  const lcov = parseLcov(
    [
      "SF:src/server/auth.ts",
      "DA:1,1",
      "DA:2,0",
      "DA:3,1",
      "end_of_record",
      "SF:src/shared/lib/format.ts",
      "DA:1,1",
      "DA:2,1",
      "DA:3,1",
      "DA:4,1",
      "DA:5,0",
      "end_of_record",
    ].join("\n"),
  );

  it("parses zero-context diffs, including single-line hunks and deleted files", () => {
    const changed = parseChangedLines(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,0 +2,2 @@",
        "@@ -9 +11 @@",
        "@@ -20,2 +30,0 @@",
        "--- a/src/gone.ts",
        "+++ /dev/null",
        "@@ -1,3 +0,0 @@",
      ].join("\n"),
    );
    assert.deepEqual([...(changed.get("src/a.ts") ?? [])], [2, 3, 11]);
    assert.equal(changed.has("src/gone.ts"), false);
  });

  it("passes when changed lines are covered and ignores non-executable lines", () => {
    const changed = new Map([
      ["src/server/auth.ts", new Set([1, 3, 99])],
      ["src/shared/lib/format.ts", new Set([1, 2, 3, 4, 5])],
    ]);
    const { errors, results } = evaluateDiff(lcov, changed);
    assert.deepEqual(errors, []);
    assert.equal(results.find((r) => r.group === "auth")?.total, 2);
  });

  it("fails an uncovered auth change at 90% and the rest at 80% (negative fixture)", () => {
    const authOnly = evaluateDiff(lcov, new Map([["src/server/auth.ts", new Set([1, 2, 3])]]));
    assert.equal(authOnly.errors.length, 1);
    assert.match(authOnly.errors[0] ?? "", /auth 66\.7%/);
    const rest = evaluateDiff(lcov, new Map([["src/shared/lib/format.ts", new Set([4, 5])]]));
    assert.match(rest.errors[0] ?? "", /rest 50\.0%/);
  });

  it("accepts absolute SF paths from other lcov producers", () => {
    const abs = parseLcov("SF:/repo/src/a.ts\nDA:1,1\nend_of_record", "/repo/");
    assert.equal(abs.has("src/a.ts"), true);
  });

  it("passes when the diff touches no executable source", () => {
    assert.deepEqual(evaluateDiff(lcov, new Map([["docs/a.md", new Set([1])]])).errors, []);
  });
});
