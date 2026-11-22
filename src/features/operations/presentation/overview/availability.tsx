import { CircleCheck, TriangleAlert } from "lucide-react";
import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { Facts, Section } from "#shared/ui/sections.tsx";
import type { OpsSummary } from "../../domain/summary.ts";

export function Availability({ summary }: { summary: OpsSummary }) {
  const available = summary.availability.status === "available";
  return (
    <Section
      id="availability"
      title={es.operations.availability.title}
      description={es.operations.availability.description}
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">
            {es.operations.availability.instantAvailability}
          </p>
          <p className="mt-2 flex items-center gap-2 text-title text-ink">
            {available ? (
              <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-icon" />
            ) : (
              <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
            )}
            {available
              ? es.operations.availability.acceptsQuestions
              : es.operations.availability.refusesQuestions}
          </p>
          <p className="mt-2 text-tiny text-muted">
            {available
              ? es.operations.availability.declaredStatus
              : f.reason(summary.availability.reason)}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">
            {es.operations.availability.remainingMonthlyBudget}
          </p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.usd(summary.budget?.remainingMonth ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">{es.operations.availability.safetyCutoff}</p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">
            {es.operations.availability.completedResponses}
          </p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.count(summary.windows.find((w) => w.hours === 24)?.runs.completed ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">
            {es.operations.availability.completedDescription}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">
            {es.operations.availability.firstTextP95}
          </p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.ms(summary.windows.find((w) => w.hours === 24)?.latency.firstDelta?.p95 ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">
            {es.operations.availability.firstTextDescription}
          </p>
        </div>
      </div>
      <p className="mt-3 text-tiny text-muted">
        {es.operations.availability.assistantEnabled(
          summary.service.assistantEnabled == null
            ? f.UNAVAILABLE
            : summary.service.assistantEnabled
              ? es.operations.availability.yes
              : es.operations.availability.no,
        )}
      </p>
    </Section>
  );
}

export function Service({ summary }: { summary: OpsSummary }) {
  const s = summary.service;
  return (
    <Section id="service" title={es.operations.service.title}>
      <Facts
        items={[
          { term: es.operations.service.model, value: s.model ?? f.UNAVAILABLE },
          {
            term: es.operations.service.reasoningEffort,
            value: s.reasoningEffort ?? f.UNAVAILABLE,
          },
          { term: es.operations.service.provider, value: s.provider ?? f.UNAVAILABLE },
          { term: es.operations.service.environment, value: s.environment ?? f.UNAVAILABLE },
          {
            term: es.operations.service.revision,
            value: <code>{s.revision ?? f.UNAVAILABLE}</code>,
          },
          { term: es.operations.service.startedAt, value: f.when(s.startedAt) },
        ]}
      />
    </Section>
  );
}
