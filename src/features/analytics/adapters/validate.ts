import {
  type Counts,
  profileSource,
  type Report,
  type Selection,
  validSelection,
} from "../domain/report.ts";
import { calendarWindow } from "./calendar.ts";

function need(value: unknown): asserts value {
  if (!value) throw new Error("Invalid analytics aggregate");
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value));
  const row = value as Record<string, unknown>;
  need(Object.keys(row).length === keys.length && keys.every((key) => Object.hasOwn(row, key)));
  return row;
}
function integer(value: unknown, min = 0, max = 310000): number {
  need(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max);
  return value;
}
function rows(value: unknown, max: number): unknown[] {
  need(Array.isArray(value) && value.length <= max);
  return value;
}
function timestamp(value: unknown): string {
  need(
    typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value),
  );
  const instant = new Date(value);
  need(Number.isFinite(instant.getTime()));
  // Date parsing normalizes invalid dates, so compare the actual UTC calendar/time fields.
  need(instant.toISOString().slice(0, 19) === value.slice(0, 19));
  return instant.toISOString();
}
function counts(value: unknown, daily = false): Counts {
  const row = object(
    value,
    daily
      ? ["day", "page_views", "section_views", "public_clicks"]
      : ["page_views", "section_views", "public_clicks"],
  );
  const result = {
    page_views: integer(row.page_views),
    section_views: integer(row.section_views),
    public_clicks: integer(row.public_clicks),
  };
  need(sum(result) <= (daily ? 10000 : 310000));
  return result;
}
export const sum = (counts: Counts) =>
  counts.page_views + counts.section_views + counts.public_clicks;
export function parseAnalyticsReport(value: unknown, expected: Selection): Report {
  const root = object(value, [
    "schema_version",
    "project",
    "layout_revision",
    "profile_source_revision",
    "synthetic",
    "coverage",
    "timezone",
    "country_collection",
    "retention_days",
    "min_bucket",
    "generated_at",
    "selection",
    "start",
    "end",
    "partial",
    "first_observed_at",
    "last_observed_at",
    "totals",
    "daily",
    "countries",
    "grid",
  ]);
  need(
    root.schema_version === 1 &&
      root.project === "pequeverso" &&
      root.layout_revision === "pequeverso-v1" &&
      root.profile_source_revision === profileSource &&
      root.synthetic === true &&
      root.coverage === "received_events_only" &&
      root.timezone === "UTC" &&
      root.country_collection === "disabled" &&
      root.retention_days === 93 &&
      root.min_bucket === 3,
  );
  const rawSelection = object(root.selection, [
    "period",
    "offset",
    "route",
    "section_id",
    "viewport_bucket",
    "locale",
  ]);
  const selection = validSelection(rawSelection);
  need(selection && Object.entries(expected).every(([key, field]) => rawSelection[key] === field));
  const generated = timestamp(root.generated_at),
    start = timestamp(root.start),
    end = timestamp(root.end);
  const calendar = calendarWindow(generated, selection);
  need(start === calendar.start && end === calendar.end && root.partial === calendar.partial);
  const first = root.first_observed_at === null ? null : timestamp(root.first_observed_at);
  const last = root.last_observed_at === null ? null : timestamp(root.last_observed_at);
  need((first === null) === (last === null));
  if (first !== null && last !== null)
    need(first >= start && first < end && last >= first && last < end && last <= generated);
  const totals = counts(root.totals);
  need((sum(totals) === 0) === (first === null));
  const seenDays = new Set<string>();
  const daily = rows(root.daily, 31).map((value) => {
    const row = object(value, ["day", "page_views", "section_views", "public_clicks"]);
    need(typeof row.day === "string" && /^\d{4}-\d\d-\d\d$/.test(row.day));
    const date = timestamp(`${row.day}T00:00:00Z`);
    need(
      date >= start &&
        date < end &&
        date.slice(0, 10) <= generated.slice(0, 10) &&
        !seenDays.has(row.day),
    );
    seenDays.add(row.day);
    return { ...counts(row, true), day: row.day };
  });
  for (const key of ["page_views", "section_views", "public_clicks"] as const)
    need(daily.reduce((total, row) => total + row[key], 0) === totals[key]);
  const countries = rows(root.countries, 1).map((value): Report["countries"][number] => {
    const row = object(value, ["code", "count"]);
    need(row.code === "unknown" || row.code === "withheld");
    const count = integer(row.count, 1);
    need(row.code === (count < 3 ? "withheld" : "unknown"));
    return { code: row.code, count };
  });
  need(countries.reduce((total, row) => total + row.count, 0) === sum(totals));
  const rawGrid = object(root.grid, [
    "available",
    "visible_clicks",
    "withheld_clicks",
    "unselected_clicks",
    "cells",
  ]);
  need(rawGrid.available === (selection.route !== "all" && selection.section_id !== "all"));
  const seenCells = new Set<string>();
  const cells = rows(rawGrid.cells, 64).map((value) => {
    const row = object(value, ["x", "y", "count"]);
    const x = integer(row.x, 0, 7),
      y = integer(row.y, 0, 7),
      count = integer(row.count, 3);
    need(!seenCells.has(`${x}:${y}`));
    seenCells.add(`${x}:${y}`);
    return { x, y, count };
  });
  const grid = {
    available: rawGrid.available as boolean,
    visible_clicks: integer(rawGrid.visible_clicks),
    withheld_clicks: integer(rawGrid.withheld_clicks),
    unselected_clicks: integer(rawGrid.unselected_clicks),
    cells,
  };
  need(cells.reduce((total, row) => total + row.count, 0) === grid.visible_clicks);
  need(
    grid.visible_clicks + grid.withheld_clicks + grid.unselected_clicks === totals.public_clicks,
  );
  if (grid.available) need(grid.unselected_clicks === 0);
  else need(cells.length === 0 && grid.visible_clicks === 0 && grid.withheld_clicks === 0);
  return {
    schema_version: 1,
    project: "pequeverso",
    layout_revision: "pequeverso-v1",
    profile_source_revision: profileSource,
    synthetic: true,
    coverage: "received_events_only",
    timezone: "UTC",
    country_collection: "disabled",
    retention_days: 93,
    min_bucket: 3,
    generated_at: generated,
    selection,
    start,
    end,
    partial: calendar.partial,
    first_observed_at: first,
    last_observed_at: last,
    totals,
    daily,
    countries,
    grid,
  };
}
