import { es } from "#shared/i18n/es.ts";
import { Facts, Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import type { AnalyticsReading } from "../application/ports.ts";
import type { Selection } from "../domain/report.ts";
import { AnalyticsFilters } from "./filters.tsx";

const number = (value: number) => value.toLocaleString("es");
const countryNames = new Intl.DisplayNames(["es"], { type: "region" });
const messages = {
  disabled: es.analytics.status.disabled,
  invalid_selection: es.analytics.status.invalidSelection,
  unavailable: es.analytics.status.unavailable,
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
          {es.analytics.title}
          {report
            ? report.synthetic
              ? ` ${es.analytics.localSuffix}`
              : ` ${es.analytics.productionSuffix}`
            : ""}
        </h1>
        <p className="mt-2 text-body text-copy">
          {report
            ? report.synthetic
              ? `${es.analytics.syntheticData} `
              : `${es.analytics.productionData} `
            : `${es.analytics.unclassifiedData} `}
          {es.analytics.reportScope}
        </p>
      </header>
      <Section id="analytics-filters" title={es.analytics.filtersTitle}>
        <AnalyticsFilters key={Object.values(selection).join("|")} selection={selection} />
        <p className="mt-3 text-small text-muted">{es.analytics.filtersDescription}</p>
      </Section>
      {!report ? (
        <p role="status" className="rounded-md border border-line bg-surface-raised p-5 text-copy">
          {reading.status === "available" ? "" : messages[reading.status]}
        </p>
      ) : (
        <>
          <Section
            id="analytics-counts"
            title={es.analytics.receivedEvents}
            description={es.analytics.intervalDescription(
              report.start,
              report.end,
              report.partial ? es.analytics.currentInterval : es.analytics.pastInterval,
            )}
          >
            <Facts
              items={[
                { term: es.analytics.pageViews, value: number(report.totals.page_views) },
                { term: es.analytics.sectionViews, value: number(report.totals.section_views) },
                {
                  term: es.analytics.pointerClicks,
                  value: number(report.totals.public_clicks),
                  hint: es.analytics.pointerClicksHint,
                },
              ]}
            />
            <p className="mt-4 text-small text-muted">
              {es.analytics.observedEvents(
                report.first_observed_at ?? es.analytics.noRecords,
                report.last_observed_at ?? es.analytics.noRecords,
              )}
            </p>
            {report.totals.page_views +
              report.totals.section_views +
              report.totals.public_clicks ===
            0 ? (
              <p className="mt-3 text-body">{es.analytics.noReceivedEvents}</p>
            ) : null}
          </Section>
          <Section id="analytics-calendar" title={es.analytics.utcCalendar}>
            <TableRegion label={es.analytics.dailyEvents}>
              <table className="w-full">
                <caption className="p-3 text-left text-small">{es.analytics.dailyCaption}</caption>
                <thead>
                  <tr>
                    {[
                      es.analytics.dayUtc,
                      es.analytics.pageViews,
                      es.analytics.exposures,
                      es.analytics.pointerClicks,
                    ].map((label) => (
                      <th key={label} scope="col" className={th}>
                        {label}
                      </th>
                    ))}
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
            title={es.analytics.eventsByCountry}
            description={
              report.country_collection === "disabled"
                ? es.analytics.countryCollectionDisabled
                : es.analytics.countryCollectionProxy
            }
          >
            <TableRegion label={es.analytics.countryGroups}>
              <table className="w-full">
                <caption className="p-3 text-left text-small">
                  {es.analytics.countryCaption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      {es.analytics.group}
                    </th>
                    <th scope="col" className={th}>
                      {es.analytics.events}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.countries.map((row) => (
                    <tr key={row.code}>
                      <th scope="row" className={td}>
                        {row.code === "unknown"
                          ? es.analytics.unknownCountry
                          : row.code === "withheld"
                            ? es.analytics.withheldCountries
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
            title={es.analytics.clickGrid}
            description={es.analytics.clickGridDescription}
          >
            {!report.grid.available ? (
              <p>{es.analytics.selectGrid}</p>
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
                        {row ? number(row.count) : es.common.dash}
                      </span>
                    );
                  })}
                </div>
                <TableRegion label={es.analytics.gridTextAlternative}>
                  <table className="mt-4 w-full">
                    <caption className="p-3 text-left text-small">
                      {es.analytics.gridCaption}
                    </caption>
                    <thead>
                      <tr>
                        {[es.analytics.column, es.analytics.row, es.analytics.pointerClicks].map(
                          (label) => (
                            <th scope="col" key={label} className={th}>
                              {label}
                            </th>
                          ),
                        )}
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
              {es.analytics.gridCounts(
                number(report.grid.visible_clicks),
                number(report.grid.withheld_clicks),
                number(report.grid.unselected_clicks),
              )}
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
