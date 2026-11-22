# ADR 0010: Composition root, no separate DAL layer and the boundary guard policy

- Status: accepted
- Date: 2026-11-22
- Task: M4.1 (roadmap); amended by M4.8 (2026-11-22)

## Context and problem statement

Server composition was spread over `server/operations.ts`, `server/analytics.ts` and
`server/config.ts`, and three files read `process.env` directly (`config.ts`, `proxy.ts` and
`instrumentation.ts`). The ecosystem standard (section 9) suggests separate `server/dal` and
`server/domain` folders for backoffices. Should this repository add them, and where may the
environment be read?

## Considered options

1. Keep the spread composition and the ad hoc environment reads.
2. One composition root (`server/container.ts`) and one environment module (`server/env.ts`,
   parser in `server/env-parse.ts`), with the guard enforcing the single reader.
3. Option 2 plus separate `server/dal` and `server/domain` layers.

## Decision outcome

Option 2.

- Two composition files with one direction: `server/container.ts` wires the operations,
  telemetry and analytics reads (HTTP adapters, parsed configuration, `fetch`, tracing);
  `server/auth.ts` wires IAM (pool, Better Auth, `accessDeps`) and holds `requireActor`, the
  single authorization entry. The container may import `auth.ts`, never the reverse (the guard's
  cycle check fails the reverse edge). New IAM use cases (M4.6) are wired in `auth.ts`.
- The container builds the HTTP adapters per call, not once per process: the adapter carries the
  per-request trace context and nothing about an operations reading may be shared between
  requests or users (no server cache, ADR 0011 when written). The memoized state is only the
  parsed configuration and the observability registry.
- `server/env.ts` is the only module in `src/` that reads `process.env`. It parses the full
  configuration once per process (`config()`) and exposes two raw checks the proxy needs on
  every request (`developmentBuild()`, `httpsOrigin()`). Outside `env.ts`, `process` may be used
  only through a direct named member that is not the environment (`exit`, `uptime`,
  `memoryUsage`); aliases, computed keys, `globalThis.process` and `process` or `node:process`
  imports fail. `env-parse.ts` validates a plain object
  and never touches the process.
- No `dal` or `domain` folders under `server/`: the feature `application` layer plus
  `server/auth.ts` already act as the data access layer (use cases receive injected ports and the
  PostgreSQL store re-checks the role), so another layer would only forward calls. This is a
  justified deviation from ecosystem section 9.
- Guard policy: the custom guard (`scripts/check-boundaries.ts`) stays the primary layer because
  it checks more than Biome can (client reachability, purity, fail-closed parsing, the single
  environment reader). Biome rules are the second layer; enforcing them with an empty baseline
  and the TypeScript 7.1 migration of the guard (risk R3) are M4.8 and amend this record. Every new rule adds negative fixtures to
  `tests/unit/boundaries.test.ts`.
- The only exception to the single reader is `process.env.NEXT_RUNTIME` in
  `src/instrumentation.ts`: Next.js inlines it per runtime, and it must be read before any server
  module is imported.

### Consequences

- Good: one place to look for wiring and for every environment read; the rule is enforced.
- Good: no forwarding layer to maintain.
- Neutral: the proxy imports `server/env.ts`, which carries the `server-only` marker. In Next.js
  16 the proxy runs on the Node.js runtime and is compiled for the server, so the marker holds;
  `next build` and the browser suite on the production build confirm it. The proxy bundle also
  carries the configuration parser and `node:net`; `config()` is never called from the proxy.
  Moving the proxy to the edge runtime would need these two checks split out first.
- Bad: the guard still parses with the TypeScript 6 compiler API (`@typescript/typescript6`)
  until TypeScript 7.1 exposes one; M4.8 records the evaluation.

### Amendment (M4.8, 2026-11-22): second layer enforced, TypeScript 7.1 deferred

- Biome is the enforced second layer, with no baseline: `noImportCycles`,
  `noUndeclaredDependencies`, `noPrivateImports`, `useImportType` and `useImportExtensions`
  (every import names its file). `noExcessiveCognitiveComplexity` is capped at 10 for `src/`.
  `scripts/` and `tests/` keep ratcheted ceilings at their measured maximum (110 and 59 on
  2026-11-22), which may only go down. knip reports zero findings in `npm run check`.
- The guard adds target-state rule 10: a presentation or `shared/ui` module may not exceed 250
  lines. Dictionary data in `shared/i18n` is exempt. `shared/` covers `ui`, `lib` and `i18n` and
  imports only `shared`.
- TypeScript 7.1 evaluation: the stable `typescript` is 7.0.2, and it exposes only the
  `typescript/unstable/*` IPC API. 7.1 is published as `7.1.0-beta` and nightly `7.1.0-dev`, not
  as a stable release. The guard needs a synchronous parser and checker, so it stays on
  `@typescript/typescript6` (risk R9 realised, dev dependency only). Re-evaluate when
  `typescript@7.1.0` is stable: migrate the guard and the authz surface, then drop
  `@typescript/typescript6`.

### Confirmation

`npm test` runs the guard on the tree (`0 violations`) and its negative fixtures, including
`lets only server/env.ts read process.env` in `tests/unit/boundaries.test.ts`, which rejects
direct, bracketed, computed, aliased, parenthesized, destructured, written, `globalThis` and
`process` or `node:process` (static, dynamic and `require`) reads.
