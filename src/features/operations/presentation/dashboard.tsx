import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import type { OpsReading, TelemetryReading } from "../application/ports.ts";
import type { OpsSummary } from "../domain/summary.ts";
import { Catalog } from "./catalog/catalog.tsx";
import { Availability, Service } from "./overview/availability.tsx";
import { OpsFrame, SyntheticBanner } from "./reading.tsx";
import { Recent, RunsGrid } from "./runs/runs.tsx";
import { Telemetry } from "./telemetry.tsx";
import { Budget, Daily } from "./usage/usage.tsx";

export function Dashboard({
  reading,
  telemetry,
}: {
  reading: OpsReading;
  telemetry: TelemetryReading;
}) {
  return (
    <OpsFrame
      title={es.operations.title}
      refreshHref="/panel"
      reading={reading}
      unavailableContent={<Telemetry reading={telemetry} />}
    >
      {(summary, fetchedAt) => <Summary summary={summary} now={fetchedAt} telemetry={telemetry} />}
    </OpsFrame>
  );
}

function Summary({
  summary,
  now,
  telemetry,
}: {
  summary: OpsSummary;
  now: Date;
  telemetry: TelemetryReading;
}) {
  return (
    <>
      <SyntheticBanner summary={summary} />
      <Availability summary={summary} />
      <nav aria-label={es.operations.sectionsLabel} className="flex flex-wrap gap-2">
        {[
          ["daily", es.operations.daily.navLabel],
          ["budget", es.operations.budget.title],
          ["runs-24", es.operations.runs.title],
          ["recent", es.operations.runs.recentTitle],
        ]
          .filter(([id]) => id !== "runs-24" || summary.windows.some((w) => w.hours === 24))
          .map(([id, label]) => (
            <a
              key={id}
              href={`#${id}-title`}
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-small font-bold text-link focus-visible:outline-3 focus-visible:outline-ring"
            >
              {label}
            </a>
          ))}
      </nav>
      <Daily summary={summary} />
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Budget summary={summary} />
        <Catalog summary={summary} now={now} />
      </div>
      <RunsGrid summary={summary} />
      <Recent summary={summary} />
      <details className="min-w-0 rounded-lg border border-line bg-surface-raised p-5 shadow-sm">
        <summary className="min-h-11 cursor-pointer content-center [overflow-wrap:anywhere] text-title text-ink focus-visible:outline-3 focus-visible:outline-ring">
          {es.operations.diagnosticsTitle}
        </summary>
        <p className="mt-2 text-small text-muted">{es.operations.diagnosticsDescription}</p>
        <div className="mt-4 grid min-w-0 grid-cols-1 items-start gap-5">
          <Telemetry reading={telemetry} />
          <Service summary={summary} />
        </div>
      </details>
      <p className="text-tiny text-muted">
        {es.operations.readingDates(f.when(summary.metricsSince), f.when(summary.generatedAt))}
      </p>
    </>
  );
}
