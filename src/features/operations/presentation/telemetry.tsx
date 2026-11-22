import { Activity, CircleCheck, FlaskConical, TriangleAlert } from "lucide-react";
import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { Badge } from "#shared/ui/badge.tsx";
import { Callout } from "#shared/ui/callout.tsx";
import { Facts, Section } from "#shared/ui/sections.tsx";
import type { TelemetryReading } from "../application/ports.ts";

function bytes(value: number | null): string {
  return value == null
    ? f.UNAVAILABLE
    : `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value / 1_048_576)} MiB`;
}
function lifetime(seconds: number): string {
  return seconds < 60
    ? `${f.count(Math.floor(seconds))} s`
    : seconds < 3600
      ? `${f.count(Math.floor(seconds / 60))} min`
      : `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(seconds / 3600)} h`;
}

export function Telemetry({ reading }: { reading: TelemetryReading }) {
  if (reading.status !== "ok")
    return (
      <Section id="telemetry" title={es.telemetry.title} description={es.telemetry.description}>
        <p className="text-small text-copy">
          <strong>{f.UNAVAILABLE}.</strong>{" "}
          {reading.reason === "disabled" ? es.telemetry.disabled : es.telemetry.invalidSample}{" "}
          {es.telemetry.summaryStillAvailable}
        </p>
        <p className="mt-2 text-tiny text-muted">{es.telemetry.availabilityCaveat}</p>
      </Section>
    );
  const t = reading.telemetry;
  const resource = t.resources;
  return (
    <Section
      id="telemetry"
      title={es.telemetry.title}
      description={es.telemetry.sampleDescription(f.when(t.generatedAt))}
    >
      {t.synthetic ? (
        <Callout tone="notice" role="note" data-testid="telemetry-fixture-banner">
          <FlaskConical aria-hidden="true" />
          <p>
            <strong>{es.telemetry.syntheticTitle}</strong>
            {` ${es.telemetry.syntheticDescription}`}
          </p>
        </Callout>
      ) : null}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md bg-surface-sunken p-4">
          <p className="flex items-center gap-2 font-extrabold text-ink">
            {t.readiness.ready ? (
              <CircleCheck aria-hidden="true" className="size-5 text-icon" />
            ) : (
              <TriangleAlert aria-hidden="true" className="size-5 text-danger" />
            )}
            {es.telemetry.apiReadiness(
              t.readiness.ready ? es.telemetry.ready : es.telemetry.notReady,
            )}
          </p>
          <p className="mt-2 text-small text-copy">{es.telemetry.readinessDescription}</p>
          <p className="mt-2 text-tiny text-muted">
            {es.telemetry.checkedAt(f.when(t.readiness.checkedAt))}
          </p>
        </div>
        <div className="rounded-md bg-surface-sunken p-4">
          <p className="flex items-center gap-2 font-extrabold text-ink">
            <Activity aria-hidden="true" className="size-5 text-icon" />
            {es.telemetry.activeRuns(f.count(t.activeRuns), f.count(t.maxConcurrentRuns))}
          </p>
          <p className="mt-2 text-small text-copy">{es.telemetry.capacityDescription}</p>
          <p className="mt-2 text-tiny text-muted">
            {es.telemetry.uptime(lifetime(t.processUptimeSeconds))}
          </p>
        </div>
        <div className="rounded-md bg-surface-sunken p-4">
          <Badge tone="quiet">{es.telemetry.providerUnchecked}</Badge>
          <p className="mt-2 text-small text-copy">{es.telemetry.providerCaveat}</p>
        </div>
      </div>
      <details className="mt-5 rounded-md border border-line p-4">
        <summary className="min-h-11 cursor-pointer [overflow-wrap:anywhere] font-extrabold text-link focus-visible:outline-3 focus-visible:outline-ring">
          {es.telemetry.diagnosticsTitle}
        </summary>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-title">{es.telemetry.processTitle}</h3>
            <Facts
              items={[
                { term: es.telemetry.processRss, value: bytes(resource.processRssBytes) },
                { term: es.telemetry.peakRss, value: bytes(resource.processPeakRssBytes) },
                {
                  term: es.telemetry.cgroupMemory,
                  value: bytes(resource.cgroupMemoryCurrentBytes),
                },
                {
                  term: es.telemetry.cgroupMemoryLimit,
                  value: bytes(resource.cgroupMemoryLimitBytes),
                },
                {
                  term: es.telemetry.cgroupCpuLimit,
                  value:
                    resource.cgroupCpuLimitCores == null
                      ? f.UNAVAILABLE
                      : `${resource.cgroupCpuLimitCores} CPU`,
                },
                {
                  term: es.telemetry.cgroupPids,
                  value: `${f.count(resource.cgroupPidsCurrent)} / ${f.count(resource.cgroupPidsLimit)}`,
                },
              ]}
            />
            <p className="mt-3 text-tiny text-muted">{es.telemetry.cgroupDescription}</p>
          </div>
          <div>
            <h3 className="mb-3 text-title">{es.telemetry.httpAndTraces}</h3>
            <Facts
              items={[
                { term: es.telemetry.httpRequests, value: f.count(t.http.requests) },
                { term: es.telemetry.httpServerErrors, value: f.count(t.http.serverErrors) },
                { term: es.telemetry.httpInflight, value: f.count(t.http.inflight) },
                {
                  term: es.telemetry.traceExport,
                  value: t.traces.enabled
                    ? es.telemetry.traceExportEnabled
                    : es.telemetry.traceExportDisabled,
                },
                { term: es.telemetry.traceSampling, value: f.pct(t.traces.samplingRatio * 100) },
                {
                  term: es.telemetry.traceExportCounts,
                  value: `${f.count(t.traces.exportSuccesses)} / ${f.count(t.traces.exportFailures)}`,
                },
                { term: es.telemetry.traceLastExport, value: f.when(t.traces.lastExportAt) },
                {
                  term: es.telemetry.traceLastResult,
                  value:
                    t.traces.lastExportSuccess === null
                      ? f.UNAVAILABLE
                      : t.traces.lastExportSuccess
                        ? es.telemetry.traceExportSucceeded
                        : es.telemetry.traceExportFailed,
                },
              ]}
            />
            <p className="mt-3 text-tiny text-muted">
              {es.telemetry.countersSince(f.when(t.processStartedAt))}
            </p>
          </div>
        </div>
      </details>
    </Section>
  );
}
