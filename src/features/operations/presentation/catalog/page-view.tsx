import type { OpsReading } from "../../application/ports.ts";
import { OpsFrame, SyntheticBanner } from "../reading.tsx";
import { Catalog } from "./catalog.tsx";

export function CatalogView({ reading }: { reading: OpsReading }) {
  return (
    <OpsFrame title="Catálogo" refreshHref="/panel/catalogo" reading={reading}>
      {(summary, fetchedAt) => (
        <>
          <SyntheticBanner summary={summary} />
          <Catalog summary={summary} now={fetchedAt} />
        </>
      )}
    </OpsFrame>
  );
}
