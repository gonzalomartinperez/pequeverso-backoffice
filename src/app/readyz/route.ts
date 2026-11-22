import { connection } from "next/server";
import { authReady } from "#server/auth.ts";
import { config } from "#server/env.ts";
import { healthBody } from "#server/health.ts";
import { observability } from "#server/observability.ts";
import { isRequestId, REQUEST_ID_HEADER } from "#server/request-id.ts";

/**
 * Readiness (internal; not to be routed publicly): configuration parses, PostgreSQL answers and
 * the migrated tables exist. Liveness stays on /healthz. The body never says why it is not ready;
 * it adds the build `version` and the expected `schema_version` (expand only).
 */
export async function GET(request: Request) {
  await connection();
  const settings = config();
  const requestId = request.headers.get(REQUEST_ID_HEADER);
  const ready = await observability(settings.observability).observe(
    "readiness",
    authReady,
    (ready) => (ready ? "ok" : "unavailable"),
    isRequestId(requestId) ? requestId : null,
  );
  return Response.json(healthBody(ready ? "ready" : "not_ready", settings.version), {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
