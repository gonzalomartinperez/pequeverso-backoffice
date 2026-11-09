# Standards

Applies `ecosystem.md` sections 9, 10 and 14. This file records the style choices that matter here and the justified deviations; everything not listed follows the ecosystem standard unchanged.

## 1. Code style (TypeScript, section 10.1)

| Topic | This repo |
|---|---|
| Semantics | Google TypeScript Style Guide; Biome 2.5.15 formatter (2 spaces, 100 columns, double quotes, semicolons: matches `biome.json` today) |
| Compiler | TypeScript 7 `tsc` as a separate hard gate; add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noImplicitOverride`, `typedRoutes`, subpath `imports` in M4 |
| Lint | Biome recommended plus `noRestrictedImports`, `noPrivateImports`, `noImportCycles`, `noUndeclaredDependencies`, domains `next`, `react`, `test`, `project`; current overrides (`noNonNullAssertion`, `useImportType`, `noExplicitAny` as errors) kept; no typescript-eslint |
| Naming | kebab-case files and folders (already true), PascalCase only for exported components, types, classes; framework names as is; tests `*.test.ts` in `tests/` (this repo keeps tests out of `src`; accepted deviation, the guard test classifies `tests/` separately) |
| Language rules | No `enum`, `namespace`, parameter properties, decorators; default exports only for framework entry files and `*.config.ts`; `undefined` internally, `null` only in validators and database rows; no barrels except the kit's public index |
| Complexity | At most 10 per function, ratcheted (`quality/ratchets/complexity.json` records today's count in M2) |
| Docs in code | TSDoc on exported symbols; comments explain why |
| Colour, spacing, type | No literals outside tokens (`check-literals.ts`) |

Enforcement: one command, `npm run check` (lint, typecheck, unit, guard, knip, docs, skills, public-file scan, build), equals the CI static job and the pre-commit hook; `AGENTS.md` lists the same commands and a test compares backticked commands in it with `package.json` scripts. A ratchet file records violation counts that may only go down; a rule change needs an ADR and an ecosystem version bump.

## 2. Deviations from the ecosystem standard (each has a reason and a confirmation)

| # | Deviation | Reason | Confirmation |
|---|---|---|---|
| S-1 | Health endpoints `/healthz` and `/readyz` instead of `/api/health` | Existing deployment contract with `vps-ops`, proxy matcher, smoke script; the fields required by section 8.5 are added | contract test; ADR-0008 |
| S-2 | Feature-folder layout with application ports and `server/container.ts`, no separate `server/dal` and `server/domain` | The application layer already plays the DAL role with the role re-check inside the store | guard plus authz-export test; ADR-0010 |
| S-3 | Test runner decided by one spike for all four TypeScript repos (DR-09); `node:test` today | Fast, dependency-free suite of 159 tests; spike S1 decides Vitest 4 or `node:test` + `tap-runner` for all four | ADR-0018 |
| S-4 | Tests live in `tests/`, not next to the unit | Four test kinds (unit, integration, browser, visual) share fixtures and the guard classifies them | `boundaries.test.ts` |
| S-5 | `pull_request_target` in `dependency-policy.yml` | Read-only assessment from default-branch code; the PR head is never checked out | zizmor ignore reason, ADR-0014 |
| S-6 | `@axe-core/playwright` is MPL-2.0 | Dev-only test tool, not distributed | `quality/licence-exceptions.json` |
| S-7 | `ADR` path moves from `docs/adr/` to `docs/decisions/` once | Ecosystem 14.2 path; "paths stay stable" applies after the move; a pointer line is left in `docs/README.md` | `docs:check` |
| S-8 | Spanish owner-facing UI strings in product code | Product copy, not documentation: allowed by the language policy (14.2); all strings in `messages/es.ts` | dictionary test |
| S-9 | Lens 3 (operator) defined in this repo | Rubric assigns no third lens to a backoffice | PVB-D12, `scorecard.md` |

## 3. Security and runtime conventions kept from the repo

Access only through Better Auth OAuth (no passwords, no public sign-up, no domain-based admission, no implicit linking); every page and server action re-checks the role server-side with `requireActor`; no credentials, sessions or tokens in `localStorage`, URLs (except the one-time invitation link) or logs; operations data only from the pinned private API contracts, validated at the adapter boundary, missing values shown as "No disponible", fixture data labelled synthetic; schema changes are new append-only files in `migrations/`; paid model calls, production actions, DNS and storefront changes need separate explicit owner authority. These are unchanged invariants of `AGENTS.md` and of ecosystem section 1.4.

## 4. Review and delivery

Review chain per `ecosystem.md` 15.2 (author agent, gates, independent reviewer, Codex second opinion as advisory, architecture review for structural PRs, strongest agents for auth and migrations). Definition of done: gates green with evidence, tests at the right layer, docs, ADR, changelog and AGENTS.md or skills updated in the same PR, ratchets only tightened, no new lint suppression without an issue, scorecard shows no regression. Merge: `gh pr checks --watch && gh pr merge`, never chained with `;`, never `--admin`. GitHub identity: `gonzalomartinperez` only.

## 5. Adopted by default (ecosystem 2.4: "if I forgot something, adopt it") mapped to this repo

| Area | Item | Status here and plan |
|---|---|---|
| Security surface | CSP with nonces and HSTS on every web app | Present (nonce CSP, `strict-dynamic`, HSTS when the origin is https); snapshot test in M2 |
| Security surface | `security.txt` on public domains | Not applicable: private app, noindex, no public domain; `SECURITY.md` carries the reporting path |
| Security surface | Rate limiting on public endpoints | Sign-in attempts are limited with database counters (tested); the app has no other public write endpoint; metrics endpoint needs a bearer |
| Security surface | Security headers snapshot, threat model per auth surface | M2 snapshot test; threat model file in M3 (`docs-and-community.md` section 2) |
| Privacy and legal | Privacy policy, consent, terms, accessibility statement page | Not applicable to a private admin tool without visitors; the data inventory exists (`deployment-contract.md` data classification) and gains a retention schedule (PVB-D15); no PII in logs is a test |
| Domains and email | DNS, SPF, DKIM, DMARC, TLS expiry | The app sends no e-mail (invitations are copied links); DNS and TLS are `vps-ops` and MV; redirects not applicable |
| Reliability | Error tracking, uptime probes, SLOs, incident runbook | OTel exists; GlitchTip or equivalent, Uptime Kuma probes, SLOs and alert routing are MV in `vps-ops`; this repo ships `observability/*` and a post-incident template link |
| Cost | Monthly cost ledger, LLM spend caps | The app makes no model calls and has no spend; it displays the API's spend and budget (honesty rules); hosting cost is `vps-ops` |
| Release hygiene | SemVer and releases, stale branch cleanup, labels and templates, repository settings by script | release-please (M1), stale local branches listed (PVB-D1 and `file-moves.md`), issue forms and labels (M1), settings applied by the standards script (M1.3) |
| Internationalization | `Intl`, locale-aware formats, `lang`, completeness checks | `Intl` everywhere with explicit time zone (M4.5), `lang="es"`; single language, so no completeness check; dictionary test instead |
| Content integrity | Commercial facts single-sourced | No commercial facts here; all operational numbers come from the pinned contracts and are validated; tests forbid invented values |
| Developer experience | One-command setup, devcontainer, `check` mirror, inner loop under 60 s | `npm run setup` and `.devcontainer/` (M1.11), `npm run check` mirrors CI, new `npm run check:fast` (lint, types, unit, guard; about 20 s today) |
| Knowledge | GLOSSARY.md, diagrams kept in sync, onboarding page | `docs/GLOSSARY.md` (ejecución, corte de seguridad, primer texto, reservado ... with the English term), diagram freshness check, `docs/tutorials/first-run.md` |
| Data protection | Backups with restore drills, encryption at rest, secrets rotation schedule | Restore drill script exists (`smoke-postgres.sh`), the real drill is MV; secrets rotation schedule in `how-to/rotate-secrets.md` (quarterly: `BETTER_AUTH_SECRET`, OAuth client secrets, `OPS_READ_TOKEN`, `OBSERVABILITY_READ_TOKEN`; rotation order documented) |
| Analytics | Consent-aware analytics, shared event taxonomy | The backoffice emits no events and collects nothing; it only reads the site-activity report whose taxonomy is owned by the site and the API; web-vitals RUM for the backoffice is an owner decision at MV |
