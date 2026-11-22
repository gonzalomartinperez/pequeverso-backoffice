import { Badge } from "#shared/ui/badge.tsx";
import { Facts, Section } from "#shared/ui/sections.tsx";
import { catalogFreshness, type OpsSummary } from "../../domain/summary.ts";
import * as f from "../format.ts";

export function Catalog({ summary, now }: { summary: OpsSummary; now: Date }) {
  const c = summary.catalog;
  const freshness = catalogFreshness(summary, now);
  return (
    <Section id="catalog" title="Catálogo">
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={c.status === "active" ? "chip" : "notice"}>
          {c.status === "active" ? "Activo" : "Sin catálogo válido"}
        </Badge>
        <Badge tone={freshness === "fresh" ? "chip" : "notice"}>
          {freshness === "fresh"
            ? "Precios vigentes"
            : freshness === "stale"
              ? "Precios vencidos: no se citan"
              : "Frescura no disponible"}
        </Badge>
      </div>
      <Facts
        items={[
          { term: "Revisión de la tienda", value: <code>{c.revision ?? f.UNAVAILABLE}</code> },
          {
            term: "Origen",
            value:
              c.source === "live"
                ? "Instantánea remota (no verifica despliegue)"
                : c.source === "bundled"
                  ? "Instantánea empaquetada"
                  : f.UNAVAILABLE,
          },
          { term: "Verificado", value: f.age(c.verifiedAt, now), hint: f.when(c.verifiedAt) },
          {
            term: "Ventana de precios",
            value: c.priceMaxAgeHours == null ? f.UNAVAILABLE : `${f.count(c.priceMaxAgeHours)} h`,
          },
          { term: "Último intento de sincronización", value: f.when(c.lastAttemptAt) },
          {
            term: "Último error de sincronización",
            value: c.lastFailure ?? "Ninguno registrado",
            ...(c.lastFailureAt ? { hint: f.when(c.lastFailureAt) } : {}),
          },
          { term: "Activado", value: f.when(c.activatedAt) },
          { term: "Productos", value: f.count(c.products) },
          { term: "Documentos", value: f.count(c.documents) },
        ]}
      />
    </Section>
  );
}
