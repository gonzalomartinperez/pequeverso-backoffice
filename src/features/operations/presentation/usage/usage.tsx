import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import { budgetUse, hasTrend, type OpsSummary } from "../../domain/summary.ts";
import { LazyDailyCharts } from "../daily-charts-lazy.tsx";

export function Daily({ summary }: { summary: OpsSummary }) {
  const rows = summary.daily;
  return (
    <Section
      id="daily"
      title={es.operations.daily.title}
      description={es.operations.daily.description}
    >
      {rows.length === 0 ? (
        <p className="text-small text-copy">{es.operations.daily.noReadings(f.UNAVAILABLE)}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {hasTrend(rows) ? (
            <LazyDailyCharts
              rows={rows.map((row) => ({
                day: f.day(row.day),
                completed: row.completed,
                failed: row.failed,
                cancelled: row.cancelled,
                interrupted: row.interrupted,
                confirmed: row.confirmed == null ? null : Number(row.confirmed),
                estimated: row.estimated == null ? null : Number(row.estimated),
              }))}
            />
          ) : (
            <p className="text-small text-copy">{es.operations.daily.singleReading}</p>
          )}
          <TableRegion label={es.operations.daily.tableLabel}>
            <table className="w-full border-collapse">
              <caption className="sr-only">{es.operations.daily.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {es.operations.daily.dayUtc}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.runs.completed}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.runs.failed}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.runs.cancelled}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.runs.interrupted}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.runs.refused}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.budget.confirmed}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.budget.estimated}
                  </th>
                  <th scope="col" className={th}>
                    {es.operations.daily.tokenTotals}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.day}>
                    <th scope="row" className={`${td} text-left font-extrabold`}>
                      {f.day(row.day)}
                    </th>
                    <td className={td}>{f.count(row.completed)}</td>
                    <td className={td}>{f.count(row.failed)}</td>
                    <td className={td}>{f.count(row.cancelled)}</td>
                    <td className={td}>{f.count(row.interrupted)}</td>
                    <td className={td}>{f.count(row.refused)}</td>
                    <td className={td}>{f.usd(row.confirmed)}</td>
                    <td className={td}>{f.usd(row.estimated)}</td>
                    <td className={td}>
                      {f.tokens(row.inputTokens)} / {f.tokens(row.outputTokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        </div>
      )}
    </Section>
  );
}

export function Budget({ summary }: { summary: OpsSummary }) {
  const b = summary.budget;
  if (!b)
    return (
      <Section id="budget" title={es.operations.budget.title}>
        <p className="text-small text-copy">{es.operations.budget.noReading(f.UNAVAILABLE)}</p>
      </Section>
    );
  const use = budgetUse(summary);
  const spendRows = [
    {
      label: es.operations.budget.confirmed,
      month: b.monthSpend.confirmed,
      day: b.daySpend.confirmed,
    },
    {
      label: es.operations.budget.estimated,
      month: b.monthSpend.estimated,
      day: b.daySpend.estimated,
    },
    { label: es.operations.budget.pending, month: b.monthSpend.pending, day: b.daySpend.pending },
    { label: es.operations.budget.limit, month: b.monthlyLimit, day: b.dailyLimit },
  ];
  return (
    <Section
      id="budget"
      title={es.operations.budget.monthTitle(b.month ?? es.operations.budget.thisMonth)}
      description={es.operations.budget.description}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-small">
          <span className="font-extrabold text-ink">{es.operations.budget.committed}</span>
          <span className="tabular-nums text-ink">{f.pct(use)}</span>
        </div>
        {use == null ? null : (
          <meter
            className="budget-meter"
            data-high={use >= 90 ? "true" : undefined}
            min={0}
            max={100}
            low={70}
            high={90}
            optimum={0}
            value={Math.min(use, 100)}
            aria-label={es.operations.budget.meterLabel}
            aria-valuetext={f.pct(use)}
          />
        )}
      </div>
      <div className="mt-4">
        <TableRegion label={es.operations.budget.spendLabel}>
          <table className="mt-0 w-full border-collapse">
            <caption className="sr-only">{es.operations.budget.spendCaption}</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  {es.operations.budget.concept}
                </th>
                <th scope="col" className={th}>
                  {es.operations.budget.month}
                </th>
                <th scope="col" className={th}>
                  {es.operations.budget.dayLabel(b.day ?? f.UNAVAILABLE)}
                </th>
              </tr>
            </thead>
            <tbody>
              {spendRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={`${td} text-left font-extrabold`}>
                    {row.label}
                  </th>
                  <td className={td}>{f.usd(row.month)}</td>
                  <td className={td}>{f.usd(row.day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </div>
      <details className="mt-3 rounded-md border border-line p-3">
        <summary className="min-h-11 cursor-pointer content-center [overflow-wrap:anywhere] text-small font-extrabold text-link focus-visible:outline-3 focus-visible:outline-ring">
          {es.operations.budget.ratesAndStatuses}
        </summary>
        <p className="mt-2 text-small text-copy">{es.operations.budget.statusDescription}</p>
        <Rates summary={summary} />
      </details>
      <p className="mt-3 text-small text-copy">
        {es.operations.budget.cutoff(f.usd(b.monthlyCutoff), f.usd(b.remainingMonth))}
      </p>
    </Section>
  );
}

function Rates({ summary }: { summary: OpsSummary }) {
  const p = summary.pricing;
  return (
    <p className="mt-3 text-small text-copy" data-testid="pricing">
      {p ? (
        <>
          {`${es.operations.budget.rates(p.revision, p.model, f.usd(p.inputPerMillion), f.usd(p.cachedInputPerMillion), f.usd(p.cacheWritePerMillion), f.usd(p.outputPerMillion))} `}
          <strong>{es.operations.budget.notInvoice}</strong>
          {` ${es.operations.budget.billingPanel}`}
        </>
      ) : (
        es.operations.budget.noRates(f.UNAVAILABLE)
      )}
    </p>
  );
}
