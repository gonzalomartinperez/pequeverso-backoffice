import { Facts, Section, TableRegion, td, th } from "../../../shared/ui/sections.tsx";
import type { AnalyticsReading } from "../application/ports.ts";
import type { Selection } from "../domain/report.ts";
import { AnalyticsFilters } from "./filters.tsx";

const number = (value: number) => value.toLocaleString("es");
const countryNames = new Intl.DisplayNames(["es"], { type: "region" });
const messages = {
  disabled: "Lectura de analítica desactivada. No hay un informe disponible.",
  invalid_selection: "La selección no es válida. Elige una página y una sección compatibles.",
  unavailable:
    "No disponible. No se pudo obtener un informe válido; no se muestran ceros en su lugar.",
};
export function AnalyticsReport({
  reading,
  selection,
}: {
  reading: AnalyticsReading;
  selection: Selection;
}) {
  const report = reading.status === "available" ? reading.report : null;
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-heading text-ink">
          Actividad del sitio
          {report ? (report.synthetic ? " · prueba local" : " · producción") : ""}
        </h1>
        <p className="mt-2 text-body text-copy">
          {report
            ? report.synthetic
              ? "Datos sintéticos. "
              : "Datos clasificados como producción por la API. "
            : "Sin clasificación de datos disponible. "}
          Son eventos recibidos, no personas, visitas únicas ni conversiones. Esta vista no activa
          la recopilación ni verifica el despliegue del colector.
        </p>
      </header>
      <Section id="analytics-filters" title="Consultar un intervalo">
        <AnalyticsFilters key={Object.values(selection).join("|")} selection={selection} />
        <p className="mt-3 text-small text-muted">
          Todos los filtros afectan todas las cifras. La consulta se envía al pulsar Consultar.
        </p>
      </Section>
      {!report ? (
        <p role="status" className="rounded-md border border-line bg-surface-raised p-5 text-copy">
          {reading.status === "available" ? "" : messages[reading.status]}
        </p>
      ) : (
        <>
          <Section
            id="analytics-counts"
            title="Eventos recibidos"
            description={`${report.start} a ${report.end}, fin excluido. ${report.partial ? "Intervalo actual parcial." : "Intervalo calendario anterior."}`}
          >
            <Facts
              items={[
                { term: "Vistas de página", value: number(report.totals.page_views) },
                { term: "Exposiciones de sección", value: number(report.totals.section_views) },
                {
                  term: "Clics de puntero",
                  value: number(report.totals.public_clicks),
                  hint: "No incluye activaciones por teclado.",
                },
              ]}
            />
            <p className="mt-4 text-small text-muted">
              Primer evento recibido: {report.first_observed_at ?? "Sin registros"}. Último:{" "}
              {report.last_observed_at ?? "Sin registros"}. No indica cuándo se activó el canal ni
              su disponibilidad.
            </p>
            {report.totals.page_views +
              report.totals.section_views +
              report.totals.public_clicks ===
            0 ? (
              <p className="mt-3 text-body">
                No hay eventos recibidos para esta selección. Esto no demuestra que el sitio no tuvo
                tráfico.
              </p>
            ) : null}
          </Section>
          <Section id="analytics-calendar" title="Calendario UTC">
            <TableRegion label="Eventos por día">
              <table className="w-full">
                <caption className="p-3 text-left text-small">
                  Conteos recibidos por día; sin estimaciones de personas.
                </caption>
                <thead>
                  <tr>
                    {["Día UTC", "Vistas de página", "Exposiciones", "Clics de puntero"].map(
                      (label) => (
                        <th key={label} scope="col" className={th}>
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((day) => (
                    <tr key={day.day}>
                      <th scope="row" className={td}>
                        {day.day}
                      </th>
                      <td className={td}>{number(day.page_views)}</td>
                      <td className={td}>{number(day.section_views)}</td>
                      <td className={td}>{number(day.public_clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </Section>
          <Section
            id="analytics-country"
            title="Eventos por país"
            description={
              report.country_collection === "disabled"
                ? "Configuración actual: país desactivado. Puede haber agregados históricos con país. No informa nacionalidad ni ubicación personal."
                : "Configuración actual: cabecera de proxy confiable. Esta vista no verifica el proxy ni la procedencia de cada evento. No informa nacionalidad ni ubicación personal."
            }
          >
            <TableRegion label="Eventos por grupo de país">
              <table className="w-full">
                <caption className="p-3 text-left text-small">
                  Suma de los tres tipos de eventos, no solo vistas de página.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      Grupo
                    </th>
                    <th scope="col" className={th}>
                      Eventos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.countries.map((row) => (
                    <tr key={row.code}>
                      <th scope="row" className={td}>
                        {row.code === "unknown"
                          ? "País no informado"
                          : row.code === "withheld"
                            ? "Grupos retenidos por umbral (menos de 3 por país)"
                            : `${countryNames.of(row.code) ?? row.code} (${row.code})`}
                      </th>
                      <td className={td}>{number(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </Section>
          <Section
            id="analytics-grid"
            title="Cuadrícula agregada de clics"
            description="8 × 8 celdas de la sección; solo se muestran grupos de al menos 3 clics. Una celda ausente puede no tener eventos o estar retenida; no se representa como cero."
          >
            {!report.grid.available ? (
              <p>Selecciona una página y una sección concretas para ver la cuadrícula.</p>
            ) : (
              <>
                <div aria-hidden="true" className="grid max-w-md grid-cols-8 gap-1">
                  {Array.from({ length: 64 }, (_, cell) => {
                    const x = cell % 8,
                      y = Math.floor(cell / 8);
                    const row = report.grid.cells.find((row) => row.x === x && row.y === y);
                    return (
                      <span
                        key={`${x}:${y}`}
                        className={`flex aspect-square items-center justify-center rounded text-small ${row ? "bg-chip text-ink" : "border border-line bg-surface-sunken text-muted"}`}
                      >
                        {row ? number(row.count) : "—"}
                      </span>
                    );
                  })}
                </div>
                <TableRegion label="Alternativa de texto de la cuadrícula">
                  <table className="mt-4 w-full">
                    <caption className="p-3 text-left text-small">
                      Solo celdas publicadas; coordenadas enteras de 0 a 7.
                    </caption>
                    <thead>
                      <tr>
                        {["Columna", "Fila", "Clics de puntero"].map((label) => (
                          <th scope="col" key={label} className={th}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.grid.cells.map((row) => (
                        <tr key={`${row.x}:${row.y}`}>
                          <td className={td}>{row.x}</td>
                          <td className={td}>{row.y}</td>
                          <td className={td}>{number(row.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              </>
            )}
            <p className="mt-4 text-small text-copy">
              Clics visibles: {number(report.grid.visible_clicks)} · Retenidos:{" "}
              {number(report.grid.withheld_clicks)} · Sin cuadrícula seleccionada:{" "}
              {number(report.grid.unselected_clicks)}.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
