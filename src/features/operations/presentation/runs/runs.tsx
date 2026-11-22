import { Facts, Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import { acceptedRuns, type OpsSummary, percent, type RunWindow } from "../../domain/summary.ts";
import * as f from "../format.ts";

export function RunsGrid({ summary }: { summary: OpsSummary }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
      {summary.windows.length ? (
        summary.windows.map((window) => <Runs key={window.hours} window={window} />)
      ) : (
        <Section id="runs" title="Solicitudes">
          <p className="text-small text-copy">
            {f.UNAVAILABLE}: la API todavía no registra métricas de ejecución.
          </p>
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
      title={`Solicitudes · ${f.windowLabel(window.hours)}`}
      description="Aceptada: la API empezó a responder. Interrumpida: la conexión se cortó antes del final y no cuenta como completada. Rechazada: no llegó a responder (presupuesto, capacidad o límites)."
    >
      <div className="grid min-w-0 grid-cols-1 gap-5 2xl:grid-cols-2">
        <Facts
          items={[
            { term: "Aceptadas", value: f.count(accepted) },
            {
              term: "Completadas",
              value: f.count(r.completed),
              hint: `Éxito sobre aceptadas: ${f.pct(success)}`,
            },
            { term: "Fallidas", value: f.count(r.failed) },
            { term: "Canceladas", value: f.count(r.cancelled) },
            { term: "Interrumpidas", value: f.count(r.interrupted) },
            { term: "Rechazadas antes de responder", value: f.count(r.refused) },
            { term: "Respuestas reemplazadas por reglas", value: f.count(window.replaced) },
          ]}
        />
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              {
                term: "Primer texto (p50 / p95)",
                value: window.latency.firstDelta
                  ? `${f.ms(window.latency.firstDelta.p50)} / ${f.ms(window.latency.firstDelta.p95)}`
                  : f.UNAVAILABLE,
                hint: "Desde que la API acepta la pregunta hasta el primer fragmento emitido por la API.",
              },
              {
                term: "Respuesta completa (p50 / p95)",
                value: window.latency.total
                  ? `${f.ms(window.latency.total.p50)} / ${f.ms(window.latency.total.p95)}`
                  : f.UNAVAILABLE,
                hint: "Hasta la respuesta final validada, solo ejecuciones completadas.",
              },
              {
                term: "Tokens de entrada (en caché)",
                value: `${f.tokens(t.input)} (${f.tokens(t.cachedInput)})`,
              },
              {
                term: "Tokens de salida (razonamiento)",
                value: `${f.tokens(t.output)} (${f.tokens(t.reasoning)})`,
              },
            ]}
          />
          {failures.length ? (
            <TableRegion label={`Fallos por código, ${f.windowLabel(window.hours)}`}>
              <table className="w-full border-collapse">
                <caption className="sr-only">Fallos por código público</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      Código
                    </th>
                    <th scope="col" className={th}>
                      Cantidad
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
            <p className="text-small text-copy">Sin fallos registrados en esta ventana.</p>
          )}
        </div>
      </div>
    </Section>
  );
}

const OUTCOME_LABEL = {
  completed: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
  interrupted: "Interrumpida",
  refused: "Rechazada",
} as const;

export function Recent({ summary }: { summary: OpsSummary }) {
  const runs = summary.recent;
  return (
    <Section
      id="recent"
      title="Últimas ejecuciones"
      description="Hasta 50, la más reciente primero. Identificador opaco, sin contenido de la conversación."
    >
      {runs.length === 0 ? (
        <p className="text-small text-copy">
          {f.UNAVAILABLE}: la API no informó ejecuciones recientes.
        </p>
      ) : (
        <TableRegion label="Últimas ejecuciones">
          <table className="w-full border-collapse">
            <caption className="sr-only">Últimas ejecuciones del asistente (UTC)</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Inicio (UTC)
                </th>
                <th scope="col" className={th}>
                  Resultado
                </th>
                <th scope="col" className={th}>
                  Código
                </th>
                <th scope="col" className={th}>
                  Modelo
                </th>
                <th scope="col" className={th}>
                  Idioma
                </th>
                <th scope="col" className={th}>
                  Primer texto
                </th>
                <th scope="col" className={th}>
                  Total
                </th>
                <th scope="col" className={th}>
                  Id
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
                    {OUTCOME_LABEL[run.outcome]}
                    {run.replaced ? " · reemplazada" : ""}
                  </td>
                  <td className={td}>{run.code ? <code>{run.code}</code> : "—"}</td>
                  <td className={td}>{run.modelCall ? "Sí" : "No"}</td>
                  <td className={td}>{run.language ?? "—"}</td>
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
