# Testing

Applies `ecosystem.md` section 11 (catalog 11.0, backoffice column of 11.1, runner and mutation 11.2, cadence 11.3). Baseline: 159 unit tests (node:test, 13 s), 19 integration tests on real PostgreSQL, 54 browser test IDs on four Playwright projects (`audit.md`). Pragmatism rule: a type exists only if it guards a real risk of this app (private, two roles, three server actions, one external contract, no public traffic).

## 1. Decisions

| Topic | Decision | Why and source |
|---|---|---|
| Runner (E7, DR-09) | **One spike (S1, M2.2) decides for all four TypeScript repos**: Vitest 4 preferred if StrykerJS works with TS 7, otherwise `node:test` with Stryker `tap-runner`; this repo does not pre-commit to either. Today unit and integration run on `node:test`. Spike S1 in M2 (1 day): run mutation on the auth domain with TS 7 type stripping; kill criterion: if mutants cannot be run incrementally in under 30 min or TS 7 breaks the checker on one runner, use the other | The suite is fast and dependency-free; the same runner everywhere keeps four repos consistent. Recorded in ADR-0018 |
| Component tests | Render real markup with `react-dom/server` in node:test (the existing `analytics-presentation.test.ts` pattern) plus Playwright for behaviour; no jsdom, no Vitest Browser Mode | Server-rendered kit; interaction is native-element based |
| Coverage tool | `c8` (V8 coverage) merging unit and integration runs through `NODE_V8_COVERAGE`; `diff-cover` for the diff | The built-in report cannot merge: the store reads 32.9% in the unit run. ADR required for the dev dependency (`dependencies.md`) |
| Fake identity provider | **Kept** (owner decision). `scripts/fake-idp.ts` is the sign-in for E2E, per-role stored auth state, visual capture, Lighthouse and ZAP. Guards: production refuses `AUTH_TEST_ISSUER` (config test exists, kept), the fake IdP binds loopback only, a test asserts the production image build contains no reference to it | Real Better Auth callback exercised without Google or GitHub; the real providers are MV |
| Browser matrix on PR | Chromium plus WebKit iPhone project; nightly and release: Chromium, Firefox, WebKit, Pixel 7 | Ecosystem 11.1 backoffice row; today every PR pays for four engines |
| Retries and flakes | `retries: 1` on CI; a pass on retry is recorded as flaky; `failOnFlakyTests` on main and release; warn for the first month on PRs | `ecosystem.md` 6.3 |
| Live API tests | The three `live-ops.spec.ts` cases stay skipped until MV | Need the VPS and the API |

## 2. Catalog mapping (every row of ecosystem section 11.0)

| Family | Test type | Tool | Scope | Threshold | Cadence |
|---|---|---|---|---|---|
| Correctness | Unit | runner per ADR-0018 (today node:test) | domain, application, validators, csp, env, format, derivations | 159 tests today; branch floor **80%** whole repo, **90%** on `features/auth/**` and `server/auth.ts` (merged coverage) | PR, nightly, release |
| Correctness | Integration with real PostgreSQL | runner per ADR-0018 (today node:test), PostgreSQL 18.6 service container (digest pinned) | migrations, IAM, invitations, revocation, rate limits, runtime role, audit and sessions read models | 19 today, all must pass; suite under 90 s; random order | PR (affected: `migrations/**`, `src/features/auth/**`, `src/server/**`), nightly, release |
| Correctness | Component (all states) | runner per ADR-0018 (today node:test) with `react-dom/server`, plus `/__kit` page in Playwright | every kit component in every state of `design-playbook.md` section 7 | 100% of components listed in the kit manifest have a state test (manifest test) | PR (affected: `src/shared/**`) |
| Correctness | Architecture and boundary | `scripts/check-boundaries.ts` with negative fixtures, Biome import rules, knip | whole `src` | 0 violations, empty baseline; every rule has a negative fixture | PR, pre-commit |
| Test quality | Mutation | StrykerJS (tap-runner, spike S1) | `features/auth/domain` and `features/auth/application`, `features/*/adapters/validate*.ts`, `features/operations/domain`, `server/{csp,env-parse,fixture-safety,auth}.ts`, `shared/lib/format.ts`; never UI glue | PR incremental on changed files: break **70**; permission module **at least 85**, rest at least 75 target; nightly full scoped run 60 min budget | PR incremental, weekly or nightly full, release |
| Test quality | Coverage and diff coverage | c8, diff-cover | whole repo and PR diff | floors above; diff **90%** on auth and permission code, **80%** elsewhere | PR |
| Test quality | Flake detection | Playwright `--repeat-each=5` on the PR-tagged journeys, runner per ADR-0018 (today node:test) repeated runs on the DB suite | required checks | 0 flaky over 30 days; quarantine cap 2% or 5 tests | nightly |
| Input space | Property-based | fast-check | permission lattice and monotonic role rules; invitation state machine (pendiente, vencida, aceptada, revocada precedence); e-mail normalization idempotence; analytics selection parse and serialize round trip; filter and sort query round trip; money and percentage derivations (non-negative, sums reconcile, no NaN); `Metric` derivation (null never becomes 0); cursor pagination (no gaps or duplicates) | 100 runs on PR, 1,000 nightly, shrink output kept | PR, nightly |
| Input space | Parser and validator fuzzing | fast-check arbitraries mutating the committed contract examples | ops, telemetry and analytics validators (`adapters/validate*.ts`): unknown field, wrong type, oversized, non-UTF8, NaN, negative, extra nesting | Every mutation either parses to a valid model or is rejected; never throws an uncaught error; 100 runs PR, 5,000 nightly | PR, nightly |
| Input space | API fuzzing from OpenAPI (Schemathesis) | not applicable | The app exposes no OpenAPI surface; its routes are HTML, Better Auth endpoints (third-party, covered by the matrix and advisory tests) and three health or metrics handlers | n/a | n/a |
| Contracts | Pinned-contract integrity | existing unit tests | SHA-256 of the five pinned files against `source.json`; examples parse | all pass | PR |
| Contracts | Consumer drift watch | nightly job fetches `develop` contract files from the API repository (read-only, token-free for public repos), runs this repo's validators against the API's own examples | ops 1.2, telemetry 1.0, analytics | drift opens an issue labelled `contract`; never auto-updates the pin | nightly |
| Contracts | Breaking-change detection (oasdiff) | not applicable | The backoffice is a consumer, not a producer of OpenAPI; the `contract` profile instead runs the validators and generated-type compile against changed pins | n/a | on `contracts/**` change |
| Contracts | SSE conformance, event schemas | not applicable | No SSE or product events are produced here; the analytics report is a request-response read | n/a | n/a |
| End to end | Journeys | Playwright | sign-in (fake IdP), owner admission, invited viewer admission and read-only, revoke, six destinations, filters in URL, palette, keyboard model, theme and density, invitation error variants | **15-25 journeys** (today about 20 inside 54 IDs); per-role projects with stored auth state | PR Chromium plus WebKit iPhone (tagged), nightly all engines |
| End to end | Checkout hand-off to Hotmart | not applicable | No checkout in the backoffice | n/a | n/a |
| End to end | Monthly real-device check | manual | One phone, Safari iOS and Chrome Android, one view per template | checklist signed once at M5 and at each release | release |
| Visual | Screenshot regression | Playwright `toHaveScreenshot`, pinned Playwright container | 10 routes x 2 themes x 3 viewports + state fixtures + `/__kit` | `maxDiffPixelRatio` 0.002, animations disabled, frozen clock, fonts ready, reduced-motion variant; baselines in repo, cap 12 MB | PR (affected routes), release (all) |
| Visual | Per-figure hero snapshots | not applicable | No hero or 3D | n/a | n/a |
| Accessibility | axe | `@axe-core/playwright` WCAG 2.2 AA tags | every route x theme x state (menus, dialogs, errors, empty) | 0 violations | PR |
| Accessibility | Keyboard, focus, reduced motion, zoom, forced colors | Playwright | per template journey; focus visible and never obscured; 200% and 400% zoom; `forcedColors: active`; `reducedMotion: reduce` | all pass | PR (keyboard, reduced motion), nightly (zoom, forced colors) |
| Accessibility | Screen-reader checklist | manual VoiceOver Safari, NVDA Firefox | one view per template | signed per release; **human input**, floor 90 on P3 until done | release |
| Performance | Lighthouse budgets | Lighthouse CI, 5 runs, median | sign-in, Resumen, Consumo; mobile and desktop | performance at least 0.90, a11y 1.0, best practices at least 0.95, TBT at most 200 ms, LCP at most 2.0 s, CLS at most 0.05; SEO excluded (noindex test instead) | PR (warn 14 days then fail), release |
| Performance | Bundle budgets | `scripts/check-bundle.ts` over build output (spike to confirm Next 16 manifests, M2) | per route first-load JS, fonts | at most **170 KB gz** per route, fonts at most 160 KB | PR |
| Performance | RUM field CWV | not applicable until MV | Private app, undeployed; web-vitals collection would be new telemetry and needs an owner decision | n/a | MV |
| Performance | Interaction and fluidity | Playwright with Performance API | open palette, open peek sheet, change filter | at most 100 ms to next paint on the mock (lab), no long animation frame over 50 ms during the interaction | nightly |
| Performance | API latency p95, TTFT | not applicable | The app has no model endpoint; server render time of each route against the mock is a unit-level probe | route server time at most 150 ms on the mock | nightly |
| Load and resilience | Load, stress, soak | not applicable | One or two users; a load test would test the mock | n/a | n/a |
| Load and resilience | Dependency-failure tests | Playwright plus mock modes | ops API down, rejecting, slow (4 s timeout), malformed; telemetry disabled or invalid; PostgreSQL down (readyz 503, panel error state); optional analytics disabled | each yields the documented state, never numbers; existing tests kept and extended with PostgreSQL-down and slow-API | PR (API cases), nightly (DB down) |
| Security | SAST | CodeQL default setup (JS/TS, Actions) | repo | 0 open high or critical | on push, weekly |
| Security | Secrets | gitleaks (full history), GitHub push protection, public-file scan | repo | 0 findings | PR |
| Security | Dependency and licence review | `dependency-review-action`, osv-scanner daily, `npm audit` | lockfile | no high advisory unaccounted; licence allow-list MIT, Apache-2.0, BSD, ISC, 0BSD, BlueOak | PR, daily |
| Security | Container scan | Grype on the built image digest (SHA-pinned), hadolint, dockle, container-structure-test | app image and postgres fixture image | 0 fixable high or critical; user 65532; labels; no shell; read-only rootfs | PR (when Docker files change), release |
| Security | DAST baseline | OWASP ZAP baseline against the preview stack (fake IdP session for the authenticated scan) | all routes | 0 medium or higher | nightly |
| Security | Authz matrix (role x resource x action) | runner per ADR-0018 (today node:test) over the real HTTP layer plus Playwright for pages | owner, viewer, anonymous, second owner/viewer; every route, server action and handler | **100% of mutating routes and server actions listed**; an enumeration test fails when a new `"use server"` export or non-GET handler is missing from the matrix: unauthenticated 401 or redirect, wrong role 403 (typed state for pages), wrong owner 403/404 consistently, object-id swap on invitation and member ids, mass assignment of role fields, session tamper, logout invalidation | PR |
| Security | CSRF and Origin | integration plus Playwright | all three server actions (Next.js Origin check), `api/auth` endpoints, `invitacion/[token]`; cookie-less cross-site navigation sign-in blocked; `Origin: null` rule; callback URL rejection (absolute, `//`, backslash, control characters) | all refused; existing cross-origin and state tests kept | PR |
| Security | Better Auth advisories | one regression test per advisory (GHSA-wxw3-q3m9-c3jr callback state; GHSA-9h47-pqcx-hjr4 OIDC/MCP defaults not enabled) plus every assertion of `research/04` section 12 | pinned at least 1.6.11 (current 1.7.10) | all pass; Dependabot bump re-runs them | PR |
| Security | Session expiry and revocation | integration | expiry, revoke member ends sessions (exists), revoke single session, revoke others | pass | PR |
| Security | Headers and CSP snapshot | unit snapshot plus Playwright | every route class: CSP, frame-ancestors, no-store, noindex, HSTS when https, permissions policy | snapshot unchanged unless intended | PR |
| Security | RSC and DTO leak checks | unit plus Playwright | rendered HTML and RSC payload of every route scanned for forbidden strings: bearer tokens, `OPS_READ_TOKEN` value, `DATABASE_URL`, provider secrets, contract-forbidden fields (prompts, answers, buyer data, cookies), invitation token after display | 0 matches | PR |
| Security | Prompt-injection and red-team | not applicable | No model call and no assistant UI in this repo | n/a | n/a |
| AI quality | Golden set, graders, retrieval, judge validation, prompt versions | not applicable | Owned by `pequeverso-assistant-api`; this app only displays operational aggregates | n/a | n/a |
| Data | Migration tests | `scripts/db-check.ts` plus runner per ADR-0018 (today node:test) | up on empty DB, forward-only re-apply idempotent, checksum verification, schema versus Better Auth schema (0 drift today), upgrade on a populated copy | pass; no down migrations by policy | PR (affected), release |
| Data | Seed and fixture safety | existing `fixture-safety` tests | synthetic data never labelled production | pass | PR |
| Data | Backup restore drill | `scripts/smoke-postgres.sh` plus `vps-ops` drill | dump, restore into an isolated database, run migrations idempotently, verify owner admission, revoked sessions, audit rows | script passes in CI; the real drill is MV and owned by `vps-ops` | CI release; monthly after MV |
| Build and runtime | Container structure | container-structure-test | user 65532, entrypoint, labels, no shell, migrations present, read-only rootfs with tmpfs | pass | PR (Docker files), release |
| Build and runtime | Image smoke | `scripts/smoke-image.sh` | fail-closed config, migrations, readiness, headers, SIGTERM exit | pass; extended with `version` fields | PR (Docker files), release |
| Build and runtime | Hosting contract and post-deploy verification | not applicable (not Hostinger); deploy check is `vps-ops` verifying `/readyz` version equals the release SHA | | | MV |
| Infrastructure | Host baseline, Ansible, Coolify config | not applicable | Owned by `vps-ops` | n/a | n/a |
| Content and SEO | Spanish copy | runner per ADR-0018 (today node:test) over `messages/es.ts` plus cspell | no hard-coded Spanish outside the dictionary; voseo and regionalism denylist; sentence case; glossary terms present | pass | PR |
| Content and SEO | Structured data, sitemap, robots, canonical | not applicable | Private, noindex; instead a test asserts `X-Robots-Tag: noindex, nofollow` and the meta tag on every route | pass | PR |
| Content and SEO | Link check | lychee | docs and README | 0 broken | docs profile, weekly |
| Time and concurrency | Frozen time and timezone | runner per ADR-0018 (today node:test) with a clock port, Playwright `page.clock` | expiry (48 h), relative times, UTC day buckets versus America/Argentina/Buenos_Aires display, month rollover, margin-note time of day | pass | PR |
| Time and concurrency | Race and concurrency | runner per ADR-0018 (today node:test) against PostgreSQL | concurrent invitations (exists), first sign-ups beyond pool size (exists), concurrent revoke and accept, concurrent last-owner removal | pass, no duplicate or lost rows | PR |
| Observability | Log redaction, metrics contract, request id | unit and integration | no PII, token or e-mail in logs or spans; metrics endpoint needs its own bearer (exists); `x-request-id` created, sanitized, propagated to the API call and echoed | pass | PR |
| Harness | Skill activation evals, docs checks, drift, CI profile coverage | `scripts/check-skills.ts` plus eval runner, `check-docs.ts`, standards drift, `ci-profile.test.ts` | every tracked file falls in at least one profile (test); each skill has `evals/triggers.json` | validation trigger accuracy drop at most 10 points; profile coverage 100% | PR (affected), weekly drift |
| Production synthetics | Uptime and journey probes | Uptime Kuma read-only probe of `/healthz` and `/readyz`; scheduled Playwright sign-in smoke with the real IdP is not allowed | VPS service | n/a until MV | MV |

## 3. Layers, numbers and mix (backoffice column of ecosystem 11.1)

| Layer | Target |
|---|---|
| Static | 0 lint, 0 type errors, 0 guard violations, knip clean |
| Mix by count | Today 232 tests: 159 unit (69%), 19 integration (8%), 54 browser test IDs (23%). Target at M6: at least 190 unit, at least 80 integration (the 19 today plus the authz matrix, contract, migration and component-state cases), 15 to 25 E2E journey specs (the 54 IDs are consolidated into per-role projects), so about 65% unit / 28% integration / 7% E2E by count; non-functional layers (a11y, performance, visual, ZAP, mutation) are measured by their own gates and ratchets, not by test count. M2 shifts the balance by adding matrix and integration cases, not by deleting unit tests |
| Coverage | branch floor 80% whole repo (baseline 88.8 so the ratchet starts at 88), 90% auth and permissions; diff 90% auth, 80% elsewhere |
| Mutation | Stryker scope above; break 70, permission module 85 |
| E2E | 15-25 tests, per-role projects, PR Chromium plus WebKit iPhone, nightly three engines plus Pixel |
| Lighthouse | performance 0.90, a11y 1.0, TBT at most 200 ms (stricter than the ecosystem's 0.80 warn, because the redesign removes the cause) |

## 4. Authorization matrix test (design)

`tests/integration/authz-matrix.test.ts` builds its rows from the permission table in `features/auth/domain/access.ts` (single source), runs three real users (owner, viewer, anonymous) plus a second owner and second viewer for object-id swaps, and enumerates: server actions (by AST: every `"use server"` export), route handlers (non-GET exports under `src/app/**/route.ts`), and pages under `src/app/panel/**`. A newly added route that is not in the matrix fails the build. Rows record expected status or state per role; the matrix is also rendered into `docs/reference/permissions.md` by a script (generated, never hand-edited).

## 5. Flake policy, quarantine, determinism

As ecosystem 6.3. Quarantined tests are tagged `@quarantine`, run in a non-blocking job and listed in `tests/quarantine.json` (cap 2% or 5). Determinism rules: frozen clock in fixtures, seeded fast-check (seed printed on failure), disposable databases created and dropped per run (existing fixture closes sockets before dropping), no sleeps, ports fixed (3241, 8237, 8238) with a collision check.

## 6. Ratchets and thresholds files

`quality/ratchets/{coverage,mutation,bundle,lighthouse,visual,a11y,flake}.json` hold the numbers; a PR may only raise them; `scripts/scorecard.ts` compares each CI artifact and fails on regression (`scorecard.md`).
