# Audit: measured baseline (2026-11-09)

Subject: `gonzalomartinperez/pequeverso-backoffice` (public; default branch `main`; integration branch `develop`), local checkout `pequeverso-assistant-backoffice`, read at `origin/develop` **4d4fb96** (merge of PR #90). The local `develop` is far behind origin and was not used. All measurements were taken on 2026-11-09 by the audit harness; the raw logs are copied under `audit/` in this folder (`audit/SUMMARY.md`, `audit/timings.txt`, `audit/unit-coverage.log`, `audit/test-db.log`, `audit/axe-results.json`, `audit/trivy-config.txt`, `audit/lighthouse-summary.json`, four screenshots in `audit/screens/`). No existing master plan.

## 1. Numbers

| Metric | Value | Evidence |
|---|---|---|
| Tracked files at origin/develop | 268 (67 are PNG evidence images, 65 of them under `docs/verification/`, 0 are `.js/.mjs/.cjs`) | `file-index.csv` |
| Source lines (src) | 5,960 lines in 65 files; largest `dashboard.tsx` 647, `better-auth.ts` 271, `validate.ts` (ops) 288, `countries.ts` 256 | `file-index.csv` |
| `npm ci` | 188 s | `audit/timings.txt`, `audit/SUMMARY.md` |
| Lint (Biome) | 0 errors, 0.9 s | `audit/lint.log` |
| Typecheck (TypeScript 7.0.2) | 0 errors, about 5 s | `audit/typecheck.log` |
| Unit tests (`node --test`) | **159/159 pass**, 13.2 s | `audit/unit-coverage.log` |
| Coverage (node built-in) | lines **88.7**, branches **88.8**, functions **81.2** | `audit/unit-coverage.log` |
| Low-coverage files | `postgres-access-store.ts` 32.9 lines (exercised by the integration suite, which is not merged into this number); `format.ts` 67.7; `sections.tsx` 84.1 | `audit/unit-coverage.log` |
| Database tests (`test:db`) | **19/19 pass**, 0 schema drift, PostgreSQL 18.4 in the audit run (CI pins 18.6) | `audit/test-db.log` |
| Architecture guard | passes, empty baseline, negative fixtures present (`tests/unit/boundaries.test.ts`, 422 lines) | `audit/boundaries.log` |
| Docs and skills checks | docs: 141 local links, 0 missing; skills pass; public-file scan 193 files, 0 findings | `audit/docs-check.log`, `audit/skills-check.log`, `audit/security-check.log` |
| Build (`next build --webpack`) | 178 s (161-178 s over runs), 12 dynamic routes, no static route | `audit/build.log` |
| axe (24 page x theme x width captures) | **0 violations** | `audit/axe-results.json` |
| Horizontal overflow | **`/panel/accesos` at 390 px (light)**; none at 768 and 1440 in the captured set; e-mail wraps one character per line in the members table | `audit/axe-results.json`, `audit/screens/access-390-light.png` |
| Clipped table | Dashboard daily table cut after "Interrumpidas" at 1440 px | `audit/screens/dashboard-1440-light.png` |
| Lighthouse (n=1, desktop/mobile) | sign-in performance 0.98 / 0.78; dashboard 0.78 / **0.70**; accessibility 1.00; best practices 1.00; SEO 0.63 (noindex by design) | `audit/lighthouse-summary.json` |
| Dashboard mobile | LCP 2.12 s, **TBT 2,966 ms**, CLS 0, bootup 3.77 s, total transfer 389 KB; sign-in mobile TBT 1,025 ms | `audit/lighthouse-summary.json` |
| Chart library | Recharts 3.10.1, **391 KB** of client JavaScript | owner-reported measure; `package.json` |
| trivy config | app Dockerfile: 0 findings; postgres Dockerfile: DS-0026 LOW, no HEALTHCHECK | `audit/trivy-config.txt` |
| OpenTelemetry | present: isolated manual provider, optional OTLP traces, private metrics endpoint with a distinct bearer | `src/server/observability.ts`, `docs/reference/observability.md` after move |
| CI | 7 jobs in `quality.yml`, aggregate context "Required checks", SHA-pinned actions, `permissions: {}`, actionlint 1.7.12 and zizmor 1.30.1, gitleaks full history, PostgreSQL 18.6 service, image smoke, 3-engine browser suite | `.github/workflows/quality.yml` |
| Browser suite | 3 spec files (60 + 538 + 35 lines), 54 test IDs, 4 projects (Chromium, Firefox, WebKit, Pixel 7 for `@mobile`), `retries: 1` in CI, 1 worker | `playwright.config.ts`, `docs/ci.md` |
| Fake identity provider | `scripts/fake-idp.ts` drives a real Better Auth callback; click-through sign-in; refused in production (`AUTH_TEST_ISSUER`) | owner decision: keep |
| Docker image build | not possible on the audit machine (buildx missing); CI builds it | `audit/docker-build-time.txt` |
| Release workflow, SBOM, provenance, image scan | none | no such files at origin/develop |
| Image publication | none ("Not published yet", deployment contract) | `docs/deployment-contract.md` |

Harness anomaly to resolve in M0: `audit/timings.txt` records `security-check rc=1` and `docs-check rc=1`, while the same logs show clean results ("0 findings", "0 missing"). Treated as a harness artifact (exit code of a `tee` pipeline), to be confirmed by re-running both scripts directly.

## 2. Findings

Priority meaning: P0 blocks safe operation or a release, P1 fails a rubric critical criterion or hurts the owner daily, P2 is debt. There is **no P0**: no committed secret was found, access control tests pass against a real PostgreSQL, CSP is nonce-based.

### P1

| ID | Finding | Evidence | Rubric axis | Planned fix |
|---|---|---|---|---|
| A-P1-1 | `/panel/accesos` overflows at 390 px; the e-mail column wraps per character | `audit/axe-results.json`, `audit/screens/access-390-light.png` | P4, P3 (1.4.10 reflow) | M3 targeted fix to the table region, then M5 stacked `MemberRow`; no-overflow gate at 320/390/768/1440 |
| A-P1-2 | Daily table clipped at 1440 px inside a half-width card | `audit/screens/dashboard-1440-light.png` | P4, P6 | M3 scroll region with edge cue; M5 full-width `DataTable` |
| A-P1-3 | Dashboard mobile TBT 2,966 ms and performance 0.70, attributed to 391 KB of Recharts (owner-reported, not yet measured: `check-bundle.ts` records it in M2.8); even sign-in mobile, which has no charts, has TBT 1,025 ms, so charts are not the whole cause | `audit/lighthouse-summary.json` | D6 | M2.12 Lighthouse and performance trace diagnosis of sign-in; M3 interim lazy-load below the fold; M5 server-rendered SVG; budgets enforced (see `ci-cd.md`) |
| A-P1-4 | No image scan, SBOM, provenance or release workflow; image never published, so "deploy by digest" in the deployment contract has nothing to deploy | `.github/workflows/`, `docs/deployment-contract.md` | D4, D5 | M1 build, scan, SBOM, attest in CI; M7 publish to GHCR on release |
| A-P1-5 | CI is not dynamic and builds twice (job-local builds), PR critical path is dominated by the 3-engine browser job (51 tests, 274 s locally); required context is "Required checks", not `ci-gate` | `quality.yml`, `docs/ci.md` | D4 | M1 profiles, `classify`, `ci-gate` (two-step ruleset change) |
| A-P1-6 | `dependabot.yml` violates the owner rule: three separate ecosystems with limits 5/3/2, a patch-only group, 06:00, docker without day or time | `.github/dependabot.yml`; 8 Dependabot branches exist on origin | D4 | M1 single multi-ecosystem group and guard |
| A-P1-7 | No mutation testing, no diff coverage, no merged coverage; the access store shows 32.9% in the unit report | `audit/unit-coverage.log` | D3 | M2 |
| A-P1-8 | No threat model; no test enumerating mutating routes and server actions; no CSRF test for server actions (only the OAuth callback and cross-origin cookie tests exist); no regression tests named per better-auth advisory | `tests/integration/auth.test.ts` (18 tests) | D5, D3 | M2 |
| A-P1-9 | Information architecture: one stacked page (about 3,839 px at 1440 px, seven cards), marketing-style header, four jump chips as navigation | `audit/screens/dashboard-1440-light.png` | P6, operator lens | M5 shell and six destinations |

### P2

| ID | Finding | Evidence |
|---|---|---|
| A-P2-1 | Postgres Dockerfile has no HEALTHCHECK (trivy DS-0026) | `audit/trivy-config.txt` |
| A-P2-2 | Chart palette: failed = navy vs completed = teal; danger text uses the store's coral | `src/app/globals.css` |
| A-P2-3 | No CodeQL, Scorecard, dependency-review, osv/Grype jobs, daily vulnerability job | workflows |
| A-P2-4 | No `x-request-id` creation or propagation anywhere in `src`; `/readyz` has no `version`/`schema_version`; `/healthz` has no `version` | `git grep` on origin/develop, `src/app/*` |
| A-P2-5 | README is a dated changelog plus a 14-row screenshot gallery; ADRs under `docs/adr/` (ecosystem path is `docs/decisions/`); no CODEOWNERS, SUPPORT, CODE_OF_CONDUCT, issue forms | `README.md`, `.github/` |
| A-P2-6 | 65 PNG evidence files plus 9 manifests, receipts and READMEs (74 files, all deleted at M3) in `docs/verification/**` for the pre-redesign UI, and 3 further files there move as history (77 tracked in all, `file-moves.md`) | `file-index.csv` |
| A-P2-7 | Skills canonical in `.claude/skills` with `.agents/skills` links (ecosystem says the reverse); no `evals/triggers.json` | `AGENTS.md`, `docs/agent-skills.md` |
| A-P2-8 | Container: Node 24.22.0 (ecosystem target is Node 26 after a two-week matrix); `npm ci` without `--ignore-scripts`; no `SOURCE_DATE_EPOCH`; app image has no revision label or build-info | `infra/docker/app/Dockerfile` |
| A-P2-9 | No theme toggle, density, palette, time-range control (design gaps, see `design-playbook.md`) | `src/app/layout.tsx` |
| A-P2-10 | `dependency-policy.yml` uses `pull_request_target`; justified (default-branch code only, PR head never checked out) and zizmor-ignored with a reason, but it is the one trigger the standard normally forbids, so it needs an ADR | `.github/workflows/dependency-policy.yml` |
| A-P2-11 | Stale local branch `chore/resume-backoffice-quality` (2 commits) | decided in `file-moves.md`, PVB-D1 |
| A-P2-12 | The guard needs `@typescript/typescript6` (compiler API) until TypeScript 7.1; it is a dev dependency for the guard only, not a type checker, so EX-PVBO-05 (TypeScript 7 is the only type checker) holds | `package.json`, `docs/explanation/architecture.md` |

Not findings (kept on purpose): SEO 63 (private, noindex by header and meta), fake IdP, public repo with private application, API-owned production database topology, three-engine browser matrix, CSP with per-request nonce, architecture guard with negative fixtures.

## 3. Component and flow inventory

| Area | Contents |
|---|---|
| Routes (12, all dynamic) | `/` (redirect), `/ingresar`, `/invitacion/[token]` (route handler), `/panel`, `/panel/accesos` (owner), `/panel/analitica`, `/panel/cuenta`, `/api/auth/[...all]`, `/healthz`, `/readyz`, `/internal/v1/ops/metrics`, `/_not-found` |
| Server actions | 3, all in `src/app/panel/accesos/actions.ts`: invite, revoke invitation, remove member; each starts with `requireActor("manage_access")` |
| Features | `auth` (domain, application with ports, Better Auth and PostgreSQL adapters, presentation), `operations` (domain, ports, HTTP adapters with runtime validators, presentation), `analytics` (same shape) |
| Contracts (pinned, SHA-256) | `contracts/ops` summary 1.2, `contracts/telemetry` 1.0, `contracts/analytics` report; producer revision `b7dcb0c2...` for ops |
| Data | PostgreSQL IAM: `auth_*` tables, `backoffice_invitation`, `backoffice_access_audit` (ids only), 2 migrations, append-only |
| Edge | `proxy.ts` nonce CSP, `frame-ancestors 'none'`, `no-store`, `noindex`, HSTS when https |
| Observability | Isolated manual OpenTelemetry provider (no global registration), optional OTLP traces, private metrics endpoint with a distinct bearer, alert and dashboard files for `vps-ops` |
| UI primitives (6) | `badge`, `brand-mark`, `button`, `callout`, `cn`, `sections` plus three presentation files over 150 lines |
| Flows | OAuth sign-in (Google, GitHub, fake IdP in tests), owner admission by configuration, invited admission by single-use token bound to the verified e-mail, revocation by deleting the account, owner reads private ops summary, optional telemetry, optional audience report |
| Scripts (15) | stack, fake IdP, mock ops, DB check and migrate, checkers (boundaries, docs, skills, public files), smoke scripts, Dependabot policy |

## 4. What could not be measured

- Docker image build, size and runtime behaviour on the audit machine (buildx missing); CI is the source of truth until M1 adds a measured image job.
- Lighthouse numbers are n=1; the plan requires 5 runs with the median.
- Field metrics (RUM) and real browsers on devices: none exist; the app is private and undeployed.
- Mutation score, flake rate over 30 days, diff coverage, complexity per function, dead-code (knip): no tooling yet; baselines are created in M2 and recorded in `progress.md`.
- Real OAuth with Google and GitHub, TLS cookies, VPS capacity, provider billing, live API reading: Phase V (MV).
- Screen-reader behaviour (VoiceOver, NVDA): no manual pass recorded.
- Light-versus-dark parity: both themes are axe-clean, but no per-theme visual or contrast measurement exists yet.
