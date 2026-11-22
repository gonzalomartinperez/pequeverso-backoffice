// Not marked server-only so the redaction tests can import it directly; nothing client-side does.
import { isRequestId } from "./request-id.ts";

// Structured server logs: one JSON line per event with the request id. Only allow-listed field
// names with short, code-like values are written, so an e-mail, token, URL or free text passed
// by mistake is dropped instead of logged (tests/unit/log-redaction.test.ts).

const FIELDS = new Set(["reason", "outcome", "operation", "status", "code", "count"]);
const VALUE = /^[A-Za-z0-9_.:-]{1,64}$/;

type Level = "info" | "warn" | "error";

function safeFields(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!FIELDS.has(key)) continue;
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)))
      out[key] = value;
    else if (typeof value === "string" && VALUE.test(value)) out[key] = value;
  }
  return out;
}

/** Writes `{event, request_id, ...safe fields}` to the console stream for `level`. */
export function log(
  event: string,
  fields: Record<string, unknown>,
  requestId: string | null,
  level: Level = "warn",
): void {
  const line = JSON.stringify({
    event: VALUE.test(event) ? event : "invalid_event",
    ...(isRequestId(requestId) ? { request_id: requestId } : {}),
    ...safeFields(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
