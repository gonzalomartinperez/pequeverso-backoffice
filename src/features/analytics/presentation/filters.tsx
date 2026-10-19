"use client";
import { useState } from "react";
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
        Período (UTC)
        <select name="period" defaultValue={selection.period} className={inputClass}>
          <option value="day">Día</option>
          <option value="week">Semana (lunes)</option>
          <option value="month">Mes</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        Intervalo
        <select name="offset" defaultValue={selection.offset} className={inputClass}>
          <option value="0">Actual, parcial</option>
          <option value="1">Anterior</option>
          <option value="2">Dos anteriores</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        Página
        <select
          name="route"
          value={route}
          onChange={(event) => {
            setRoute(event.target.value as Selection["route"]);
            setSection("all");
          }}
          className={inputClass}
        >
          <option value="all">Todas</option>
          <option value="/">Inicio</option>
          <option value="/grafismo-fonetico/">Grafismo Fonético</option>
        </select>
      </label>
      <label className="grid gap-1 text-small">
        Sección
        <select
          name="section_id"
          value={section}
          onChange={(event) => setSection(event.target.value as Selection["section_id"])}
          className={inputClass}
        >
          <option value="all">Todas</option>
          {sections.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-small">
        Ancho de pantalla
        <select
          name="viewport_bucket"
          defaultValue={selection.viewport_bucket}
          className={inputClass}
        >
          <option value="all">Todos</option>
          <option value="mobile">Menos de 768 px</option>
          <option value="tablet">768 a 1023 px</option>
          <option value="desktop">1024 px o más</option>
        </select>
      </label>
      <input type="hidden" name="locale" value="es" />
      <button
        type="submit"
        className="min-h-11 rounded-pill bg-action px-5 font-bold text-on-action focus-visible:outline-2 focus-visible:outline-ring"
      >
        Consultar
      </button>
    </form>
  );
}
