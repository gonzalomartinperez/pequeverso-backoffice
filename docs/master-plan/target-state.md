# Target state

Backoffice type in `ecosystem.md` section 9: pragmatic Clean Architecture; the dependency rule is mandatory and guarded; a layer that only forwards calls is ceremony and is omitted (O3). The current architecture is already close (feature folders with domain, application, adapters, presentation and an enforced guard, `audit.md` inventory). The target keeps what works and closes four gaps: an explicit composition root, a single environment module, an enforced "every action authorizes" rule, and a presentation layer rebuilt on a shared kit and split by route.

## 1. Target layout

```
src/
  app/                          routes: composition and metadata only
    ingresar/  invitacion/[token]/  api/auth/[...all]/  healthz/  readyz/  internal/v1/ops/metrics/
    panel/
      layout.tsx                requireActor + AppShell (sidebar, topbar, status strip)
      page.tsx                  Resumen
      ejecuciones/page.tsx  ejecuciones/[id]/page.tsx
      consumo/page.tsx  analitica/page.tsx  catalogo/page.tsx
      accesos/page.tsx  accesos/actions.ts  accesos/auditoria/page.tsx
      cuenta/page.tsx
      error.tsx  not-found.tsx  loading.tsx   (state components)
    __kit/page.tsx              dev and test only (notFound() in production), renders every component state
    globals.css                 tailwind import, theme import, base layer
  proxy.ts                      nonce CSP, x-request-id, optimistic redirects only
  instrumentation.ts
  server/                       server-only composition (guarded by `server-only`)
    container.ts                composition root: builds adapters and use-case deps once per process
    env.ts  env-parse.ts        the only readers of process.env (guard)
    auth.ts                     requireActor / authReady / accessDeps (the single authorization entry)
    csp.ts  fixture-safety.ts  observability.ts  observability-config.ts
  features/
    auth/        domain (roles, permission table, admission) · application (use cases, ports) · adapters (Better Auth, PostgreSQL, node secrets) · presentation (invite form, member/session/audit rows)
    operations/  domain (summary, telemetry, Metric derivation) · application (ports) · adapters (HTTP, validators) · presentation/{overview,runs,usage,catalog}
    analytics/   domain · application · adapters · presentation
  shared/
    ui/          kit primitives and composites (no feature imports)
    shell/       app-shell, sidebar, topbar, status-strip, user-menu, command-palette
    charts/      server-rendered SVG components
    tokens/      *.tokens.json, generated theme.css
    i18n/        messages/es.ts
    lib/         cn.ts, format.ts (Intl), time.ts
    illustrations/ glyphs/
migrations/  contracts/  infra/docker/  scripts/  tests/{unit,integration,browser,visual}  quality/ratchets/
```

No separate `server/dal` and `server/domain` folders (ecosystem 9 suggests them for the portfolio backoffice): here the feature `application` layer plus `server/auth.ts` already fulfil the DAL role (use cases receive injected ports and re-check the role inside the store), so a second layer would only forward calls. Recorded as a justified deviation in ADR-0010.

## 2. Dependency rules (enforced by `scripts/check-boundaries.ts` plus Biome)

1. `domain` imports nothing but its own folder and the standard library; no clock, random or process access except through injected ports (existing purity checks).
2. `application` imports `domain` and declares ports; no framework, network or IO.
3. `adapters` implement ports; validate every payload that crosses the boundary; no imports from `presentation`, `app` or `server`.
4. `presentation` imports its own `domain`, `shared/*` and type-only declarations from its own `application`; never `adapters` and never runtime `application`.
5. `server/*` composes adapters and use cases and is the only place where `process.env` is read (through `env.ts`); `server-only` marker on every file.
6. `app/*` is routes and composition; it may import `server`, `features/*/presentation`, `shared/*`.
7. `shared/*` imports nothing from `features`, `server` or `app`; `shared/ui` imports no `shared/shell`.
8. Client reachability: a file with `"use client"` may not reach `server/*`, `adapters`, `migrations` or private resources (existing transitive check).
9. New (M4): every `"use server"` export and every non-GET route handler starts with a call to `requireActor` or is on an explicit allowlist (`api/auth`, `invitacion/[token]`, `healthz`, `readyz`, metrics with its own bearer); enforced by an AST test that fails when an export is missing from the authz matrix (`testing.md`).
10. New (M4): presentation files over 250 lines fail lint; cycles fail (`noImportCycles`); undeclared dependencies fail (`noUndeclaredDependencies`); knip reports zero unused files, exports and dependencies.

Guard policy: keep the custom guard (stronger than Biome: client reachability, purity, syntax-error fail-closed) and add Biome rules as a second layer. Negative fixtures stay and grow with each new rule. `@typescript/typescript6` stays as a dev dependency for the compiler API only until TypeScript 7.1 exposes it, then the guard migrates and the dependency is removed (ADR-0010, risk R3).

## 3. Server and client boundary

| Concern | Rule |
|---|---|
| Rendering | All panel routes are dynamic server components; the shell streams, panels are `Suspense` boundaries with matching skeletons |
| Client components | Only where interaction requires them: sidebar rail toggle, command palette, peek sheet focus handling, copy button, sort and filter chips (links with query string, no state), invite form, confirm dialog, theme and density switch. Target: at most 12 client files |
| Charts | Server-rendered SVG; no client chart library |
| Data | Reads only through the container; no client-side fetch of private data; the API bearer never reaches the browser |
| Caching | No `use cache` and no `unstable_cache`: the ops reading must be fresh per request and per user (existing contract), and there are one or two users; recorded in ADR-0011. Revisit only with tenant-agnostic data and a measured need |
| Preferences | Theme, density and time zone in cookies read in the root layout (no inline `matchMedia` script, no flash) |
| Request id | `proxy.ts` creates or accepts a sanitized `x-request-id`, forwards it to the API call and to logs and spans (`observability.ts`), returns it on error pages |
| Headers | Unchanged CSP policy (nonce, `strict-dynamic`, `frame-ancestors 'none'`, `no-store`, `noindex`), snapshot-tested |

## 4. Domain additions (small)

- `Metric` tagged value in `features/operations/domain/summary.ts`: `ok | empty | unavailable | stale | withheld | error` with the derivation functions the UI needs (success rate, remaining budget, price expiry, projection with the 7-point rule, stamp status, margin-note text). Pure, property-tested, mutation scope.
- Access: use cases `listAudit` (cursor), `listSessions`, `revokeSession`, `revokeOtherSessions`; ports extended; the PostgreSQL store reads sessions from the Better Auth table (IP reduced to a prefix, user agent summarized) and resolves audit names by live join. No schema change is required (migrations stay append-only; an index on `backoffice_access_audit (at, id)` may be added by a new `0003` file if the cursor query needs it, measured first).
- Selection (analytics) serialize and parse shared with URL-synced filters.

## 5. TypeScript and typing policy

Applies `ecosystem.md` 10.1. Current state: strict TypeScript 7.0.2 as `tsc` in a separate job; Biome 2.5.15 pinned; **no `.js`, `.mjs` or `.cjs` file is tracked** (verified at origin/develop: `file-index.csv`), configuration is `next.config.ts`, `playwright.config.ts`, `postcss.config.json`, `biome.json`, `tsconfig.json`. Destination table for every script-like file:

| File | Destination |
|---|---|
| `next.config.ts`, `playwright.config.ts` | stay `.ts` (default exports allowed for framework config files) |
| `postcss.config.json` | stays JSON (preferred over `.mjs`) |
| `scripts/*.ts`, `scripts/dependabot/*.ts` | stay `.ts`, run by Node type stripping (Node 24.12 or later) |
| `scripts/*.sh` (2) | stay shell: they drive `docker` and must not need Node; shellcheck added to the workflow profile |
| Any future `.js/.mjs/.cjs` | forbidden by a file-extension test unless listed with a reason in `quality/js-exceptions.json` (empty) |

Compiler flags to add in M4 (per-repo opt-out only with a comment): `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noImplicitOverride`, `typedRoutes`, Node subpath `imports` (`#shared/*`) instead of `paths`, explicit `types`. No `enum`, `namespace`, parameter properties or decorators (erasable only); `undefined` internally, `null` only at I/O boundaries (validators); kebab-case file names (the current names already comply); no barrel files outside `shared/ui/index.ts` public API of the kit.

## 6. ADRs to write (MADR 4, `docs/decisions/`, each with a Confirmation section)

Existing 0001-0007 move from `docs/adr/` (see `file-moves.md`); 0001, 0003 and 0004 are marked superseded history.

| ADR | Title | Confirmation |
|---|---|---|
| 0008 | Adopt the ecosystem standard and the master-plan deviations (health path `/healthz`, feature-folder layout) | `standards.lock` drift check |
| 0009 | Atelier identity and shared six-destination view standard | `check-tokens.ts`, identity test, kit lock |
| 0010 | Composition root, no separate DAL layer, guard policy and TypeScript 7.1 migration of the guard | guard run plus negative fixtures |
| 0011 | No server cache for operations reads | test that the ops adapter is called per request |
| 0012 | Owned SVG charts replace Recharts | `check-bundle.ts` budget, no `recharts` in `package.json` |
| 0013 | No UI kit dependency (native `<dialog>`, Popover, owned hooks) | dependency allow-list test |
| 0014 | Dependabot weekly single PR and the read-only `pull_request_target` policy exception | `deps-weekly-guard` run, zizmor ignore reason |
| 0015 | Release flow: release-please on develop, GHCR private image, attestations, immutable releases | release dry run |
| 0016 | Run detail without per-stage spans until the API contract adds them | contract test pins the absence |
| 0017 | Audit names by live join; session listing privacy (IP prefix) | integration tests |
| 0018 | Test runner decision (spike S1): one runner for the four TypeScript repos, Vitest 4 if StrykerJS works with TS 7, otherwise `node:test` with `tap-runner` (PVB-D20, DR-09) | spike report |
| 0019 | Node 26 move (E10) | CI matrix result |

## 7. Migration order (each step a short task branch, PR into develop, green `ci-gate`)

1. M1: CI profiles, containers, supply chain, harness (no product code).
2. M2: tests and tooling (coverage merge, matrix, properties, mutation, visual infrastructure, scorecard).
3. M3: P1 fixes and docs (small targeted product edits only).
4. M4: `server/container.ts`, `env.ts`, authz-export guard, Biome rules, knip, compiler flags, messages dictionary extraction, split `dashboard.tsx` into route modules **without changing the look**, `shared/` layout, new IAM use cases behind existing UI, `x-request-id`, health versions. This makes M5 a presentation-only change.
5. M5: tokens, kit, shell, six destinations, charts, states, illustrations, baselines, evaluator.
6. M6-M7: thresholds, re-score, release.

Contract changes (expand then contract, ecosystem 3.3): none required to ship M5. Optional expand request to `pequeverso-assistant-api`: per-run stage spans in `recent` (PVB-D5). Consumers never import code from the API repo; the pins in `contracts/*/source.json` move only through `contract` profile PRs with SHA-256.
