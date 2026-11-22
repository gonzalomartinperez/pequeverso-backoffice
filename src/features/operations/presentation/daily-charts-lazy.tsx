"use client";
import dynamic from "next/dynamic";
import type { ChartRow } from "./daily-charts.tsx";

/**
 * Same frame as the loaded charts (two captioned figures with an h-64 plot area), so swapping
 * in the real charts does not shift the layout. The table next to the charts already carries
 * the data, so nothing is lost while the chart code loads.
 */
function ChartsPlaceholder() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5" data-testid="charts-loading">
      {["Ejecuciones por día", "Costo por día (US$)"].map((caption) => (
        <figure key={caption} className="m-0 min-w-0 rounded-md border border-line bg-surface p-3">
          <figcaption className="mb-2 text-small font-extrabold text-ink">{caption}</figcaption>
          <div aria-hidden="true" className="h-64 w-full" />
        </figure>
      ))}
    </div>
  );
}

/**
 * Interim performance fix (M3.2, A-P1-3): Recharts is loaded after hydration in its own chunk,
 * keeping it out of the dashboard's initial JavaScript. Recharts' ResponsiveContainer measures
 * the DOM, so server rendering it produced only an empty frame anyway. M5 replaces the charts
 * with server-rendered SVG.
 */
const Charts = dynamic(() => import("./daily-charts.tsx").then((module) => module.DailyCharts), {
  ssr: false,
  loading: ChartsPlaceholder,
});

export function LazyDailyCharts({ rows }: { rows: ChartRow[] }) {
  return <Charts rows={rows} />;
}
