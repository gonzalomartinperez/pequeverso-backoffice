import "server-only";
import { type BackofficeConfig, parseConfig } from "./env-parse.ts";

export type { BackofficeConfig };

// The only module in src/ that reads process.env (scripts/check-boundaries.ts enforces it; the
// single exception is the NEXT_RUNTIME branch of src/instrumentation.ts). Validation lives in
// env-parse.ts, which receives the environment as a plain object.

let cached: BackofficeConfig | null = null;

/** Parsed once per process on first use, so `next build` needs no secrets. */
export function config(): BackofficeConfig {
  cached ??= parseConfig(process.env);
  return cached;
}

/** Next.js inlines NODE_ENV at build time; the proxy uses it only to relax CSP in `next dev`. */
export function developmentBuild(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Raw origin check for the proxy, which must not parse (and fail on) the full configuration on
 * every request: HSTS is sent only when the configured origin is https.
 */
export function httpsOrigin(): boolean {
  return process.env.BACKOFFICE_ORIGIN?.startsWith("https://") === true;
}
