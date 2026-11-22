import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { Facts, Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import { acceptedRuns, type OpsSummary, percent, type RunWindow } from "../../domain/summary.ts";

export function RunsGrid({ summary }: { summary: OpsSummary }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
      {summary.windows.length ? (
        summary.windows.map((window) => <Runs key={window.hours} window={window} />)
      ) : (
        <Section id="runs" title={es.operations.runs.title}>
          <p className="text-small text-copy">{es.operations.runs.noMetrics(f.UNAVAILABLE)}</p>
        </Section>
      )}
    </div>
  );
}

function Runs({ window }: { window: RunWindow }) {
  const r = window.runs;
  const accepted = acceptedRuns(r);
  const success = percent(r.completed, accepted);
  const failures = Object.entries(window.failures).sort((a, b) => b[1] - a[1]);
  const t = window.tokens;
  return (
    <Section
      id={`runs-${window.hours}`}
      title={es.operations.runs.windowTitle(f.windowLabel(window.hours))}
      description={es.operations.runs.description}
    >
      <div className="grid min-w-0 grid-cols-1 gap-5 2xl:grid-cols-2">
        <Facts
          items={[
            { term: es.operations.runs.accepted, value: f.count(accepted) },
            {
              term: es.operations.runs.completed,
              value: f.count(r.completed),
              hint: es.operations.runs.successHint(f.pct(success)),
            },
            { term: es.operations.runs.failed, value: f.count(r.failed) },
            { term: es.operations.runs.cancelled, value: f.count(r.cancelled) },
            { term: es.operations.runs.interrupted, value: f.count(r.interrupted) },
            { term: es.operations.runs.refusedBeforeReply, value: f.count(r.refused) },
            { term: es.operations.runs.replacedByRules, value: f.count(window.replaced) },
          ]}
        />
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              {
                term: es.operations.runs.firstTextQuantiles,
                value: window.latency.firstDelta
                  ? `${f.ms(window.latency.firstDelta.p50)} / ${f.ms(window.latency.firstDelta.p95)}`
                  : f.UNAVAILABLE,
                hint: es.operations.runs.firstTextHint,
              },
              {
                term: es.operations.runs.fullReplyQuantiles,
                value: window.latency.total
                  ? `${f.ms(window.latency.total.p50)} / ${f.ms(window.latency.total.p95)}`
                  : f.UNAVAILABLE,
                hint: es.operations.runs.fullReplyHint,
              },
              {
                term: es.operations.runs.inputTokens,
                value: `${f.tokens(t.input)} (${f.tokens(t.cachedInput)})`,
              },
              {
                term: es.operations.runs.outputTokens,
                value: `${f.tokens(t.output)} (${f.tokens(t.reasoning)})`,
              },
            ]}
          />
          {failures.length ? (
            <TableRegion label={es.operations.runs.failuresByCode(f.windowLabel(window.hours))}>
              <table className="w-full border-collapse">
                <caption className="sr-only">{es.operations.runs.failureCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      {es.operations.runs.code}
                    </th>
                    <th scope="col" className={th}>
                      {es.operations.runs.count}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map(([code, n]) => (
                    <tr key={code}>
                      <th scope="row" className={`${td} text-left font-normal`}>
                        <code>{code}</code> · {f.reason(code)}
                      </th>
                      <td className={td}>{f.count(n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          ) : (
            <p className="text-small text-copy">{es.operations.runs.noFailures}</p>
          )}
        </div>
      </div>
    </Section>
  );
}

export function Recent({ summary }: { summary: OpsSummary }) {
  const runs = summary.recent;
  return (
    <Section
      id="recent"
      title={es.operations.runs.recentTitle}
      description={es.operations.runs.recentDescription}
    >
      {runs.length === 0 ? (
        <p className="text-small text-copy">{es.operations.runs.noRecent(f.UNAVAILABLE)}</p>
      ) : (
        <TableRegion label={es.operations.runs.recentTitle}>
          <table className="w-full border-collapse">
            <caption className="sr-only">{es.operations.runs.recentCaption}</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  {es.operations.runs.startedAt}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.result}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.code}
                </th>
                <th scope="col" className={th}>
                  {es.operations.service.model}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.language}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.firstText}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.total}
                </th>
                <th scope="col" className={th}>
                  {es.operations.runs.id}
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {f.when(run.startedAt)}
                  </th>
                  <td className={td}>
                    {es.operations.runs.outcome[run.outcome]}
                    {run.replaced ? ` ${es.operations.runs.replacedSuffix}` : ""}
                  </td>
                  <td className={td}>{run.code ? <code>{run.code}</code> : es.common.dash}</td>
                  <td className={td}>{run.modelCall ? es.common.yes : es.common.no}</td>
                  <td className={td}>{run.language ?? es.common.dash}</td>
                  <td className={td}>{f.ms(run.firstDeltaMs)}</td>
                  <td className={td}>{f.ms(run.totalMs)}</td>
                  <td className={td}>
                    <code>{run.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </Section>
  );
}
