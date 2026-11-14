import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AXES,
  buildScorecard,
  countSuppressions,
  type Inputs,
  loadRatchets,
  validate,
} from "../../scripts/scorecard.ts";

const schema = JSON.parse(readFileSync("quality/scorecard.schema.json", "utf8"));
const ratchets = loadRatchets("quality/ratchets");
const local = {
  "guard.violations": 0,
  "types.errors": 0,
  "lint.suppressions": 5,
  "docs.missingLinks": 0,
};
const meta = { commit: "abc", now: new Date("2026-11-14T00:00:00Z") };
const card = (input: Partial<Inputs> = {}) => buildScorecard({ ratchets, local, ...input }, meta);

test("ratchet files parse and numeric ratchets are finite", () => {
  const files = readdirSync("quality/ratchets").filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 7);
  for (const name of ["guard", "types", "docs", "lint", "security", "coverage"])
    assert.ok(ratchets[name], `${name}.json is missing`);
  for (const [file, key] of [
    ["guard", "violations"],
    ["types", "errors"],
    ["docs", "missingLinks"],
    ["lint", "suppressions"],
  ] as const)
    assert.ok(Number.isInteger(ratchets[file]?.[key]), `${file}.${key}`);
  assert.equal(
    (ratchets.security?.scorecardScore as { status: string } | undefined)?.status,
    "gap",
  );
});

test("scorecard.json validates against its schema and names every axis", () => {
  const result = card();
  assert.deepEqual(validate(schema, result), []);
  const axes = result.axes as Record<string, { metrics: { status: string; plannedIn?: string }[] }>;
  for (const [id] of AXES) {
    const metrics = axes[id]?.metrics ?? [];
    assert.ok(metrics.length > 0, `${id} has no value and no named gap`);
  }
  assert.equal(result.summary.regressions, 0);
});

test("the schema rejects a missing axis, an unplanned gap and an invented status", () => {
  const good = card() as unknown as { axes: Record<string, { metrics: unknown[] }> };
  const missing = structuredClone(good);
  delete missing.axes.D1;
  assert.ok(validate(schema, missing).length > 0);
  const bad = structuredClone(good);
  bad.axes.D3?.metrics.push({ id: "x", status: "gap", reason: "r" });
  assert.ok(validate(schema, bad).length > 0);
  const invented = structuredClone(good);
  invented.axes.D3?.metrics.push({
    id: "x",
    status: "ok",
    value: 1,
    ratchet: null,
    better: "lower",
  });
  assert.ok(validate(schema, invented).length > 0);
});

test("a measured value worse than its ratchet is a regression", () => {
  const worse = card({ local: { ...local, "lint.suppressions": 6 } });
  assert.equal(worse.summary.regressions, 1);
  assert.equal((worse.axes as Record<string, { status: string }>).D2?.status, "fail");
  assert.deepEqual(validate(schema, worse), []);
  const better = card({ local: { ...local, "lint.suppressions": 4 } });
  assert.equal(better.summary.regressions, 0);
});

test("a coverage artifact is compared as higher-is-better and a lower value fails", () => {
  const file = (covered: number) => ({
    total: {},
    [`${process.cwd()}/src/features/auth/adapters/postgres-access-store.ts`]: {
      branches: { total: 100, covered },
      lines: { total: 100, covered },
    },
  });
  assert.equal(card({ coverage: file(95) }).summary.regressions, 0);
  const low = card({ coverage: file(50) });
  assert.ok(low.summary.regressions >= 1);
});

test("a bundle route above its baseline fails, and warn mode only warns", () => {
  const withBundle = (mode: string, gz: number): Inputs => ({
    ratchets: {
      ...ratchets,
      bundle: { mode, baseline: { routes: { "/panel": 100 }, rechartsGzBytes: 50 } },
    },
    local,
    bundle: { routes: [{ route: "/panel", gzBytes: gz }], recharts: { gzBytes: 50 } },
  });
  assert.equal(buildScorecard(withBundle("enforce", 101), meta).summary.regressions, 1);
  const warn = buildScorecard(withBundle("warn", 101), meta);
  assert.equal(warn.summary.regressions, 0);
  assert.equal(warn.summary.warnings, 1);
  assert.equal(buildScorecard(withBundle("enforce", 100), meta).summary.regressions, 0);
});

test("a missing local measurement throws instead of becoming zero", () => {
  assert.throws(() => card({ local: {} }), /guard.violations/);
});

test("the suppression counter sees real comments only", () => {
  assert.equal(countSuppressions(process.cwd()), ratchets.lint?.suppressions);
});

test("every file in quality/ratchets parses to an object with sane leaves", () => {
  const walk = (value: unknown, at: string): void => {
    if (typeof value === "number")
      assert.ok(Number.isFinite(value) && value >= 0, `${at} must be a finite number >= 0`);
    if (typeof value !== "object" || value === null) return;
    const entry = value as Record<string, unknown>;
    if (entry.status === "gap")
      assert.ok(
        entry.reason && /^M\d+\.\d+$/.test(String(entry.plannedIn)),
        `${at} gap needs reason and plannedIn`,
      );
    if ("mode" in entry) assert.ok(["enforce", "warn"].includes(String(entry.mode)), `${at}.mode`);
    for (const [k, v] of Object.entries(entry)) walk(v, `${at}.${k}`);
  };
  for (const file of readdirSync("quality/ratchets")) {
    assert.match(file, /^[a-z][a-z0-9.-]*\.json$/);
    const parsed = JSON.parse(readFileSync(`quality/ratchets/${file}`, "utf8"));
    assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed), file);
    walk(parsed, file);
  }
});
