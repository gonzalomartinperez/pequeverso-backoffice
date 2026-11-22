import "server-only";
import { analyticsHttp } from "../features/analytics/adapters/analytics-http.ts";
import type { AnalyticsReading } from "../features/analytics/application/ports.ts";
import { defaultSelection, type Selection } from "../features/analytics/domain/report.ts";
import { reportSelection } from "../features/analytics/domain/selection.ts";
import { httpOpsSource } from "../features/operations/adapters/ops-http.ts";
import { readHttpTelemetry } from "../features/operations/adapters/telemetry-http.ts";
import type { OpsReading, TelemetryReading } from "../features/operations/application/ports.ts";
import { requireActor } from "./auth.ts";
import { config } from "./env.ts";
import { observability } from "./observability.ts";

// Composition root for the private API reads: the only place that wires the HTTP adapters to the
// parsed configuration, the fetch implementation and tracing. Access wiring stays in auth.ts
// (requireActor and accessDeps, the single authorization entry). Nothing here is cached: every
// reading is fresh for the current request and user.

/** Fresh operational reading for the current request (never cached or shared between users). */
export function readOperations(): Promise<OpsReading> {
  const settings = config();
  return observability(settings.observability).observe(
    "ops_summary",
    (traceparent) => httpOpsSource(settings.ops, fetch, 4000, traceparent).read(),
    (result) => (result.status === "ok" ? "ok" : "unavailable"),
  );
}

export function readTelemetry(): Promise<TelemetryReading> {
  const settings = config();
  if (!settings.telemetryEnabled) return readHttpTelemetry(settings.ops, false);
  return observability(settings.observability).observe(
    "ops_telemetry",
    (traceparent) => readHttpTelemetry(settings.ops, settings.telemetryEnabled, fetch, traceparent),
    (result) => (result.status === "ok" ? "ok" : "unavailable"),
  );
}

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
