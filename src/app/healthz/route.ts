import { connection } from "next/server";
import { config } from "#server/env.ts";
import { healthBody } from "#server/health.ts";

/**
 * Liveness of the frontend process only (no API call): the assistant's availability is the
 * API's own concern and the store must never depend on this answer. See docs/deployment-contract.md.
 * The body adds the build `version` and the expected `schema_version` (expand only).
 */
export async function GET() {
  await connection();
  return Response.json(healthBody("ok", config().version), {
    headers: { "Cache-Control": "no-store" },
  });
}
