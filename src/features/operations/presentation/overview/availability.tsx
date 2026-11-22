import { CircleCheck, TriangleAlert } from "lucide-react";
import { Facts, Section } from "#shared/ui/sections.tsx";
import type { OpsSummary } from "../../domain/summary.ts";
import * as f from "../format.ts";

export function Availability({ summary }: { summary: OpsSummary }) {
  const available = summary.availability.status === "available";
  return (
    <Section
      id="availability"
      title="¿Puede responder ahora?"
      description="Estado declarado por la API en esta lectura, no un historial de uptime ni una comprobación del proveedor."
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">DISPONIBILIDAD PUNTUAL</p>
          <p className="mt-2 flex items-center gap-2 text-title text-ink">
            {available ? (
              <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-icon" />
            ) : (
              <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
            )}
            {available ? "Acepta preguntas" : "No acepta preguntas"}
          </p>
          <p className="mt-2 text-tiny text-muted">
            {available
              ? "Estado declarado en esta lectura."
              : f.reason(summary.availability.reason)}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">PRESUPUESTO RESTANTE DEL MES</p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.usd(summary.budget?.remainingMonth ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">
            Hasta el corte de seguridad mensual, con reservas pendientes y estimadas incluidas.
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">RESPUESTAS COMPLETADAS · 24 H</p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.count(summary.windows.find((w) => w.hours === 24)?.runs.completed ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">
            No mide disponibilidad; las omisiones no se convierten en cero.
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surface-sunken p-4 [overflow-wrap:anywhere]">
          <p className="text-tiny font-bold text-muted">PRIMER TEXTO · P95 · 24 H</p>
          <p className="mt-2 text-heading text-ink tabular-nums">
            {f.ms(summary.windows.find((w) => w.hours === 24)?.latency.firstDelta?.p95 ?? null)}
          </p>
          <p className="mt-2 text-tiny text-muted">
            Desde la aceptación hasta el primer fragmento emitido por la API; no hasta la respuesta
            final.
          </p>
        </div>
      </div>
      <p className="mt-3 text-tiny text-muted">
        Asistente habilitado en la API:{" "}
        {summary.service.assistantEnabled == null
          ? f.UNAVAILABLE
          : summary.service.assistantEnabled
            ? "sí"
            : "no"}
        . La tienda tiene su propio interruptor y no se lee desde aquí.
      </p>
    </Section>
  );
}

export function Service({ summary }: { summary: OpsSummary }) {
  const s = summary.service;
  return (
    <Section id="service" title="Servicio">
      <Facts
        items={[
          { term: "Modelo", value: s.model ?? f.UNAVAILABLE },
          { term: "Esfuerzo de razonamiento", value: s.reasoningEffort ?? f.UNAVAILABLE },
          { term: "Proveedor", value: s.provider ?? f.UNAVAILABLE },
          { term: "Entorno", value: s.environment ?? f.UNAVAILABLE },
          { term: "Revisión", value: <code>{s.revision ?? f.UNAVAILABLE}</code> },
          { term: "En marcha desde", value: f.when(s.startedAt) },
        ]}
      />
    </Section>
  );
}
