# ADR 009 — c8 for merged unit and integration coverage

**Status:** accepted (2026-11-14). Master-plan reference: task M2.1.

**Context.** The built-in `node --test --experimental-test-coverage` report cannot merge the unit
and the PostgreSQL integration runs: the IAM store reads 32.9% in the unit run alone, although the
integration suite exercises it. Coverage is a floor, not a goal; it gates branch coverage and the
changed lines of a pull request.

**Decision.** Add `c8` (ISC, V8 coverage) as an exact-pinned dev dependency. `npm run coverage` runs
both suites under one `NODE_V8_COVERAGE` directory and lets `c8 report` produce lcov and a JSON
summary for `src/**/*.ts`. Dependency-free scripts enforce the gates: `scripts/check-coverage.ts`
(branch floor 80% repo and, interim, 80% auth; 80% line coverage of the IAM store file; plus the
raise-only ratchet `quality/ratchets/coverage.json`) and `scripts/diff-coverage.ts` (changed executable lines: 90%
auth, 80% elsewhere). The plan named Python `diff-cover`; a 100-line TypeScript script reading the
same lcov avoids a second toolchain in CI and is covered by fixture tests.

**Measured gap.** The first merged run reads 86.5% branches repo-wide, 80.2% on auth paths and 89.5%
line coverage on `postgres-access-store.ts` (32.9% in the unit run; its branch figure is 60.7%, the
quoted 32.9% is lines). The plan target of 90% branches on auth paths is not met yet, so it is
reported as a target and enforced through the ratchet until tests (M2.4) close the gap; then the
interim floor is raised to 90 in the same PR. Only `src/**/*.ts` is measured; `.tsx` is excluded.

**Alternatives.** Node built-in report only (no merge); `nyc` (older, heavier); `diff-cover` with
`uvx` (extra runtime, no repository-owned negative tests).

**Consequences.** One dev dependency, no install scripts, no runtime impact. The coverage gate runs
only in the database job (the only one with PostgreSQL), on pull requests. Exit: remove `c8` and the
two scripts if the runner decision (ADR-0018) brings an equivalent merged report.
