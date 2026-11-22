/**
 * The honesty primitive of the dashboard (pure): a tagged value where a missing reading can only
 * be shown as its state, never as `0`. Derivations read the validated ops summary; the clock is
 * always a parameter. Copy for each state lives in presentation (M5), not here.
 */
import type { DailyRow, OpsSummary, RunWindow } from "./summary.ts";
import { acceptedRuns, addMoney, budgetUse, catalogFreshness, percent } from "./summary.ts";

export type UnavailableReason = "not_reported" | "no_budget" | "not_configured" | "source_down";

export type Metric<T> =
  | { state: "ok"; value: T }
  | { state: "stale"; value: T; ageMs: number }
  | { state: "empty" }
  | { state: "unavailable"; reason: UnavailableReason }
  | { state: "withheld" }
  | { state: "error" };

export function ok<T extends NonNullable<unknown>>(value: T): { state: "ok"; value: T } {
  return { state: "ok", value };
}

export function stale<T extends NonNullable<unknown>>(
  value: T,
  ageMs: number,
): { state: "stale"; value: T; ageMs: number } {
  return { state: "stale", value, ageMs };
}

export function empty(): { state: "empty" } {
  return { state: "empty" };
}

export function unavailable(reason: UnavailableReason): {
  state: "unavailable";
  reason: UnavailableReason;
} {
  return { state: "unavailable", reason };
}

export function withheld(): { state: "withheld" } {
  return { state: "withheld" };
}

export function error(): { state: "error" } {
  return { state: "error" };
}

export function fromNullable<T extends NonNullable<unknown>>(
  value: T | null | undefined,
  reason: UnavailableReason = "not_reported",
): Metric<T> {
  return value == null ? unavailable(reason) : ok(value);
}

export function hasValue<T>(metric: Metric<T>): metric is Extract<Metric<T>, { value: T }> {
  return metric.state === "ok" || metric.state === "stale";
}

/** Maps a present value; a mapping that yields null or undefined makes the metric unavailable. */
export function mapMetric<T, U extends NonNullable<unknown>>(
  metric: Metric<T>,
  map: (value: T) => U | null | undefined,
): Metric<U> {
  if (metric.state !== "ok" && metric.state !== "stale") return metric;
  const value = map(metric.value);
  if (value == null) return unavailable("not_reported");
  return metric.state === "ok" ? ok(value) : stale(value, metric.ageMs);
}

export function withheldBelow(count: number | null, k = 3): Metric<number> {
  if (count === null) return unavailable("not_reported");
  if (!Number.isFinite(count) || count < 0) return error();
  return count > 0 && count < k ? withheld() : ok(count);
}

export function completionRate(
  window: RunWindow,
): Metric<{ completed: number; accepted: number; percent: number }> {
  const { completed } = window.runs;
  const accepted = acceptedRuns(window.runs);
  if (completed === null || accepted === null) return unavailable("not_reported");
  if (accepted === 0) return empty();
  const rate = percent(completed, accepted);
  return rate === null ? unavailable("not_reported") : ok({ completed, accepted, percent: rate });
}

export function failureShare(
  window: RunWindow,
): Metric<{ failed: number; accepted: number; percent: number }> {
  const { failed } = window.runs;
  const accepted = acceptedRuns(window.runs);
  if (failed === null || accepted === null) return unavailable("not_reported");
  if (accepted === 0) return empty();
  const rate = percent(failed, accepted);
  return rate === null ? unavailable("not_reported") : ok({ failed, accepted, percent: rate });
}

export function remainingBudget(summary: OpsSummary): Metric<string> {
  return summary.budget === null
    ? unavailable("no_budget")
    : fromNullable(summary.budget.remainingMonth);
}

export function priceExpiry(
  summary: OpsSummary,
  now: Date,
): Metric<{ expiresAt: Date; remainingMs: number }> {
  const { verifiedAt, priceMaxAgeHours, priceStatus } = summary.catalog;
  if (verifiedAt === null || priceMaxAgeHours === null) return unavailable("not_reported");
  const expiresAt = new Date(verifiedAt.getTime() + priceMaxAgeHours * 3_600_000);
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs)) return error();
  const value = { expiresAt, remainingMs };
  // The API's own verdict wins, as in catalogFreshness: "unverified" is stale even before expiry.
  if (remainingMs < 0 || priceStatus === "unverified")
    return stale(value, Math.max(0, -remainingMs));
  return ok(value);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function monthProjection(
  daily: readonly DailyRow[],
  monthToDate: string | null,
  now: Date,
): Metric<string> {
  if (Number.isNaN(now.getTime())) return error();
  // Complete UTC days only: today's row is still accruing, so it is never averaged.
  const today = now.toISOString().slice(0, 10);
  const days = daily.filter(({ day }) => ISO_DAY.test(day) && day < today);
  if (new Set(days.map(({ day }) => day)).size !== days.length) return unavailable("not_reported");
  const recent = days
    .filter(({ confirmed, estimated }) => confirmed !== null && estimated !== null)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .slice(0, 7);
  if (recent.length < 7) return empty();
  if (monthToDate === null) return unavailable("not_reported");

  const total = addMoney(
    ...recent.map(({ confirmed, estimated }) => addMoney(confirmed, estimated)),
  );
  if (total === null) return unavailable("not_reported");
  const totalMicros = BigInt(total.replace(".", ""));
  // Division by seven rounds up in magnitude when the remainder is at least four.
  const averageMicros = (totalMicros + (totalMicros < 0n ? -3n : 3n)) / 7n;

  const monthEnd = new Date(now.getTime());
  monthEnd.setUTCMonth(now.getUTCMonth() + 1, 0);
  const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate();
  const projectedMicros = averageMicros * BigInt(daysRemaining);
  const negative = projectedMicros < 0n;
  const digits = (negative ? -projectedMicros : projectedMicros).toString().padStart(7, "0");
  const projectedSpend = `${negative ? "-" : ""}${digits.slice(0, -6)}.${digits.slice(-6)}`;
  return fromNullable(addMoney(monthToDate, projectedSpend));
}

export type StampReason =
  | "unavailable"
  | "budget_exhausted"
  | "budget_low"
  | "prices_stale"
  | "catalog_missing"
  | "failures_high"
  | "no_data";

function criticalReasons(summary: OpsSummary): StampReason[] {
  const reasons: StampReason[] = [];
  const budget = remainingBudget(summary);
  if (summary.availability.status === "unavailable") reasons.push("unavailable");
  if (summary.catalog.status === "missing") reasons.push("catalog_missing");
  if (budget.state === "ok" && Number(budget.value) <= 0) reasons.push("budget_exhausted");
  return reasons;
}

function warningReasons(
  summary: OpsSummary,
  now: Date,
  critical: readonly StampReason[],
): StampReason[] {
  const reasons: StampReason[] = [];
  // Computable from the limit and spend even when the API omits the remaining amount.
  const used = budgetUse(summary);
  if (!critical.includes("budget_exhausted") && used !== null && used >= 90)
    reasons.push("budget_low");
  if (catalogFreshness(summary, now) === "stale") reasons.push("prices_stale");
  const firstWindow = summary.windows[0];
  const failures = firstWindow && failureShare(firstWindow);
  if (failures?.state === "ok" && failures.value.accepted >= 5 && failures.value.percent >= 20)
    reasons.push("failures_high");
  return reasons;
}

export function stampStatus(
  summary: OpsSummary,
  now: Date,
): { status: "ok" | "warn" | "critical" | "unknown"; reasons: StampReason[] } {
  const critical = criticalReasons(summary);
  const reasons: StampReason[] = [...critical, ...warningReasons(summary, now, critical)];
  const firstWindow = summary.windows[0];
  if (critical.length > 0) return { status: "critical", reasons };
  if (reasons.length > 0) return { status: "warn", reasons };
  if (!firstWindow || completionRate(firstWindow).state === "unavailable") {
    return { status: "unknown", reasons: ["no_data"] };
  }
  return { status: "ok", reasons };
}
