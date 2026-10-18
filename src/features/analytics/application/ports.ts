import type { Report, Selection } from "../domain/report.ts";
export type AnalyticsReading =
  | { status: "disabled" }
  | { status: "invalid_selection" }
  | { status: "unavailable"; reason: "not_configured" | "rejected" | "invalid_or_unreachable" }
  | { status: "available"; report: Report };
export interface AnalyticsSource {
  read(selection: Selection): Promise<AnalyticsReading>;
}
