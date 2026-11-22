import { CircleAlert, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "#shared/ui/button.tsx";
import { Callout } from "#shared/ui/callout.tsx";
import type { OpsReading } from "../application/ports.ts";
import type { OpsSummary } from "../domain/summary.ts";
import * as f from "./format.ts";

const UNAVAILABLE_READING: Record<Exclude<OpsReading, { status: "ok" }>["reason"], string> = {
  not_configured: "El backoffice no tiene configurada la conexión privada con la API.",
  unreachable: "La API no respondió a tiempo.",
  rejected: "La API rechazó la lectura (credencial o servicio).",
  invalid: "La API respondió con datos que no cumplen el contrato.",
};

export function OpsFrame({
  title,
  refreshHref,
  reading,
  children,
  unavailableContent,
}: {
  title: string;
  refreshHref: string;
  reading: OpsReading;
  children: (summary: OpsSummary, fetchedAt: Date) => ReactNode;
  unavailableContent?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading">{title}</h1>
          <p className="text-small text-muted">
            Lectura del {f.when(reading.fetchedAt)}. Sin contenido de conversaciones: solo agregados
            operativos.
          </p>
        </div>
        <LinkButton href={refreshHref} variant="outline" size="sm">
          Actualizar lectura
        </LinkButton>
      </header>
      {reading.status === "ok" ? (
        children(reading.summary, reading.fetchedAt)
      ) : (
        <Callout tone="danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <p className="font-extrabold text-ink">Métricas no disponibles</p>
            <p>{UNAVAILABLE_READING[reading.reason]} Ningún valor se muestra como cero por esto.</p>
          </div>
        </Callout>
      )}
      {reading.status !== "ok" ? unavailableContent : null}
    </div>
  );
}

export function SyntheticBanner({ summary }: { summary: OpsSummary }) {
  return summary.service.synthetic ? (
    <Callout tone="notice" role="note" data-testid="synthetic-banner">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>Datos sintéticos (fixture).</strong> La API usa el proveedor de prueba: las cifras
        de uso y costo no representan consumo real de OpenAI.
      </p>
    </Callout>
  ) : null;
}
