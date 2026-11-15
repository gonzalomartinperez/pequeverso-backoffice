import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AXES,
  buildScorecard,
  countSuppressions,
  deletedRatchets,
  type Inputs,
  loadRatchets,
  loosening,
  measureLocal,
  parseFlags,
  type Run,
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
  bad.axes.D3?.metrics.push({ id: "x", status: "gap", reason: "r", plannedIn: "M2.1" });
  assert.deepEqual(validate(schema, bad), []);
  bad.axes.D3?.metrics.pop();
  bad.axes.D3?.metrics.push({ id: "x", status: "gap", reason: "r" });
  const errors = validate(schema, bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /oneOf/);
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

const bundleArtifact = (gz: number, routes = ["/panel"]) => ({
  routes: routes.map((route) => ({ route, gzBytes: gz })),
  fonts: { bytes: 10 },
  recharts: { gzBytes: 50 },
});
const bundleRatchet = (mode: string, extra: object = {}) => ({
  mode,
  baseline: { routes: { "/panel": 100 }, fontsBytes: 10, rechartsGzBytes: 50, ...extra },
});

test("a bundle route above its baseline fails, and warn mode only warns", () => {
  const withBundle = (mode: string, gz: number): Inputs => ({
    ratchets: { ...ratchets, bundle: bundleRatchet(mode) },
    local,
    bundle: bundleArtifact(gz),
  });
  assert.equal(buildScorecard(withBundle("enforce", 101), meta).summary.regressions, 1);
  const warn = buildScorecard(withBundle("warn", 101), meta);
  assert.equal(warn.summary.regressions, 0);
  assert.equal(warn.summary.warnings, 1);
  assert.equal(buildScorecard(withBundle("enforce", 100), meta).summary.regressions, 0);
});

test("a bundle artifact without a usable baseline or complete routes throws", () => {
  const run = (bundleRatchetValue: unknown, bundle: Record<string, unknown>) =>
    buildScorecard(
      { ratchets: { ...ratchets, bundle: bundleRatchetValue as never }, local, bundle },
      meta,
    );
  assert.throws(() => run({ mode: "warn" }, bundleArtifact(1)), /no baseline routes/);
  assert.throws(
    () => run(bundleRatchet("warn"), { ...bundleArtifact(1), routes: "x" }),
    /routes array/,
  );
  assert.throws(
    () => run(bundleRatchet("warn"), bundleArtifact(1, ["/other"])),
    /lacks the baseline route/,
  );
  assert.throws(
    () => run(bundleRatchet("warn", { fontsBytes: undefined }), bundleArtifact(1)),
    /fontsBytes/,
  );
});

const lhRatchet = { mode: "warn", baseline: { signin: { performance: 0.9, tbtMs: 100, cls: 0 } } };
const lhArtifact = (median: object, complete = true) => ({
  complete,
  results: { signin: { runs: 5, median } },
});
const lh = (ratchet: unknown, artifact: Record<string, unknown>) =>
  buildScorecard(
    { ratchets: { ...ratchets, lighthouse: ratchet as never }, local, lighthouse: artifact },
    meta,
  );

test("lighthouse reads the real summary shape with explicit directions and emits every metric", () => {
  const ok = lh(lhRatchet, lhArtifact({ performance: 0.95, tbtMs: 90, cls: 0 }));
  assert.equal(ok.summary.regressions + ok.summary.warnings, 0);
  assert.equal(ok.summary.measured, 4 + 3);
  assert.equal(
    lh(lhRatchet, lhArtifact({ performance: 0.8, tbtMs: 90, cls: 0 })).summary.warnings,
    1,
  );
  assert.equal(
    lh(lhRatchet, lhArtifact({ performance: 0.95, tbtMs: 150, cls: 0 })).summary.warnings,
    1,
  );
  assert.throws(() => lh(lhRatchet, lhArtifact({ performance: 1, tbtMs: 1 })), /cls/);
  assert.throws(() => lh(lhRatchet, lhArtifact({ performance: 1 }, false)), /incomplete/);
  assert.throws(() => lh({ mode: "warn" }, lhArtifact({})), /no baseline/);
  assert.throws(() => lh({ baseline: {} }, lhArtifact({})), /no baseline/);
  assert.throws(
    () => lh({ baseline: { signin: { mystery: 1 } } }, lhArtifact({ mystery: 1 })),
    /unknown Lighthouse metric/,
  );
});

test("the committed lighthouse and bundle ratchets match the artifact shapes", () => {
  const b = ratchets.bundle?.baseline as { routes: Record<string, number> } | undefined;
  const l = ratchets.lighthouse?.baseline as Record<string, Record<string, number>> | undefined;
  if (b) {
    const artifact = bundleArtifact(0, Object.keys(b.routes));
    const base = ratchets.bundle?.baseline as { fontsBytes: number; rechartsGzBytes: number };
    artifact.fonts.bytes = base.fontsBytes;
    artifact.recharts.gzBytes = base.rechartsGzBytes;
    const result = card({ bundle: artifact });
    assert.equal(result.summary.warnings + result.summary.regressions, 0);
    assert.equal(result.summary.measured, 4 + Object.keys(b.routes).length + 2);
  }
  if (l)
    assert.equal(
      card({
        lighthouse: {
          complete: true,
          results: Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { median: v }])),
        },
      }).summary.regressions,
      0,
    );
});

test("ratchet files with a missing or non-numeric limit throw instead of passing", () => {
  assert.throws(() => card({ ratchets: { ...ratchets, lint: {} } }), /lint\.suppressions/);
  assert.throws(() => card({ ratchets: { ...ratchets, types: { errors: "0" } } }), /types\.errors/);
  assert.throws(
    () => card({ ratchets: { ...ratchets, guard: undefined as never } }),
    /guard\.violations/,
  );
});

test("a crashed, killed or contradictory command is an error, never zero", () => {
  const ok = { status: 0, out: "0 violations\n0 missing" };
  const runner = (tsc: Run) => (args: string[]) => (args[0]?.includes("tsc") ? tsc : ok);
  assert.equal(measureLocal(".", runner({ status: 0, out: "" }))["types.errors"], 0);
  assert.equal(
    measureLocal(".", runner({ status: 2, out: "x.ts: error TS1005: y" }))["types.errors"],
    1,
  );
  assert.throws(() => measureLocal(".", runner({ status: 1, out: "boom" })), /no findings/);
  assert.throws(() => measureLocal(".", runner({ status: null, out: "" })), /killed/);
  assert.throws(
    () => measureLocal(".", runner({ status: null, error: new Error("ENOENT"), out: "" })),
    /could not run/,
  );
  assert.throws(
    () => measureLocal(".", () => ({ status: 0, out: "nothing useful" })),
    /could not read/,
  );
});

test("loosening a ratchet against the base revision is reported, tightening is not", () => {
  assert.equal(loosening("lint", { suppressions: 5 }, { suppressions: 6 }).length, 1);
  assert.equal(loosening("lint", { suppressions: 5 }, {}).length, 1);
  assert.equal(loosening("lint", { suppressions: 5 }, { suppressions: 4 }).length, 0);
  assert.equal(loosening("coverage", { branchRepo: 86 }, { branchRepo: 85 }).length, 1);
  assert.equal(loosening("coverage", { branchRepo: 86 }, { branchRepo: 87 }).length, 0);
  const b = { baseline: { s: { performance: 0.9, tbtMs: 100 } } };
  assert.equal(
    loosening("lighthouse", b, { baseline: { s: { performance: 0.8, tbtMs: 100 } } }).length,
    1,
  );
  assert.equal(
    loosening("lighthouse", b, { baseline: { s: { performance: 0.9, tbtMs: 120 } } }).length,
    1,
  );
  assert.equal(
    loosening("lighthouse", b, { baseline: { s: { performance: 1, tbtMs: 90 } } }).length,
    0,
  );
  assert.equal(
    loosening("bundle", { baseline: { fontsBytes: 5 } }, { baseline: { fontsBytes: 6 } }).length,
    1,
  );
});

test("switching to warn, moving the warn window or raising a budget is loosening", () => {
  assert.equal(loosening("lint", { suppressions: 5 }, { suppressions: 5, mode: "warn" }).length, 1);
  assert.equal(loosening("lint", { suppressions: 5, mode: "warn" }, { suppressions: 5 }).length, 0);
  const lh = {
    mode: "warn",
    warnSince: "2026-11-14",
    enforceAfterDays: 14,
    budgets: { tbtMs: 200, performance: 0.9 },
  };
  assert.equal(loosening("lighthouse", lh, { ...lh }).length, 0);
  assert.equal(loosening("lighthouse", lh, { ...lh, warnSince: "2026-11-20" }).length, 1);
  assert.equal(loosening("lighthouse", lh, { ...lh, enforceAfterDays: 30 }).length, 1);
  assert.equal(
    loosening("lighthouse", lh, { ...lh, budgets: { tbtMs: 300, performance: 0.9 } }).length,
    1,
  );
  assert.equal(
    loosening("lighthouse", lh, { ...lh, budgets: { tbtMs: 200, performance: 0.8 } }).length,
    1,
  );
  assert.equal(
    loosening("lighthouse", lh, { ...lh, budgets: { tbtMs: 150, performance: 0.95 } }).length,
    0,
  );
  assert.equal(loosening("bundle", { budgets: { fontsBytes: 5 } }, { budgets: {} }).length, 1);
});

test("a ratchet file present at the base revision and gone at HEAD is reported", () => {
  const ls =
    "quality/ratchets/coverage.json\nquality/ratchets/lint.json\nquality/ratchets/README.md\n";
  assert.deepEqual(deletedRatchets(ls, ["lint"]), ["quality/ratchets/coverage.json"]);
  assert.deepEqual(deletedRatchets(ls, ["lint", "coverage", "bundle"]), []);
});

test("flags need a value that does not start with --", () => {
  assert.deepEqual(parseFlags(["--out", "a.json"]), { "--out": "a.json" });
  assert.throws(() => parseFlags(["--out"]), /needs a value/);
  assert.throws(() => parseFlags(["--out", "--bundle"]), /needs a value/);
  assert.throws(() => parseFlags(["--nope", "x"]), /unknown argument/);
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
