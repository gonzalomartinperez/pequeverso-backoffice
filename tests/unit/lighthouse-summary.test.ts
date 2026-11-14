import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  type Budgets,
  extractRun,
  findMisses,
  median,
  renderMarkdown,
  summarize,
} from "../../scripts/lighthouse-summary.ts";

// SYNTHETIC reports: only the fields the summary reads.
const report = (performance: number, tbt: number) => ({
  categories: {
    performance: { score: performance },
    accessibility: { score: 1 },
    "best-practices": { score: 1 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: 1500 },
    "total-blocking-time": { numericValue: tbt },
    "cumulative-layout-shift": { numericValue: 0 },
    "first-contentful-paint": { numericValue: 800 },
  },
});

describe("lighthouse summary", () => {
  it("takes the median, not the mean, of an odd and an even run count", () => {
    assert.equal(median([3, 100, 1, 2, 4]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.throws(() => median([]));
  });

  it("summarizes five runs per metric and rejects incomplete reports", () => {
    const runs = [0.7, 0.9, 0.5, 0.8, 0.6].map((p, i) =>
      extractRun(report(p, [3000, 100, 2900, 200, 2966][i] as number)),
    );
    const { median: m, runs: count } = summarize(runs);
    assert.equal(count, 5);
    assert.equal(m.performance, 0.7);
    assert.equal(m.tbtMs, 2900);
    assert.throws(() => extractRun({ categories: {}, audits: {} }), /missing category score/);
    assert.throws(() => summarize([]), /no successful/);
  });

  it("lists every missed budget and renders the medians for the job summary", () => {
    const budgets = JSON.parse(readFileSync("quality/ratchets/lighthouse.json", "utf8"))
      .budgets as Budgets;
    const summary = summarize([extractRun(report(0.7, 2966))]);
    const misses = findMisses("dashboard_mobile", summary, budgets);
    assert.deepEqual(
      misses.map((m) => m.split(": ")[1]?.split(" ")[0]),
      ["performance", "TBT"],
    );
    assert.deepEqual(findMisses("x", summarize([extractRun(report(0.95, 100))]), budgets), []);
    assert.match(renderMarkdown({ dashboard_mobile: summary }, misses, "13.6.0"), /\| 0\.7 \|/);
  });

  it("keeps the committed ratchet files parseable with the expected shape", () => {
    const lighthouse = JSON.parse(readFileSync("quality/ratchets/lighthouse.json", "utf8"));
    for (const name of [
      "signin_mobile",
      "signin_desktop",
      "dashboard_mobile",
      "dashboard_desktop",
    ]) {
      const row = lighthouse.baseline[name];
      assert.equal(typeof row.performance, "number", name);
      assert.equal(typeof row.tbtMs, "number", name);
      assert.ok(name in lighthouse.auditReference.values, name);
    }
    assert.match(lighthouse.baselineSource, /^CI run /);
    assert.equal(typeof lighthouse.budgets.tbtMs, "number");
    const bundle = JSON.parse(readFileSync("quality/ratchets/bundle.json", "utf8"));
    assert.equal(typeof bundle.baseline.rechartsGzBytes, "number");
    assert.equal(typeof bundle.baseline.routes["/panel"], "number");
  });
});
