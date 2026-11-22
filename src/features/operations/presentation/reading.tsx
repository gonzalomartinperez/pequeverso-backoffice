import { CircleAlert, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { LinkButton } from "#shared/ui/button.tsx";
import { Callout } from "#shared/ui/callout.tsx";
import type { OpsReading } from "../application/ports.ts";
import type { OpsSummary } from "../domain/summary.ts";

const UNAVAILABLE_READING: Record<Exclude<OpsReading, { status: "ok" }>["reason"], string> = {
  not_configured: es.operations.unavailableReading.notConfigured,
  unreachable: es.operations.unavailableReading.unreachable,
  rejected: es.operations.unavailableReading.rejected,
  invalid: es.operations.unavailableReading.invalid,
};

export function OpsFrame({
  title,
  refreshHref,
  reading,
  children,
  unavailableContent,
}: {
  title: string;
  refreshHref: string;
  reading: OpsReading;
  children: (summary: OpsSummary, fetchedAt: Date) => ReactNode;
  unavailableContent?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading">{title}</h1>
          <p className="text-small text-muted">
            {es.operations.readingDescription(f.when(reading.fetchedAt))}
          </p>
        </div>
        <LinkButton href={refreshHref} variant="outline" size="sm">
          {es.operations.refresh}
        </LinkButton>
      </header>
      {reading.status === "ok" ? (
        children(reading.summary, reading.fetchedAt)
      ) : (
        <Callout tone="danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <p className="font-extrabold text-ink">{es.operations.metricsUnavailable}</p>
            <p>{es.operations.unavailableDescription(UNAVAILABLE_READING[reading.reason])}</p>
          </div>
        </Callout>
      )}
      {reading.status !== "ok" ? unavailableContent : null}
    </div>
  );
}

export function SyntheticBanner({ summary }: { summary: OpsSummary }) {
  return summary.service.synthetic ? (
    <Callout tone="notice" role="note" data-testid="synthetic-banner">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>{es.operations.syntheticTitle}</strong>
        {` ${es.operations.syntheticDescription}`}
      </p>
    </Callout>
  ) : null;
}
