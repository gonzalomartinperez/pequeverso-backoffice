import { es } from "#shared/i18n/es.ts";
import type { OpsReading } from "../../application/ports.ts";
import { OpsFrame, SyntheticBanner } from "../reading.tsx";
import { Budget, Daily } from "./usage.tsx";

export function UsageView({ reading }: { reading: OpsReading }) {
  return (
    <OpsFrame title={es.operations.usageTitle} refreshHref="/panel/consumo" reading={reading}>
      {(summary) => (
        <>
          <SyntheticBanner summary={summary} />
          <Daily summary={summary} />
          <Budget summary={summary} />
        </>
      )}
    </OpsFrame>
  );
}
