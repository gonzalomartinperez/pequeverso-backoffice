import { es } from "#shared/i18n/es.ts";
import * as f from "#shared/lib/format.ts";
import { Badge } from "#shared/ui/badge.tsx";
import { Facts, Section } from "#shared/ui/sections.tsx";
import { catalogFreshness, type OpsSummary } from "../../domain/summary.ts";

const FRESHNESS = {
  fresh: es.operations.catalog.freshPrices,
  stale: es.operations.catalog.stalePrices,
  unknown: es.operations.catalog.unknownFreshness,
} as const;

function origin(source: string | null): string {
  if (source === "live") return es.operations.catalog.remoteSnapshot;
  if (source === "bundled") return es.operations.catalog.bundledSnapshot;
  return f.UNAVAILABLE;
}

export function Catalog({ summary, now }: { summary: OpsSummary; now: Date }) {
  const c = summary.catalog;
  const freshness = catalogFreshness(summary, now);
  return (
    <Section id="catalog" title={es.operations.catalog.title}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={c.status === "active" ? "chip" : "notice"}>
          {c.status === "active"
            ? es.operations.catalog.active
            : es.operations.catalog.noValidCatalog}
        </Badge>
        <Badge tone={freshness === "fresh" ? "chip" : "notice"}>{FRESHNESS[freshness]}</Badge>
      </div>
      <Facts
        items={[
          {
            term: es.operations.catalog.storeRevision,
            value: <code>{c.revision ?? f.UNAVAILABLE}</code>,
          },
          {
            term: es.operations.catalog.origin,
            value: origin(c.source),
          },
          {
            term: es.operations.catalog.verified,
            value: f.age(c.verifiedAt, now),
            hint: f.when(c.verifiedAt),
          },
          {
            term: es.operations.catalog.priceWindow,
            value: c.priceMaxAgeHours == null ? f.UNAVAILABLE : `${f.count(c.priceMaxAgeHours)} h`,
          },
          { term: es.operations.catalog.lastSyncAttempt, value: f.when(c.lastAttemptAt) },
          {
            term: es.operations.catalog.lastSyncError,
            value: c.lastFailure ?? es.operations.catalog.noSyncError,
            ...(c.lastFailureAt ? { hint: f.when(c.lastFailureAt) } : {}),
          },
          { term: es.operations.catalog.activated, value: f.when(c.activatedAt) },
          { term: es.operations.catalog.products, value: f.count(c.products) },
          { term: es.operations.catalog.documents, value: f.count(c.documents) },
        ]}
      />
    </Section>
  );
}
