import "server-only";
import { analyticsHttp } from "../features/analytics/adapters/analytics-http.ts";
import type { AnalyticsReading } from "../features/analytics/application/ports.ts";
import { defaultSelection, type Selection } from "../features/analytics/domain/report.ts";
import { reportSelection } from "../features/analytics/domain/selection.ts";
import { requireActor } from "./auth.ts";
import { config } from "./config.ts";

/** Guard at the read boundary: a layout can render concurrently with its child page. */
export async function readAnalytics(
  params: Record<string, string | string[] | undefined>,
): Promise<{ reading: AnalyticsReading; selection: Selection }> {
  await requireActor("read_operations");
  const settings = config();
  if (!settings.analyticsReadEnabled)
    return { reading: { status: "disabled" }, selection: defaultSelection };
  const selection = reportSelection(params);
  if (!selection) return { reading: { status: "invalid_selection" }, selection: defaultSelection };
  return { reading: await analyticsHttp(settings.ops, true).read(selection), selection };
}
