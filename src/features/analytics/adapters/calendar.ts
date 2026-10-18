import type { Selection } from "../domain/report.ts";
/** UTC calendar arithmetic from an explicit report timestamp, never an ambient clock. */
export function calendarWindow(generatedAt: string, selection: Selection) {
  const generated = new Date(generatedAt);
  const year = generated.getUTCFullYear(),
    month = generated.getUTCMonth(),
    day = generated.getUTCDate();
  let start: number, end: number;
  if (selection.period === "month") {
    start = Date.UTC(year, month - selection.offset, 1);
    end = Date.UTC(year, month - selection.offset + 1, 1);
  } else {
    const width = selection.period === "week" ? 7 : 1;
    const monday = selection.period === "week" ? (generated.getUTCDay() + 6) % 7 : 0;
    start = Date.UTC(year, month, day - monday - selection.offset * width);
    end = start + width * 86400000;
  }
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    partial: selection.offset === 0,
  };
}
