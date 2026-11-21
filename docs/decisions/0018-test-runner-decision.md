# ADR 0018: Test runner decision (spike S1): StrykerJS on node:test

- Status: accepted
- Date: 2026-11-14
- Task: M2.2 (roadmap), DR-09

## Context

The master plan asked for one spike (S1) for the four TypeScript repositories: StrykerJS with
TypeScript 7 on `node:test` (through `@stryker-mutator/tap-runner`) or on Vitest 4, preferring
Vitest if it works. The spike ran per repository on 2026-11-14 because no shared result existed
when M2 started, and two siblings decided differently:

- `pequeverso` (ADR-0015): StrykerJS 10.1.1 with the tap-runner on `node:test`; no Vitest.
- `portfolio-backoffice` (ADR008): Vitest 5.1 with the Stryker Vitest runner, moving its whole
  unit suite to Vitest.

Facts shared by both, reproduced here: TypeScript 7 has no JavaScript compiler API, so Stryker's
TypeScript checker and its tsconfig preprocessor fail (`ts.parseConfigFileTextToJson is not a
function`). Mutation must run without a checker. Type-invalid mutants then surface as runtime
errors, and those are left out of the score.

## Decision

This repository follows the `pequeverso` outcome. Unit tests stay on `node:test` with Node type
stripping (175+ tests, c8 merged coverage per ADR 009). Mutation testing uses StrykerJS 10.1.1
with `@stryker-mutator/tap-runner`. Both are exact-pinned dev dependencies.

- Scope (`stryker.config.json`): auth domain and application, the adapter validators, operations
  domain, CSP, configuration parsing and fixture safety. These are pure policy and validation
  modules, never UI glue. The server auth guard (`src/server/auth.ts`) is left out: no unit test
  reaches it (0 of 89 mutants detected in the baseline run), and the authorization matrix and
  browser suites cover it instead. The tests are the unit suites that cover them,
  with fast-check fixed at `FC_NUM_RUNS=25` and seed `20261114` so runs are reproducible.
- No checker plugin. `tsconfig.json` is ignored in the sandbox, and the `.claude`, `.agents` and
  `.codex` symlinked directories are ignored too.
- Pull requests: the `mutation` job of `ci.yml` is selected by the `mutation` profile. It runs
  only for the changed scoped files (at most 8; `scripts/mutation-scope.ts`), with Stryker
  `break` 0. `scripts/mutation-gate.ts` then fails a file that scores below its per-file
  baseline in `quality/ratchets/mutation.json`. A file with no baseline must reach 70.
- Nightly: `mutation-nightly.yml` runs the full scope and fails when the global score falls
  below the recorded baseline. GitHub runs `schedule` only from `main`, so the schedule
  activates at M7. Until then, PRs that touch the tooling prove it.
- Targets: break 70 and the permission module 85. The ratchet starts at the measured score,
  never lower, and is raised by hand until it reaches the targets.

Vitest was not adopted because moving 175+ tests buys nothing for mutation that the tap-runner
does not already give. The ecosystem stays split two to one in favour of `node:test`. The
standards lead records the divergence (`portfolio-backoffice` on Vitest).

## Consequences

- No new runtime dependency. The 164 added lockfile packages carry only allow-listed licences
  (`docs/dependencies.md`).
- Type-invalid mutants are not filtered before running. Re-enable the checker when Stryker
  supports TypeScript 7, either through TypeScript 7.1's API or a TypeScript 6 alias given to
  Stryker alone.
- The full run is slow on a loaded workstation, so the baseline comes from the measured full
  run recorded in `quality/ratchets/mutation.json`. The nightly job's 50-minute step timeout
  fails loudly if it ever overruns on a hosted runner.

## Confirmation

`tests/unit/mutation-scope.test.ts` covers the PR scope selection, the gate arithmetic and the
ratchet file. The `mutation` CI job runs on every PR that touches a scoped module.
