// Request correlation (ecosystem section 18.1, M4.7). The proxy accepts a well-formed incoming
// `x-request-id` or creates one, forwards it to the app and echoes it on the response; server
// reads pass it to the private API call, logs and spans. Pure: also imported by the proxy.

export const REQUEST_ID_HEADER = "x-request-id";
/** Span attribute carrying the request id (never a user, e-mail or token). */
export const REQUEST_ID_ATTRIBUTE = "request.id";

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** True for an id that is safe to forward, log and echo: 8-64 URL-safe characters. */
export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID.test(value);
}

/** Keeps a well-formed incoming id; anything else (absent, short, injected) gets a fresh UUID. */
export function requestIdFrom(header: string | null | undefined): string {
  return isRequestId(header) ? header : crypto.randomUUID();
}
