// Pure helpers for scripts/lighthouse-ci.ts: reduce Lighthouse JSON reports to per-metric medians
// and compare them with the budgets in quality/ratchets/lighthouse.json. No I/O here.

export type RunMetrics = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  lcpMs: number;
  tbtMs: number;
  cls: number;
  fcpMs: number;
};
export type Summary = { runs: number; median: RunMetrics };
export type Budgets = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  tbtMs: number;
  lcpMs: number;
  cls: number;
};

type Report = {
  categories?: Record<string, { score?: number | null } | undefined>;
  audits?: Record<string, { numericValue?: number } | undefined>;
};

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1] as number;
  const high = sorted[middle] as number;
  return sorted.length % 2 ? high : (low + high) / 2;
}

/** Reads the fields we track; a report that lacks any of them is rejected, never zero-filled. */
export function extractRun(report: Report): RunMetrics {
  const score = (id: string) => {
    const value = report.categories?.[id]?.score;
    if (typeof value !== "number") throw new Error(`missing category score: ${id}`);
    return value;
  };
  const audit = (id: string) => {
    const value = report.audits?.[id]?.numericValue;
    if (typeof value !== "number") throw new Error(`missing audit value: ${id}`);
    return value;
  };
  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    lcpMs: audit("largest-contentful-paint"),
    tbtMs: audit("total-blocking-time"),
    cls: audit("cumulative-layout-shift"),
    fcpMs: audit("first-contentful-paint"),
  };
}

export function summarize(runs: RunMetrics[]): Summary {
  const keys = Object.keys(runs[0] ?? {}) as (keyof RunMetrics)[];
  if (keys.length === 0) throw new Error("no successful Lighthouse runs");
  const result = {} as RunMetrics;
  for (const key of keys) {
    const digits = key.endsWith("Ms") ? 0 : 3;
    result[key] = Number(median(runs.map((run) => run[key])).toFixed(digits));
  }
  return { runs: runs.length, median: result };
}

/** One sentence per budget the medians miss. Budgets come from testing.md. */
export function findMisses(name: string, summary: Summary, budgets: Budgets): string[] {
  const m = summary.median;
  const misses: string[] = [];
  const atLeast = (label: string, value: number, floor: number) => {
    if (value < floor) misses.push(`${name}: ${label} ${value} is below ${floor}`);
  };
  const atMost = (label: string, value: number, ceiling: number) => {
    if (value > ceiling) misses.push(`${name}: ${label} ${value} is above ${ceiling}`);
  };
  atLeast("performance", m.performance, budgets.performance);
  atLeast("accessibility", m.accessibility, budgets.accessibility);
  atLeast("best practices", m.bestPractices, budgets.bestPractices);
  atMost("TBT ms", m.tbtMs, budgets.tbtMs);
  atMost("LCP ms", m.lcpMs, budgets.lcpMs);
  atMost("CLS", m.cls, budgets.cls);
  return misses;
}

export function renderMarkdown(
  results: Record<string, Summary>,
  misses: string[],
  version: string,
): string {
  const rows = Object.entries(results).map(([name, { runs, median: m }]) =>
    [
      `\`${name}\``,
      runs,
      m.performance,
      m.accessibility,
      m.bestPractices,
      `${m.tbtMs}`,
      `${m.lcpMs}`,
      m.cls,
    ].join(" | "),
  );
  return [
    `### Lighthouse medians (lighthouse ${version}, warn mode)`,
    "",
    "| Target | Runs | Perf | A11y | BP | TBT ms | LCP ms | CLS |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) => `| ${row} |`),
    "",
    misses.length ? misses.map((miss) => `- ${miss}`).join("\n") : "All budgets met.",
  ].join("\n");
}
