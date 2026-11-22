import { type NextRequest, NextResponse } from "next/server";
import { backofficeCsp } from "./server/csp.ts";
import { developmentBuild, httpsOrigin } from "./server/env.ts";
import { REQUEST_ID_HEADER, requestIdFrom } from "./server/request-id.ts";

const BACKOFFICE = /^\/(?:panel|ingresar|invitacion|api\/auth)(?:\/|$)/;

/**
 * Headers per request:
 * - Backoffice routes: nonce-based CSP, `frame-ancestors 'none'`, X-Frame-Options DENY,
 *   `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
 * - Everything else (health probes, the home redirect) refuses framing.
 * - Every response carries `x-request-id`: the sanitized incoming id or a new UUID, also
 *   forwarded to the app so server reads, logs and spans use the same id.
 * A proxy in front must not add or override these headers (docs/deployment-contract.md).
 */
export function proxy(request: NextRequest) {
  const requestId = requestIdFrom(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  if (BACKOFFICE.test(request.nextUrl.pathname)) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = backofficeCsp(nonce, developmentBuild());
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("x-request-id", requestId);
    // HSTS when the configured origin is https (the edge may send the same value; never weaker).
    if (httpsOrigin()) response.headers.set("Strict-Transport-Security", "max-age=31536000");
    return response;
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    "Content-Security-Policy",
    "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|fonts/|brand/|favicon.ico|apple-touch-icon.png|icon-192.png).*)",
  ],
};
