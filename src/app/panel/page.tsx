import { Dashboard } from "@/features/operations/presentation/dashboard";
import { requireActor } from "@/server/auth";
import { readOperations, readTelemetry } from "@/server/container";

/** Read per request on the server; the browser never sees the ops credential or the API URL. */
export default async function OperationsPage() {
  await requireActor("read_operations");
  const [reading, telemetry] = await Promise.all([readOperations(), readTelemetry()]);
  return <Dashboard reading={reading} telemetry={telemetry} />;
}
