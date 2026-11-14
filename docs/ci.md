# Continuous integration

[ci.yml](../.github/workflows/ci.yml), named **CI**, is the single entry point for pull requests into
`develop` or `main`, pushes to either branch, merge groups and manual dispatch. Changes follow task
branch → `develop` → `main`.

## Profiles and the single required check

The first job, `classify`, is the `engineering-standards` reusable workflow pinned by SHA (see
[standards.lock](../standards.lock)). It reads the changed files, branch and labels against
[.github/ci-profile.json](../.github/ci-profile.json) and emits the list of jobs to run; every other
job runs only when listed. It fails closed: a file outside every profile, a diff error, a change to
the profile map, a push, a Dependabot branch (`deps-weekly`) or a `develop` → `main` PR (`release`)
runs everything. A unit test keeps every tracked file inside some profile.

| Job ID | Check name | Runs for | Verification |
| --- | --- | --- | --- |
| `classify` | classify | always | Profile and job list |
| `security` | security / … | every PR (base) | zizmor (low and above), actionlint, gitleaks on the PR commits, dependency review |
| `secrets` | Secret scan | every PR (base) | Redacted full-history gitleaks scan |
| `docs` | Docs checks | docs, code, contract, workflow | Public-file scan, local links, skills catalog (Node built-ins, no install) |
| `static` | Static checks | code, database, container, contract, workflow | `npm run setup` (install and `check:fast`), dependency audit, knip |
| `build` | Production build | code, contract, workflow | `next build` once; the `.next` output is the browser job's artifact |
| `database` | Database tests | code, database paths, contract, workflow | Mandatory PostgreSQL migrations and IAM integration suite, merged coverage and its gates |
| `container` | Container verification | container paths, workflow | Bake build of both images, metadata, image gates, smoke and restore drill |
| `browser` | Browser tests | code, contract, workflow | The build artifact, disposable PostgreSQL, fake identity provider, synthetic ops data, all engines |
| `ci-gate` | ci-gate | always | Fails on a failed or cancelled job and on a skipped job the profile expected |
| `checks` | Required checks | always | Compatibility alias: green only when `ci-gate` is green |

A docs-only PR runs `classify`, `security`, `secrets`, `docs` and the gate. Budgets (ecosystem 6.2,
backoffice): PR critical path p50 6 min, p95 12 min; docs-only p50 2 min.

**Required check swap (M1.3, owner).** The ruleset still requires **Required checks**, which now
mirrors `ci-gate`, so there is no enforcement gap. The owner adds `ci-gate` as required, and only
after both contexts are green on one PR retires **Required checks** and then removes the `checks`
alias job in a follow-up PR.

Each custom job verifies that its checkout equals the event SHA and records that SHA, the workflow
revision, the run ID and (for PR events) the head and base SHAs. Only obsolete PR runs are
cancelled. Production deployment, image publication, real OAuth, model calls and paid services are
not part of this workflow. The default token has no permissions; jobs receive only read access and
do not persist credentials.

## Coverage and local verification

The existing browser configuration retains four projects across Chromium, Firefox and WebKit,
including mobile Chromium. The recorded pre-change suite inventory is 54 browser IDs: 51 exercised
and three explicitly gated real-API cases skipped. The owner reported 122 unit and 19 database tests
before this CI change. Those are historical results, not results of a new workflow run; the added
CI policy tests also change the unit-test count. No browser test, project, command or skip condition
is removed by this profile alignment. Fake-provider tests do not verify real provider credentials.

Run `nvm use` and `npm ci`, then:

```sh
npm run check
npm run test:db
npm run test:browser
```

Database and browser verification require their documented isolated fixtures; see
[verification.md](verification.md). Container smoke remains in the hosted container job. A
source-only review or local policy-test pass does not establish database, browser or container
success. Hosted checks must pass on the exact proposed head and again after integration before
reporting the new workflow verified.

## Merged coverage gate

The `database` job runs `npm run coverage` (`scripts/coverage.ts`): the unit and the PostgreSQL
integration suites under one `NODE_V8_COVERAGE` directory, merged by `c8` into
`coverage/lcov.info` and `coverage/coverage-summary.json` (uploaded as the `coverage` artifact;
needs `DATABASE_URL`). `npm test` stays fast and unchanged. The `code` profile adds the `database`
job, so every code PR (including `src/shared/**` and `tests/unit/**`) runs the gate. On push and
merge-queue runs only the floors and the ratchet run (no base needed); on pull requests two
dependency-free scripts then gate the result ([decision](adr/009-coverage-c8-merged.md)):

- `scripts/check-coverage.ts`: branch floor 80% whole repo; branch coverage of
  `src/features/auth/**` and `src/server/auth.ts` has the plan target 90% (reported) and an interim
  80% floor until the measured gap closes; 80% line coverage of the IAM store file; and the raise-only ratchet
  `quality/ratchets/coverage.json` (measured values rounded down; a PR may raise it, never lower
  it: the script compares it with the base revision). Every ratchet key must be a finite number in
  [0, 100]; a missing key, a non-number, an empty file set or an unresolvable base ref fails closed.
  The base is the merge commit's first parent (CI checks out the PR merge ref), else the merge base.
- `scripts/diff-coverage.ts`: changed executable lines under `src/**` need 90% coverage on auth
  paths and 80% elsewhere (lcov plus `git diff -U0`). A changed `src/**/*.ts` file missing from lcov
  fails unless it is type-only; changed `.tsx` lines are unmeasured and their count is printed.

Both gates read only standard lcov and the istanbul `coverage-summary.json` (no c8-specific
assumptions), so they survive the planned move to Vitest and `@vitest/coverage-v8` (M2.2); only
`scripts/coverage.ts` is c8-specific.

Both have fixture tests, including failing cases, in `tests/unit/coverage-gate.test.ts`. Locally:
`DATABASE_URL=... npm run coverage && npm run coverage:check`.

The unit suite includes [ci-profile.test.ts](../tests/unit/ci-profile.test.ts): every tracked file
is in a profile, every job is gated on `classify` and named in the map, `ci-gate` needs every job
and pins the standards action, the alias passes only on a green gate, and workflow and required
status names never collide. The fail-closed aggregation itself is tested in `engineering-standards`.

The [skill catalog validator](../scripts/check-skills.ts) runs in the existing static
file/docs/skills step. Its [filesystem negative cases](../tests/unit/skills.test.ts) run
through the existing `npm test` unit glob before that step. They check actual directory
links and resources without executing procedures or contacting services. See
[agent skills](agent-skills.md) for the canonical catalog and limits. No new job,
optional gate, permission or status context is introduced.

## Property and fuzz tests

`npm test` includes the property and validator fuzz suites with 100 runs per property.
`FC_NUM_RUNS` controls domain properties; `FC_FUZZ_RUNS` controls each validator mutation
property. Set `FC_SEED` to replay a seed; otherwise fast-check chooses a random seed.
Failures retain fast-check's seed, shrink path and shrunk counterexample in the test log.
To replay a particular failure, use its seed and inputs (or fast-check's reported `path`
in the failing assertion's options).

Run `npm run test:property:nightly` for 1,000 domain runs and 5,000 fuzz runs per property:

```sh
FC_NUM_RUNS=1000 FC_FUZZ_RUNS=5000 node --test tests/unit/properties.test.ts tests/unit/validator-fuzz.test.ts
```

Nightly workflow wiring is deferred to M2.10. Tests use committed synthetic examples,
bounded mutations and explicit invitation timestamps, with no network calls.

## Standards drift

[drift](../.github/workflows/drift.yml) runs the pinned `engineering-standards` drift check on every
pull request, weekly and on demand: byte-matched files listed in [standards.lock](../standards.lock)
must equal the release templates and the Dependabot file must follow the weekly-group policy. It is
advisory today (not part of **Required checks**); `tests/unit/standards-lock.test.ts` keeps every
standards pin equal to the lock. The shared PR template carries no repository commands: before a
PR run `npm run check`, `npm run test:db` and `npm run test:browser` (see `AGENTS.md`).

## Image gates

Grype downloads its vulnerability database on every run, so a newly published fixable high or
critical advisory can turn the container job red without a code change; the fix is a base-image
digest move or a signed Debian security pin. The PostgreSQL artifact pins its security packages to
exact Debian versions and is built without cache, so a superseded version fails the build loudly;
refresh the pins from the Debian archive (or move the base digest) in a normal task PR.

## Scheduled supply-chain workflows

All three call or copy the pinned `engineering-standards` v1.0.0 templates:

| Workflow | When | What |
| --- | --- | --- |
| [deps-weekly-guard](../.github/workflows/deps-weekly-guard.yml) | Monday 10:30 ART and Dependabot PR events | At most one open Dependabot PR (older one superseded with a comment), branch kept up to date, `needs-fix` label and one tracking issue when CI is red |
| [vuln-daily](../.github/workflows/vuln-daily.yml) | Daily 07:00 ART | Records findings silently in one pinned `vuln` tracking issue; only the Monday run posts the weekly summary that notifies (OD-75) |
| [scorecard](../.github/workflows/scorecard.yml) | Weekly and on pushes to `main` | OpenSSF Scorecard with SARIF upload; the first run is the baseline |

GitHub runs scheduled and manually dispatched workflows only from the default branch (`main`), so
these start when `develop` is promoted (M7); the guard's pull-request trigger works on `develop`
now. CodeQL uses the repository's default setup (no workflow file), an owner setting.

## Release PR

[Release PR](../.github/workflows/release-please.yml) runs release-please in manifest mode on pushes
to `develop` ([config](../release-please-config.json), [manifest](../.release-please-manifest.json)):
it opens or updates one release PR with the version and `CHANGELOG.md`; it never tags, builds or
publishes. It is skipped until the owner grants a GitHub App (`RELEASE_APP_ID` variable and
`RELEASE_APP_PRIVATE_KEY` secret), because PRs opened with `GITHUB_TOKEN` do not trigger CI. The
redesign ships as 2.0.0 (`Release-As: 2.0.0`, PVB-D13) at M7.

## Node LTS trial

[Node LTS trial](../.github/workflows/node-matrix.yml) runs type checking, unit tests and the
production build on Node 24 and Node 26 for pull requests into and pushes to `develop` during the
two-week trial of [ADR 008](adr/008-node-26-trial.md). It is advisory: not a required context and
not part of **Required checks**.

## Dependencies and check-name maintenance

[Dependency policy](../.github/workflows/dependency-policy.yml) remains read-only and manual by
default. It checks trusted policy code from the default branch and does not approve or merge PRs.
A matching title, label or successful CI run alone is not dependency-update authorization.

Keep workflow names unique and reserve `ci-gate` and **Required checks** for the CI workflow. If a future
required context changes, first produce a green new context, then have the authorized owner add it
without an enforcement gap, and only then retire the old requirement or compatibility alias. Never
bypass checks or weaken protections to rename a job. `ci-gate` fails closed on any failed or
cancelled job and on any skipped job its profile expected; **Required checks** mirrors it.
