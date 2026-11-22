# ADR 0010: Composition root, no separate DAL layer and the boundary guard policy

- Status: accepted
- Date: 2026-11-22
- Task: M4.1 (roadmap); M4.8 completes the TypeScript 7.1 part

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

- `server/container.ts` wires the operations, telemetry and analytics HTTP adapters to the
  parsed configuration, `fetch` and tracing. Access wiring stays in `server/auth.ts`
  (`requireActor`, `accessDeps`), the single authorization entry.
- `server/env.ts` is the only module in `src/` that reads `process.env`. It parses the full
  configuration once per process (`config()`) and exposes two raw checks the proxy needs on
  every request (`developmentBuild()`, `httpsOrigin()`). `env-parse.ts` validates a plain object
  and never touches the process.
- No `dal` or `domain` folders under `server/`: the feature `application` layer plus
  `server/auth.ts` already act as the data access layer (use cases receive injected ports and the
  PostgreSQL store re-checks the role), so another layer would only forward calls. This is a
  justified deviation from ecosystem section 9.
- Guard policy: the custom guard (`scripts/check-boundaries.ts`) stays the primary layer because
  it checks more than Biome can (client reachability, purity, fail-closed parsing, the single
  environment reader). Biome rules are a second layer. Every new rule adds negative fixtures to
  `tests/unit/boundaries.test.ts`.
- The only exception to the single reader is `process.env.NEXT_RUNTIME` in
  `src/instrumentation.ts`: Next.js inlines it per runtime, and it must be read before any server
  module is imported.

### Consequences

- Good: one place to look for wiring and for every environment read; the rule is enforced.
- Good: no forwarding layer to maintain.
- Neutral: the proxy imports `server/env.ts`, which carries the `server-only` marker; the proxy
  runs on the server, so the marker holds.
- Bad: the guard still parses with the TypeScript 6 compiler API (`@typescript/typescript6`)
  until TypeScript 7.1 exposes one; M4.8 records the evaluation.

### Confirmation

`npm test` runs the guard on the tree (`0 violations`) and its negative fixtures, including
`lets only server/env.ts read process.env` in `tests/unit/boundaries.test.ts`, which rejects
direct, bracketed, computed, destructured, `globalThis` and `node:process` reads.
