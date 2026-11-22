import { Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import { budgetUse, hasTrend, type OpsSummary } from "../../domain/summary.ts";
import { LazyDailyCharts } from "../daily-charts-lazy.tsx";
import * as f from "../format.ts";

export function Daily({ summary }: { summary: OpsSummary }) {
  const rows = summary.daily;
  return (
    <Section
      id="daily"
      title="Actividad diaria"
      description="Solo días con registros; un día ausente no se interpreta como cero."
    >
      {rows.length === 0 ? (
        <p className="text-small text-copy">{f.UNAVAILABLE}: todavía no hay días con registros.</p>
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
            <p className="text-small text-copy">
              Hay una sola lectura diaria: se muestra como tabla, sin tendencia.
            </p>
          )}
          <TableRegion label="Actividad diaria en tabla">
            <table className="w-full border-collapse">
              <caption className="sr-only">Ejecuciones, costo y tokens por día (UTC)</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Día (UTC)
                  </th>
                  <th scope="col" className={th}>
                    Completadas
                  </th>
                  <th scope="col" className={th}>
                    Fallidas
                  </th>
                  <th scope="col" className={th}>
                    Canceladas
                  </th>
                  <th scope="col" className={th}>
                    Interrumpidas
                  </th>
                  <th scope="col" className={th}>
                    Rechazadas
                  </th>
                  <th scope="col" className={th}>
                    Con uso informado
                  </th>
                  <th scope="col" className={th}>
                    Estimado
                  </th>
                  <th scope="col" className={th}>
                    Tokens entrada / salida
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
      <Section id="budget" title="Presupuesto">
        <p className="text-small text-copy">
          {f.UNAVAILABLE}: la API no informó el estado del presupuesto.
        </p>
      </Section>
    );
  const use = budgetUse(summary);
  const spendRows = [
    { label: "Con uso informado", month: b.monthSpend.confirmed, day: b.daySpend.confirmed },
    { label: "Estimado", month: b.monthSpend.estimated, day: b.daySpend.estimated },
    { label: "Pendiente", month: b.monthSpend.pending, day: b.daySpend.pending },
    { label: "Límite", month: b.monthlyLimit, day: b.dailyLimit },
  ];
  return (
    <Section
      id="budget"
      title={`Presupuesto de ${b.month ?? "este mes"}`}
      description="Importes calculados con el uso informado y las tarifas versionadas, no la factura del proveedor. Las reservas de uso desconocido y en curso se conservan."
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-small">
          <span className="font-extrabold text-ink">Comprometido del límite mensual</span>
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
            aria-label="Uso del presupuesto mensual"
            aria-valuetext={f.pct(use)}
          />
        )}
      </div>
      <div className="mt-4">
        <TableRegion label="Gasto del mes y del día">
          <table className="mt-0 w-full border-collapse">
            <caption className="sr-only">Gasto del asistente por estado, en dólares</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Concepto
                </th>
                <th scope="col" className={th}>
                  Mes
                </th>
                <th scope="col" className={th}>
                  Día ({b.day ?? f.UNAVAILABLE})
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
          Tarifas y estados del gasto
        </summary>
        <p className="mt-2 text-small text-copy">
          Con uso informado (confirmado en el ledger): costo estimado desde los tokens reportados.
          Estimado: uso desconocido; se conserva la reserva de peor caso. Pendiente: reservas de
          ejecuciones en curso. Ninguno es un importe reconciliado con la factura.
        </p>
        <Rates summary={summary} />
      </details>
      <p className="mt-3 text-small text-copy">
        Corte de seguridad mensual: {f.usd(b.monthlyCutoff)}. Restante antes del corte:{" "}
        {f.usd(b.remainingMonth)}.
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
          Estimaciones calculadas con las tarifas «{p.revision}» ({p.model}): entrada{" "}
          {f.usd(p.inputPerMillion)}, en caché {f.usd(p.cachedInputPerMillion)}, escritura de caché{" "}
          {f.usd(p.cacheWritePerMillion)} y salida (incluye razonamiento){" "}
          {f.usd(p.outputPerMillion)} por millón de tokens.{" "}
          <strong>No es la factura del proveedor:</strong> contrástala con el panel de facturación
          de OpenAI.
        </>
      ) : (
        <>Tarifas de estimación: {f.UNAVAILABLE}. Las cifras no son la factura del proveedor.</>
      )}
    </p>
  );
}
