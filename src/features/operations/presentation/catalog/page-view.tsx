import { es } from "#shared/i18n/es.ts";
import type { OpsReading } from "../../application/ports.ts";
import { OpsFrame, SyntheticBanner } from "../reading.tsx";
import { Catalog } from "./catalog.tsx";

export function CatalogView({ reading }: { reading: OpsReading }) {
  return (
    <OpsFrame title={es.operations.catalog.title} refreshHref="/panel/catalogo" reading={reading}>
      {(summary, fetchedAt) => (
        <>
          <SyntheticBanner summary={summary} />
          <Catalog summary={summary} now={fetchedAt} />
        </>
      )}
    </OpsFrame>
  );
}
