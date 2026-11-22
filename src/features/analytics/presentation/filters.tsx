"use client";
import { useState } from "react";
import { es } from "#shared/i18n/es.ts";
import { profile, type Selection } from "../domain/report.ts";

const inputClass =
  "min-h-11 rounded-md border border-line bg-surface px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-ring";
export function AnalyticsFilters({ selection }: { selection: Selection }) {
  const [route, setRoute] = useState(selection.route);
  const [section, setSection] = useState(selection.section_id);
  const sections = route === "all" ? [...new Set(Object.values(profile).flat())] : profile[route];
  return (
    <form method="get" action="/panel/analitica" className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-small">
        {es.analytics.filters.period}
        <select name="period" defaultValue={selection.period} className={inputClass}>
          <option value="day">{es.analytics.filters.day}</option>
          <option value="week">{es.analytics.filters.week}</option>
          <option value="month">{es.analytics.filters.month}</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        {es.analytics.filters.interval}
        <select name="offset" defaultValue={selection.offset} className={inputClass}>
          <option value="0">{es.analytics.filters.current}</option>
          <option value="1">{es.analytics.filters.previous}</option>
          <option value="2">{es.analytics.filters.twoBefore}</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        {es.analytics.filters.page}
        <select
          name="route"
          value={route}
          onChange={(event) => {
            setRoute(event.target.value as Selection["route"]);
            setSection("all");
          }}
          className={inputClass}
        >
          <option value="all">{es.analytics.filters.allPages}</option>
          <option value="/">{es.analytics.filters.home}</option>
          <option value="/grafismo-fonetico/">{es.analytics.filters.phoneticGraphism}</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        {es.analytics.filters.section}
        <select
          name="section_id"
          value={section}
          onChange={(event) => setSection(event.target.value as Selection["section_id"])}
          className={inputClass}
        >
          <option value="all">{es.analytics.filters.allSections}</option>
          {sections.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-small">
        {es.analytics.filters.viewport}
        <select
          name="viewport_bucket"
          defaultValue={selection.viewport_bucket}
          className={inputClass}
        >
          <option value="all">{es.analytics.filters.allViewports}</option>
          <option value="mobile">{es.analytics.filters.mobile}</option>
          <option value="tablet">{es.analytics.filters.tablet}</option>
          <option value="desktop">{es.analytics.filters.desktop}</option>
        </select>
      </label>
      <input type="hidden" name="locale" value="es" />
      <button
        type="submit"
        className="min-h-11 rounded-pill bg-action px-5 font-bold text-on-action focus-visible:outline-2 focus-visible:outline-ring"
      >
        {es.analytics.filters.submit}
      </button>
    </form>
  );
}
