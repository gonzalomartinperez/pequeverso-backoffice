import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import fc from "fast-check";
import { parseOpsSummary } from "../../src/features/operations/adapters/validate.ts";
import type { Metric } from "../../src/features/operations/domain/metric.ts";
import {
  completionRate,
  empty,
  error,
  failureShare,
  fromNullable,
  hasValue,
  mapMetric,
  monthProjection,
  ok,
  priceExpiry,
  remainingBudget,
  stale,
  stampStatus,
  unavailable,
  withheld,
  withheldBelow,
} from "../../src/features/operations/domain/metric.ts";
import type { OpsSummary } from "../../src/features/operations/domain/summary.ts";
import { propertyOptions } from "./support/property.ts";

test("metric constructors distinguish reported zero, stale values and absent values", () => {
  assert.deepEqual(ok(0), { state: "ok", value: 0 });
  assert.deepEqual(stale(0, 10), { state: "stale", value: 0, ageMs: 10 });
  assert.deepEqual(empty(), { state: "empty" });
  assert.deepEqual(unavailable("source_down"), { state: "unavailable", reason: "source_down" });
  assert.deepEqual(withheld(), { state: "withheld" });
  assert.deepEqual(error(), { state: "error" });
});

test("fromNullable preserves zero and preserves the reason for missing values", () => {
  assert.deepEqual(fromNullable(0), ok(0));
  assert.deepEqual(fromNullable(null), unavailable("not_reported"));
  assert.deepEqual(fromNullable(undefined, "not_configured"), unavailable("not_configured"));
});

test("mapMetric transforms only states that have a value", () => {
  assert.equal(hasValue(ok(0)), true);
  assert.equal(hasValue(stale(0, 5)), true);
  assert.deepEqual(mapMetric(ok(0), String), ok("0"));
  assert.deepEqual(mapMetric(stale(0, 5), String), stale("0", 5));
  assert.deepEqual(
    mapMetric(ok(1), () => null),
    unavailable("not_reported"),
  );
  assert.deepEqual(
    mapMetric(stale(1, 5), () => undefined),
    unavailable("not_reported"),
  );
  for (const metric of [empty(), unavailable("not_reported"), withheld(), error()]) {
    assert.equal(hasValue(metric), false);
    assert.equal(
      mapMetric(metric, () => assert.fail("missing value was mapped")),
      metric,
    );
  }
});

test("withheldBelow keeps zero and suppresses positive counts below the threshold", () => {
  assert.deepEqual(withheldBelow(null), unavailable("not_reported"));
  assert.deepEqual(withheldBelow(0), ok(0));
  assert.deepEqual(withheldBelow(1), withheld());
  assert.deepEqual(withheldBelow(2), withheld());
  assert.deepEqual(withheldBelow(3), ok(3));
  assert.deepEqual(withheldBelow(3, 4), withheld());
  assert.deepEqual(withheldBelow(4, 4), ok(4));
  for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY])
    assert.deepEqual(withheldBelow(bad), error());
});

const summary = parseOpsSummary(
  JSON.parse(readFileSync("contracts/ops/summary.fixture.json", "utf8")),
);
const [firstWindow, secondWindow] = summary.windows;
const [firstDay] = summary.daily;
const budget = summary.budget;
assert.ok(firstWindow && secondWindow && firstDay && budget);

const noRuns = { completed: 0, failed: 0, cancelled: 0, interrupted: 0, refused: 2 };
const now = summary.generatedAt;
// The fixture's last daily row is the day of `generatedAt`, still accruing: projections read the
// next day, when all seven fixture rows are complete.
const nextDay = new Date("2026-10-06T12:00:00Z");
const notReported = unavailable("not_reported");

test("run rates use accepted outcomes and round to one decimal", () => {
  assert.deepEqual(completionRate(firstWindow), ok({ completed: 52, accepted: 58, percent: 89.7 }));
  assert.deepEqual(failureShare(firstWindow), ok({ failed: 2, accepted: 58, percent: 3.4 }));
  const refusedMissing = { ...firstWindow, runs: { ...firstWindow.runs, refused: null } };
  assert.deepEqual(completionRate(refusedMissing), completionRate(firstWindow));
  assert.deepEqual(failureShare(refusedMissing), failureShare(firstWindow));
});

test("run rates distinguish zero accepted runs, a zero numerator and missing counts", () => {
  const window = { ...firstWindow, runs: noRuns };
  assert.deepEqual(completionRate(window), empty());
  assert.deepEqual(failureShare(window), empty());
  const allCancelled = { ...window, runs: { ...noRuns, cancelled: 5 } };
  assert.deepEqual(completionRate(allCancelled), ok({ completed: 0, accepted: 5, percent: 0 }));
  assert.deepEqual(failureShare(allCancelled), ok({ failed: 0, accepted: 5, percent: 0 }));
  for (const outcome of ["completed", "failed", "cancelled", "interrupted"] as const) {
    const missing = { ...window, runs: { ...noRuns, [outcome]: null } };
    assert.deepEqual(completionRate(missing), notReported);
    assert.deepEqual(failureShare(missing), notReported);
  }
});

test("remainingBudget distinguishes absent budget, missing amount and reported money", () => {
  assert.deepEqual(remainingBudget({ ...summary, budget: null }), unavailable("no_budget"));
  assert.deepEqual(
    remainingBudget({ ...summary, budget: { ...budget, remainingMonth: null } }),
    notReported,
  );
  assert.deepEqual(
    remainingBudget({ ...summary, budget: { ...budget, remainingMonth: "0" } }),
    ok("0"),
  );
  assert.deepEqual(remainingBudget(summary), ok("8.564300"));
});

test("priceExpiry requires both inputs and preserves expiry when stale", () => {
  for (const key of ["verifiedAt", "priceMaxAgeHours"] as const) {
    assert.deepEqual(
      priceExpiry({ ...summary, catalog: { ...summary.catalog, [key]: null } }, now),
      notReported,
    );
  }
  const expiresAt = new Date("2026-10-11T10:00:00Z");
  assert.deepEqual(priceExpiry(summary, now), ok({ expiresAt, remainingMs: 511_200_000 }));
  assert.deepEqual(priceExpiry(summary, expiresAt), ok({ expiresAt, remainingMs: 0 }));
  assert.deepEqual(
    priceExpiry(summary, new Date("2026-10-11T10:00:00.001Z")),
    stale({ expiresAt, remainingMs: -1 }, 1),
  );
  const zeroHours = {
    ...summary,
    catalog: { ...summary.catalog, verifiedAt: now, priceMaxAgeHours: 0 },
  };
  assert.deepEqual(priceExpiry(zeroHours, now), ok({ expiresAt: now, remainingMs: 0 }));
  const unverified = {
    ...summary,
    catalog: { ...summary.catalog, priceStatus: "unverified" as const },
  };
  assert.deepEqual(priceExpiry(unverified, now), stale({ expiresAt, remainingMs: 511_200_000 }, 0));
  assert.deepEqual(priceExpiry(summary, new Date(Number.NaN)), error());
});

test("monthProjection selects the seven newest complete rows without changing their input order", () => {
  const rows = [
    { ...firstDay, day: "2026-10-07", confirmed: null },
    ...summary.daily.toReversed(),
    { ...firstDay, day: "2026-09-28", confirmed: "50" },
    { ...firstDay, day: "2026-10-06", estimated: null },
  ];
  const before = rows.slice();
  assert.deepEqual(monthProjection(rows, "0.430300", nextDay), ok("1.968150"));
  assert.deepEqual(rows, before);
});

test("monthProjection distinguishes insufficient rows and a missing month-to-date amount", () => {
  assert.deepEqual(monthProjection(summary.daily, null, nextDay), notReported);
  assert.deepEqual(monthProjection(summary.daily.slice(1), "0", nextDay), empty());
  assert.deepEqual(monthProjection(summary.daily.slice(1), null, nextDay), empty());
  const incomplete = summary.daily.map((row) => ({ ...row, estimated: null }));
  assert.deepEqual(monthProjection(incomplete, "0", nextDay), empty());
});

test("monthProjection never averages today's or later rows, duplicates or malformed days", () => {
  // On the fixture's own day only six rows are complete.
  assert.deepEqual(monthProjection(summary.daily, "0", now), empty());
  const future = [...summary.daily, { ...firstDay, day: "2026-10-09" }];
  assert.deepEqual(
    monthProjection(future, "0.430300", nextDay),
    monthProjection(summary.daily, "0.430300", nextDay),
  );
  const duplicate = [...summary.daily, { ...firstDay }];
  assert.deepEqual(monthProjection(duplicate, "0", nextDay), notReported);
  const malformed = [...summary.daily.slice(1), { ...firstDay, day: "2026-9-29" }];
  assert.deepEqual(monthProjection(malformed, "0", nextDay), empty());
  assert.deepEqual(monthProjection(summary.daily, "0", new Date(Number.NaN)), error());
});

test("monthProjection rounds the average in micro-dollars before multiplying", () => {
  const rows = summary.daily.map((row) => ({ ...row, confirmed: "0", estimated: "0" }));
  const small = [...rows.slice(1), { ...firstDay, confirmed: "0.000003", estimated: "0" }];
  const large = [...rows.slice(1), { ...firstDay, confirmed: "0.000003", estimated: "0.000001" }];
  const negative = [...rows.slice(1), { ...firstDay, confirmed: "-0.000004", estimated: "0" }];
  assert.deepEqual(monthProjection(small, "0", nextDay), ok("0.000000"));
  assert.deepEqual(monthProjection(large, "999999999.999999", nextDay), ok("1000000000.000024"));
  assert.deepEqual(monthProjection(negative, "0", nextDay), ok("-0.000025"));
});

test("monthProjection uses the UTC month end and excludes today", () => {
  const rows = summary.daily.map((row) => ({ ...row, confirmed: "1", estimated: "0.5" }));
  assert.deepEqual(
    monthProjection(rows, "2", new Date("2028-02-29T00:30:00+01:00")),
    ok("3.500000"),
  );
  assert.deepEqual(monthProjection(rows, "2", new Date("2028-02-29T00:30:00Z")), ok("2.000000"));
  assert.deepEqual(monthProjection(rows, "2", new Date("2026-12-30T12:00:00Z")), ok("3.500000"));
});

test("stampStatus is ok for healthy, empty or unconfigured readings; low budget needs no remaining amount", () => {
  assert.deepEqual(stampStatus(summary, now), { status: "ok", reasons: [] });
  assert.deepEqual(
    stampStatus({ ...summary, budget: null, windows: [{ ...firstWindow, runs: noRuns }] }, now),
    { status: "ok", reasons: [] },
  );
  assert.deepEqual(
    stampStatus(
      {
        ...summary,
        budget: {
          ...budget,
          remainingMonth: null,
          monthSpend: { ...budget.monthSpend, pending: "10" },
        },
      },
      now,
    ),
    { status: "warn", reasons: ["budget_low"] },
  );
  assert.deepEqual(stampStatus({ ...summary, budget: { ...budget, monthlyLimit: null } }, now), {
    status: "ok",
    reasons: [],
  });
});

test("stampStatus reports budget exhaustion at zero and below", () => {
  for (const remainingMonth of ["0", "-0.01"]) {
    assert.deepEqual(stampStatus({ ...summary, budget: { ...budget, remainingMonth } }, now), {
      status: "critical",
      reasons: ["budget_exhausted"],
    });
  }
});

test("stampStatus lists all qualifying reasons in priority order", () => {
  const combined: OpsSummary = {
    ...summary,
    catalog: { ...summary.catalog, status: "missing", priceStatus: "unverified" },
    budget: {
      ...budget,
      remainingMonth: "0",
      monthSpend: { confirmed: "8", estimated: "0.5", pending: "0.5" },
    },
    windows: [{ ...firstWindow, runs: { ...noRuns, completed: 4, failed: 1 } }],
  };
  assert.deepEqual(
    stampStatus({ ...combined, availability: { status: "unavailable", reason: null } }, now),
    {
      status: "critical",
      reasons: [
        "unavailable",
        "catalog_missing",
        "budget_exhausted",
        "prices_stale",
        "failures_high",
      ],
    },
  );
});

test("stampStatus warns at the budget and failure thresholds and uses only the first window", () => {
  const atThreshold = { ...firstWindow, runs: { ...noRuns, completed: 4, failed: 1 } };
  const belowMinimum = { ...firstWindow, runs: { ...noRuns, completed: 3, failed: 1 } };
  const belowShare = { ...firstWindow, runs: { ...noRuns, completed: 5, failed: 1 } };
  const lowBudget = { ...budget, monthSpend: { confirmed: "8", estimated: "0.5", pending: "0.5" } };
  assert.deepEqual(
    stampStatus({ ...summary, budget: lowBudget, windows: [atThreshold, secondWindow] }, now),
    {
      status: "warn",
      reasons: ["budget_low", "failures_high"],
    },
  );
  for (const window of [belowMinimum, belowShare]) {
    assert.deepEqual(stampStatus({ ...summary, windows: [window, atThreshold] }, now), {
      status: "ok",
      reasons: [],
    });
  }
});

test("stampStatus reports missing run data only in the absence of critical reasons or warnings", () => {
  const missing = { ...firstWindow, runs: { ...firstWindow.runs, completed: null } };
  for (const windows of [[], [missing, secondWindow]]) {
    assert.deepEqual(stampStatus({ ...summary, windows }, now), {
      status: "unknown",
      reasons: ["no_data"],
    });
  }
  assert.deepEqual(
    stampStatus(
      { ...summary, windows: [], catalog: { ...summary.catalog, priceStatus: "unverified" } },
      now,
    ),
    { status: "warn", reasons: ["prices_stale"] },
  );
  assert.deepEqual(
    stampStatus(
      { ...summary, windows: [], catalog: { ...summary.catalog, status: "missing" } },
      now,
    ),
    { status: "critical", reasons: ["catalog_missing"] },
  );
});

const options = propertyOptions("property");

test("property: fromNullable preserves every number and never gives a value to nullish input", () => {
  fc.assert(
    fc.property(fc.double(), (value) => {
      assert.deepEqual(fromNullable(value), ok(value));
      assert.equal(hasValue(fromNullable(null)), false);
      assert.equal(hasValue(fromNullable(undefined)), false);
    }),
    options,
  );
});

const count = fc.integer({ min: 0, max: 1_000_000_000 });
const runCounts = fc.record({
  completed: count,
  failed: count,
  cancelled: count,
  interrupted: count,
  refused: count,
});

test("property: run rates stay within accepted counts and require every accepted outcome", () => {
  fc.assert(
    fc.property(runCounts, (runs) => {
      const window = { ...firstWindow, runs };
      const completion = completionRate(window);
      const failure = failureShare(window);
      if (completion.state === "ok") {
        const { completed, accepted, percent } = completion.value;
        assert.ok(completed <= accepted && percent >= 0 && percent <= 100);
      }
      if (failure.state === "ok") {
        const { failed, accepted, percent } = failure.value;
        assert.ok(failed <= accepted && percent >= 0 && percent <= 100);
      }
      for (const outcome of ["completed", "failed", "cancelled", "interrupted"] as const) {
        const missing = { ...window, runs: { ...runs, [outcome]: null } };
        assert.notEqual(completionRate(missing).state, "ok");
        assert.notEqual(failureShare(missing).state, "ok");
      }
    }),
    options,
  );
});

const money = count.map((micros) => (micros / 1_000_000).toFixed(6));
const reportedCosts = fc.record({ confirmed: money, estimated: money });
const incompleteCosts = fc.oneof(
  fc.record({ confirmed: fc.constant(null), estimated: money }),
  fc.record({ confirmed: money, estimated: fc.constant(null) }),
);
const octoberDay = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;

test("property: fewer than seven complete cost rows always yields empty", () => {
  fc.assert(
    fc.property(
      fc.array(reportedCosts, { maxLength: 6 }),
      fc.array(incompleteCosts, { maxLength: 12 }),
      fc.option(money),
      (complete, incomplete, monthToDate) => {
        const rows = [...complete, ...incomplete].map((costs, index) => ({
          ...firstDay,
          ...costs,
          day: octoberDay(index + 1),
        }));
        assert.deepEqual(monthProjection(rows, monthToDate, now), empty());
      },
    ),
    options,
  );
});

test("property: projections are finite and at least month-to-date for nonnegative costs", () => {
  fc.assert(
    fc.property(
      fc.array(reportedCosts, { minLength: 7, maxLength: 12 }),
      money,
      fc.integer({ min: 1, max: 30 }),
      (costs, monthToDate, today) => {
        const rows = costs.map((row, index) => ({
          ...firstDay,
          ...row,
          day: octoberDay(index + 1),
        }));
        const result = monthProjection(
          rows,
          monthToDate,
          new Date(`2026-11-${String(today).padStart(2, "0")}T12:00:00Z`),
        );
        assert.equal(result.state, "ok");
        assert.match(result.value, /^\d+\.\d{6}$/);
        const projected = Number(result.value);
        assert.ok(Number.isFinite(projected) && projected >= Number(monthToDate));
      },
    ),
    options,
  );
});

test("property: mapMetric preserves every state tag", () => {
  fc.assert(
    fc.property(fc.double(), count, (value, ageMs) => {
      const metrics: Metric<number>[] = [
        ok(value),
        stale(value, ageMs),
        empty(),
        notReported,
        withheld(),
        error(),
      ];
      for (const metric of metrics) assert.equal(mapMetric(metric, String).state, metric.state);
    }),
    options,
  );
});
