import { es } from "#shared/i18n/es.ts";
import type { OpsReading } from "../../application/ports.ts";
import { OpsFrame, SyntheticBanner } from "../reading.tsx";
import { Recent, RunsGrid } from "./runs.tsx";

export function RunsView({ reading }: { reading: OpsReading }) {
  return (
    <OpsFrame
      title={es.operations.runs.pageTitle}
      refreshHref="/panel/ejecuciones"
      reading={reading}
    >
      {(summary) => (
        <>
          <SyntheticBanner summary={summary} />
          <RunsGrid summary={summary} />
          <Recent summary={summary} />
        </>
      )}
    </OpsFrame>
  );
}
