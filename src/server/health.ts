// Version fields of /healthz and /readyz (deployment contract, M4.7). `schema_version` is the
// newest migration this build expects; tests/unit/health.test.ts keeps it equal to the newest
// file in migrations/. Pure: no environment read here (the version comes from env.ts).

export const SCHEMA_VERSION = "0002";

export function healthBody<S extends string>(status: S, version: string) {
  return { status, version, schema_version: SCHEMA_VERSION };
}
