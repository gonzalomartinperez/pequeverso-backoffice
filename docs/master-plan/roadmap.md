# Roadmap (M0 to M7, MV)

Milestones are the ecosystem safe points of `ecosystem.md` section 3A: a milestone is reached only when `develop` is green on the full `release` CI profile, `progress.md` is updated, the annotated tag `checkpoint/M<n>` is pushed on `develop` and the ecosystem tracker row is recorded. Phases: **A** polish (M1-M3), **B** architecture and TypeScript (M4), **C** end state and master design (M5-M7), **V** VPS-gated (MV). Effort is S (up to 4 agent hours), M (4 to 12), L (12 to 40); agents work in parallel, so wall-clock is shorter than the sum. Every item is a short task branch, one PR into `develop`, green `ci-gate`, review chain of `skills.md` section 6. Items marked **[E1]** depend on the `engineering-standards` repository (owner decision E1); fallback is vendoring templates from this plan. Items marked **[owner]** need an owner-only action.

Slicing rule (ecosystem 15A): every checklist item below is delivered as one or more PRs of at most 400 changed lines (generated files and snapshots excluded), branch `<type>/<milestone>-<slug>`; moves separate from behaviour changes; a task failing CI or review three times is parked with a diagnosis note. Estimated totals (each header equals the sum of its item hours): M0 4 h, M1 70 h, M2 81 h, M3 32 h, M4 63 h, M5 150 h, M6 34 h, M7 12 h, M8 2 h; **448 agent hours in total** (MV is gated and not estimated). **Critical path** (hours that cannot overlap): M0 (4) then M1.2 (12), M1.3 (1), M2.2 (12), M4.1 (8), M4.4 (12), M5.1 (24), M5.2 (16), M5.3 (24), M5.7 (12), M5.8 (12), M5.10 (10), M6.3 (6) and M7 (12) = **165 h**. With up to three parallel agent streams (platform and CI, quality and tests, design) the wall-clock is about **5 to 7 calendar weeks** (165 h at roughly 6 productive agent hours per day is 5.5 weeks, plus review waits; owner waits at M1.3, M5.8 and M7.1 are not counted); the design stream M5 is the long pole.

**Task table columns.** Every task has a stable ID (`M<n>.<k>`, never renumbered or reused), a size and agent hours, and a Status: `todo`, `in-progress`, or `done (PR #<n>, <merge SHA>)`. Status is changed in the same PR that completes the task (or in the follow-up docs PR of the milestone) and mirrored in `progress.md` section "In-flight tasks". Every task PR title ends with `[M<n>.<k>]` and the merge commit message carries `Task: M<n>.<k>`, so history can be searched by ID.

**RESUME (find the true next task, even mid-milestone).** Do not trust the Status column alone; check git: `git log --oneline origin/develop --grep '\[M[0-9]*\.[0-9]*\]'` lists the finished task IDs, `gh pr list --state all --search '[M2.' --json number,title,state` shows open and merged task PRs for a milestone (replace `M2.`), and the next task is the first `todo` row of the lowest unfinished milestone whose dependencies are done. If a row says `in-progress` with no open PR and no branch, reset it to `todo`.

## M0: Plans merged (4 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M0.1 | S, 1.5 | done (PR #101, 275dd45) | Docs-only PR adding `docs/master-plan/` (this folder, including `research/` and `audit/`) to `develop`. Acceptance: `docs` profile green; links valid; `progress.md` at M0 with the develop SHA at merge time. |
| M0.2 | S, 0.5 | todo | Open decisions PVB-D1 to D15 are resolved by delegation (recorded in `README.md` section 6); the three owner inputs left are the M5 taste checkpoint (PVB-D9, D10), PVB-D14 owner-only repository settings, and real OAuth apps and secrets at MV (listed identically in `README.md` section 6, `RESUME.md` section 6 and `progress.md`). |
| M0.3 | S, 0.5 | todo | Local hygiene: `git switch develop && git pull --ff-only` on the checkout after confirming a clean tree; note stale local branches. **[owner]** OK to delete `chore/resume-backoffice-quality` (PVB-D1, SHAs recorded first). |
| M0.4 | S, 1 | todo | Re-run `security:check` and `docs:check` directly to resolve the `rc=1` entries in the audit timings (`audit.md` harness anomaly). |
| M0.5 | S, 0.5 | todo | Tag `archive/verification-2026-10` at the current develop SHA (preserves the evidence images before M3 deletes them). |

Risks: plan drift before M1 (develop moves); mitigation: the plan records SHA 4d4fb96 and re-checks `file-index.csv` against `git ls-tree` in M1 (script `scripts/check-file-index.ts`, kept until M7).

## M1: Foundation (Phase A, 70 h)

Dependencies: E1 for shared workflows (fallback: vendored workflows, see `RESUME.md` section 4a); owner for rulesets and repository settings. **M1 minimum viable subset** (enough to start M2 and M3 in parallel): M1.1 (or its vendored fallback), M1.2, M1.3, M1.8; the other M1 items run in parallel with M2 and M3 and are all required for the M1 exit tag.

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M1.1 | M, 5 | done (PR #112, 68403b1) | **[E1]** `standards.lock` and the drift check; copy `ecosystem.md` and `rubrics.md` stamp check. Acceptance: `drift` job green (including the vendored-fallback drift job when E1 is not yet available); a negative fixture (edited stamped file) fails the check; `standards.lock` hash matches the source SHA. |
| M1.2 | L, 12 | done (PR #115, 3483805) | `ci.yml` with `classify`, profiles from `ci-profile.json`, build once, `ci-gate`; `tests/unit/ci-profile.test.ts` rewritten (every tracked file in some profile). Acceptance: PR p50 at or below 6 min on a typical code PR, docs-only PR at or below 2 min; `ci-gate` fails on a cancelled needed job (unit test of the gate script). |
| M1.3 | S, 1 | parked [owner]: ruleset swap; both contexts green since PR #115 | **[owner]** Ruleset step: add `ci-gate` as required, then retire "Required checks" (never a gap). Acceptance: both contexts green on one PR before the swap. |
| M1.4 | M, 5 | done (PR #113, 87dc4df; group policy in PR #112); owner: delete orphaned branch, sandbox proof in engineering-standards ADR 0002 | Dependabot single weekly group, `deps-weekly-guard`; close the eight stale per-dependency branches by merging or superseding in one PR. Acceptance: sandbox proof of the four unverified behaviours recorded in ADR-0014 (E2), or the supersede flow adopted; at most one open Dependabot PR observed or simulated. **[owner]** disable Dependabot security-update PRs in settings. |
| M1.5 | L, 12 | in-progress (PRs #106 fa4d253, #110 79fc3d1): reproducible-digest check and recorded trivy config run open | Containers: add `HEALTHCHECK` to the Postgres fixture (clears DS-0026), app Dockerfile `ARG SERVICE_REVISION` and `ARG VERSION` (both declared in the runtime stage, `ci-cd.md` section 8), labels, `npm ci --ignore-scripts`, `SOURCE_DATE_EPOCH`; `docker-bake.hcl`; hadolint, dockle, container-structure-test, Grype, Syft SBOM artifact jobs. Acceptance: trivy config 0 findings on both Dockerfiles; image gates green; SBOM artifact produced; image digest reproducible across two builds of the same SHA (documented tolerance). |
| M1.6 | S, 2 | done (PR #107, 845e16f): trial until 2026-11-28 (ADR 008) | Node 24 and 26 CI matrix started (E10); decision at the end of the two weeks (ADR-0019). |
| M1.7 | M, 6 | in-progress (PRs #113, #115): owner settings (CodeQL, secret scanning, push protection) and post-activation runs open | Security workflows: CodeQL default setup, Scorecard weekly, `dependency-review-action`, osv daily job and compromised-actions watch, harden-runner audit mode; verify secret scanning and push protection on. Acceptance: first Scorecard run recorded as baseline; daily job opens a test issue in a dry run. |
| M1.8 | M, 5 | done (PR #108, 47211de; PR #118, 5d980ca) | Biome import rules, knip, `npm run check` as the single command; AGENTS.md rewritten to the skeleton with a command-equality test. |
| M1.9 | M, 6 | done (PR #109, ff24e3e; PR #116, 94430b5): web and repo-specific skills follow | Skills layout: layout flip (canonical `.agents/skills`), validator and tests updated first, then files moved; merge the three existing skills into the catalog set of `skills.md`. Acceptance: `check-skills` green with symlink checks. |
| M1.9b | M, 6 | done (PR #117, 9727acc): agent-review.yml needs a paid token (owner) | Skill evals and harness (after M1.9): `evals/triggers.json` and `evals/evals.json` skeletons; harness files of `skills.md` section 5 (`.claude/settings.json`, hooks, agents including `designer-evaluator`, `.codex/config.toml`, `.mcp.json`, `.worktreeinclude`, `agent-review.yml`). Acceptance: eval checks green; hooks block a forced push and a read of `.env.local` in a dry run. |
| M1.10 | M, 4 | done (PR #114, ae26599; community files PR #112): App grant (owner) | Release scaffolding: release-please manifest config on `develop`, `.github/` community files (CODEOWNERS, SUPPORT, CoC, issue forms, PR template) from the templates. **[owner]** GitHub App or PAT for release-please (scope grant). |
| M1.11 | M, 5 | done (PR #111, c554b16): settings script run is owner | Adopted-by-default items of ecosystem 2.4 that apply (`standards.md` section 5): `npm run setup`, `.devcontainer/`, `npm run check:fast` (under 60 s), `docs/GLOSSARY.md`, repository settings applied by the standards script. Acceptance: fresh clone to green `check:fast` with one command. |
| M1.12 | S, 1 | done (PR #104, ec0c3ea) | OD-53 old-domain sweep: check `SECURITY.md`, README, docs, fixtures and mock data for any `digitalproductsteam.com` address and replace it with the pequeverso.com contact; add a grep test that fails on any remaining reference (S 1). Acceptance: no match in the repo; test green with a negative fixture. |

Milestone exit: every repo on shared CI v1 per ecosystem; this repo's `release` profile green on develop; image builds reproducibly with SBOM; one weekly Dependabot PR observed or simulated.
Risks: R1 shared workflows late (E1): vendored fallback; R2 `ci-gate` swap error: two-step procedure with both contexts; R3 Next 16.4 on Node 26 fails: stay on 24.

## M2: Quality net (Phase A, 81 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M2.1 | M, 8 | todo | Coverage: c8 merge of unit and integration, floors (80% repo, 90% auth), diff-cover (90% auth, 80% rest); ratchet files created from measured values. Acceptance: store file coverage above 80% in the merged report. |
| M2.2 | L, 12 | todo | Spike S1 (1 day, one spike for all four TypeScript repos, DR-09): StrykerJS with TS 7 on `node:test` (`tap-runner`) and on Vitest 4; decide ADR-0018 "Test runner decision (spike S1)" (Vitest 4 preferred if it works; else `node:test` + `tap-runner`; the same choice everywhere); wire incremental on PRs and a nightly full run on the scope in `testing.md`. Acceptance: baseline mutation score recorded; break 70, permission module 85 as target (ratchet starts at the measured score, raised until target). |
| M2.3 | M, 6 | todo | Property and fuzz suites with fast-check (list in `testing.md`). Acceptance: 100 runs on PR, 1,000 or 5,000 nightly, shrunk counterexamples kept in the log. |
| M2.4 | L, 12 | todo | Authz matrix with route and server-action enumeration, CSRF/Origin tests, Better Auth advisory regression tests, RSC and DTO leak scan, session revoke tests. Acceptance: 100% of mutating routes and actions listed; an unlisted new action fails the test (negative fixture). |
| M2.5 | M, 8 | todo | Browser restructure: per-role projects (stored auth state via the fake IdP), split `backoffice.spec.ts`, PR = Chromium + WebKit iPhone, nightly all engines plus Pixel, `failOnFlakyTests` on main. Acceptance: browser job at or under 5 min on PR. |
| M2.6 | S, 3 | todo | No-overflow test at 320/390/768/1440 on every route (it fails on `/panel/accesos` at 390: that red test is the P1 repro). **How it merges:** the spec lands with `test.fail()` on exactly that route and width plus an entry in `quality/ratchets/known-failures.json` (reason, A-P1-1, owner M3.1); `ci-gate` stays green because an expected failure counts as a pass; M3.1 removes the `test.fail()` and the ratchet entry in the same PR as the fix, and a gate step fails if any known-failure entry outlives the M3 exit. Acceptance: the test is red-by-design in CI and the ratchet file lists it. |
| M2.7 | M, 8 | todo | Visual infrastructure: pinned Playwright image, frozen clock, mock modes for all states, `/__kit` dev-only page skeleton; sign-in baselines are throwaway: infrastructure proof only, discarded at M5, never a long-lived contract; infrastructure proven on sign-in. Acceptance: sign-in baselines identical across three consecutive CI runs at tolerance 0.002; `/__kit` is absent from the production build (test). |
| M2.8 | M, 6 | todo | Lighthouse CI (median of 5) and `check-bundle.ts` in warn mode; baselines for the ratchets (dashboard mobile performance 0.70, TBT 2,966 ms today). Spike: confirm Next 16 manifests for per-route JS. `check-bundle.ts` also records the Recharts client JavaScript size; until it does, the 391 KB figure is owner-reported, not measured, and no budget or acceptance quotes it as fact. |
| M2.9 | M, 6 | todo | ZAP baseline nightly on the preview stack; container structure and smoke extended; log-redaction and request-id tests written (red until M4.7). Acceptance: ZAP nightly report artifact with 0 high alerts or each triaged; redaction and request-id tests exist and are listed as expected-red with owner M4.7. |
| M2.10 | M, 6 | todo | `scripts/scorecard.ts`, `quality/ratchets/*.json`, nightly workflow producing `scorecard.json`; contract drift watch job. Acceptance: nightly `scorecard.json` validates against its schema; every axis of `scorecard.md` has a measured value or a named gap; ratchet files parse in a unit test. |
| M2.11 | S, 3 | todo | Copy lint: `messages/es.ts` extraction test scaffolding and the voseo denylist (applied to the existing strings through a baseline file that only shrinks). |
| M2.12 | S, 3 | todo | Diagnose sign-in mobile TBT (1,025 ms with no charts on the page, `audit/lighthouse-summary.json`, A-P1-3): Lighthouse mobile trace of `/sign-in` (median of 5) and a Chrome performance trace; list the long tasks (hydration, fonts, proxy, third-party, framework chunk) and attribute the milliseconds. Acceptance: diagnosis note `docs/explanation/perf-signin-diagnosis.md` with the trace summary and one named fix item (in M3.2 or M5.2) with a target TBT; no fix is guessed before the trace. |

Milestone exit: `scorecard.json` produced nightly; no gate in warn mode older than 14 days; flake detector green; authz matrix 100%.
Risks: R4 Stryker with TS 7 (spike, fallback Vitest for scoped modules); R5 mutation runtime (incremental plus scope control); R6 visual flakiness (pinned image, fonts ready, tolerance 0.002 then calibrate).

## M3: Phase A polish (Phase A, 32 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M3.1 | M, 5 | todo | Fix A-P1-1: members table in a scroll region with `min-w-0` and e-mail wrapping only on overflow; fix A-P1-2: daily table full-width scroll region with an edge cue. Acceptance: no-overflow test green on all routes and widths; axe 0. |
| M3.2 | M, 6 | todo | Interim performance fix A-P1-3: `next/dynamic` for chart components below the fold and `Suspense` around the telemetry and analytics panels. Acceptance: dashboard mobile TBT at or below 1,200 ms and performance at or above 0.80 (interim; the final target is M5). The sign-in cause is handled separately by the M2.12 diagnosis. |
| M3.3 | M, 6 | todo | Docs structure: README to the template; Diataxis moves and ADR move (`file-moves.md`); delete the dated evidence directories after the tag exists; `check-docs.ts` extended. Acceptance: README headings check and `docs:check` zero missing links. |
| M3.3b | M, 6 | todo | Docs content: generated reference files; threat model; community files finished; CONTRIBUTING shortened. Acceptance: lychee, markdownlint, Vale green. |
| M3.4 | S, 3 | todo | Honesty fixes found by the evaluator pass (stale README claim on Alpine, coral danger text): small PRs. |
| M3.5 | M, 6 | todo | **First independent three-lens re-score** (fresh evaluator agent, rubrics v2, repo plus evidence only). Acceptance: scores recorded in `progress.md` with evidence links; P0 and P1 of `audit.md` closed or each with a dated reason; no regression versus M2 ratchets. |

Risks: R7 interim fixes are thrown away by M5 (accepted: they are small and close P1 early as the ecosystem requires).

## M4: Architecture and TypeScript (Phase B, 63 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M4.1 | M, 8 | todo | `server/container.ts` composition root (merges `operations.ts` and `analytics.ts`), `env.ts` and `env-parse.ts` (renames), guard rule that only `env.ts` reads `process.env`. Acceptance: guard green with new negative fixtures. |
| M4.2 | S, 4 | todo | Authz-export guard: every `"use server"` export and non-GET handler authorizes or is allowlisted. Acceptance: negative fixture fails. |
| M4.3 | M, 8 | todo | Compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noImplicitOverride`), subpath imports, `typedRoutes`; fix every error without suppressions. Acceptance: 0 type errors. |
| M4.4 | L, 12 | todo | Split `dashboard.tsx` into `overview`, `runs`, `usage`, `catalog` modules and routes **with the old look** (routes appear, shell does not yet). Acceptance: no presentation file over 250 lines; existing browser tests pass unchanged except route addresses; visual look unchanged: at the start of M4.4 capture throwaway baselines of the old routes (not committed beyond the PR, discarded after) and diff against them in that PR at tolerance 0.002. |
| M4.5 | M, 8 | todo | `messages/es.ts` extraction (all Spanish strings), `shared/lib/format.ts` (Intl with explicit time zone), `shared/` layout. Acceptance: dictionary test; no hard-coded Spanish in `.tsx`. |
| M4.6 | L, 12 | todo | `Metric` tagged domain type and derivations, property-tested; IAM use cases `listAudit`, `listSessions`, `revokeSession`, `revokeOtherSessions` with adapters and integration tests; optional migration `0003` for the audit cursor index (measured first). |
| M4.7 | M, 6 | todo | `x-request-id` in `proxy.ts`, propagated to the API call, logs and spans; `/healthz` and `/readyz` `version` and `schema_version`; deployment contract updated (expand only; `vps-ops` told through the plan handoff). |
| M4.8 | S, 3 | todo | Guard: Biome second layer enforced, knip zero; evaluate TypeScript 7.1 programmatic API availability and decide on dropping `@typescript/typescript6` (ADR-0010). |
| M4.9 | S, 2 | todo | **Cross-repo** expand request to `pequeverso-assistant-api`: optional per-run stage spans in `ops.recent` (PVB-D5); no consumer work until released. |

Milestone exit: guards in enforce mode with empty baseline; 0 type errors; contract cross jobs green; presentation-only M5 is possible.
Risks: R8 broad renames conflicting with Dependabot (merge the weekly PR before starting each move); R9 TypeScript 7.1 slips (keep the TS 6 compiler API dev dependency).

## M5: Master design (Phase C, 150 h; the design stream)

Sub-streams run in parallel after M5.1. Dependencies: portfolio-backoffice plan (shared kit and structure), `engineering-standards` for kit and token structure **[E1]** (fallback: this repo is canonical and the sibling copies from its develop SHA).

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M5.1 | L, 24 | todo | Tokens and kit core: `structure.tokens.json`, `atelier.tokens.json`, Style Dictionary or Terrazzo spike, generated `theme.css`, `check-tokens.ts` (contrast, CVD, both themes), `check-literals.ts`, primitives, `/__kit` with all states, `sync-kit.ts` and `kit.lock.json`. Acceptance: token contract green; kit components each have state tests; **upstream the kit**: the kit PR is opened against `portfolio-backoffice` and linked in `progress.md` (In-flight tasks) so the sibling can consume it. |
| M5.2 | L, 16 | todo | Shell: `AppShell`, sidebar with rail and bookmark, topbar, status strip, user menu with theme, density and time zone cookies (no flash), command palette and shortcut model, skip link, drawer on tablet and phone. Acceptance: keyboard and axe tests; shell visual baselines; no layout shift above 0.05. |
| M5.3 | L, 24 | todo | Resumen and Ejecuciones: stamp, sentence, KPI row, panels, "Para revisar"; table, filters in URL, peek sheet, run detail with `RunLine`. Acceptance: three questions above the fold at 1440 x 900; designer rubric at least 95 per view. |
| M5.4 | L, 16 | todo | Consumo, Catálogo: ledger, `BulletBar`, tabs, projection rule, catalogue ficha with timeline. Acceptance: route-level axe 0 on both routes in both themes; no overflow at 320; state tests per new component; baselines committed. |
| M5.5 | L, 20 | todo | Accesos, Auditoría, Cuenta: MemberRow, InvitationRow, SessionRow, audit table with cursor and export, preferences. Acceptance: authz matrix and typed-confirm tests; no overflow at 320. |
| M5.6 | M, 8 | todo | Actividad del sitio: rebuilt on Metric, ChartFrame, Heatmap with hatch. Acceptance: route-level axe 0; no overflow at 320; every chart has a data-table twin test; baselines committed in both themes. |
| M5.7 | M, 12 | todo | Charts: owned SVG set with twins, hatch, glyphs; **remove Recharts** (ADR-0012). Acceptance: `recharts` absent from `package.json`; the Recharts size reported by `check-bundle.ts` (M2.8) replaces the owner-reported 391 KB in the audit; if M2.12 shows that the sign-in TBT has a cause outside charts, that cause is fixed under the item named in the diagnosis note; route JS at or below 170 KB gz; dashboard mobile TBT at or below 200 ms and performance at or above 0.90 (median of 5). |
| M5.8 | M, 12 | todo | Illustrations, signature details, margin-note font, dark theme polish. **[owner]** taste checkpoint with screenshots (PVB-D9, D10), one revision round. Acceptance: dark theme passes `check-tokens.ts` contrast and CVD; screenshots of every route in both themes attached to the checkpoint in `progress.md`; the owner verdict is recorded, one revision round only. |
| M5.9 | M, 8 | todo | Visual baselines (10 routes x 2 themes x 3 viewports + states), forced-colors and zoom tests, reduced-motion test, identity test with the sibling. Acceptance: N baselines exist (10 routes x 2 themes x 3 viewports = 60, plus states) and a manifest test counts them and fails on a missing or extra file; forced-colors, zoom and reduced-motion tests green. |
| M5.10 | M, 10 | todo | Independent designer and operator evaluator pass; manual screen-reader pass **[owner or fresh human]**; gap list. Acceptance: scores and gap list in `progress.md` with evidence links. |

Milestone exit: visual baselines approved in both themes; evaluator at least 95 per axis or a documented gap list; performance and accessibility budgets green; sign-in still uses the fake IdP click path.
Risks: R10 over-unifying with the sibling (identity test); R11 kit drift (lock and hash); R12 scope creep (each view has fixed acceptance; additions go to a backlog file); R13 owner taste (checkpoint with one revision round).

## M6: Excellence verified (Phase C, 34 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M6.1 | M, 6 | todo | Mutation thresholds at target (permission module at least 85, rest at least 75), ratchets tightened to measured values. Acceptance: nightly mutation report shows permission module at or above 85 and overall at or above 75 on two consecutive runs; ratchet files equal the measured values. |
| M6.2 | M, 8 | todo | Remaining gaps from the M5 evaluator and the M3 audit closed; docs and skills finalized (activation evals pass; staleness check clean); README hero shots from baselines. Acceptance: M3 audit P0 and P1 items and the M5 gap list are closed or carry a dated reason; `check-skills` and the activation evals green; hero shots are byte-equal to committed baselines. |
| M6.3 | M, 6 | todo | Independent three-lens re-score; two consecutive nightly `scorecard.json` runs with every axis at or above 95 (D7 and P3 floor 90 where stated). |
| M6.4 | L, 12 | todo | MV-R (VPS readiness, OD-64; part of the M6 exit): release-candidate image built by the `release` profile with SBOM, provenance and a verified digest, kept as a CI artifact or in a private registry namespace without deploying (DR-13); `vps-ops` registry entry and Coolify configuration as code for this app; secrets inventory (names only) and SOPS template (`BETTER_AUTH_SECRET`, OAuth apps, ops token); migrations rehearsed against a fresh backup marker; participation in the full-stack rehearsal on a disposable Ubuntu 26.04 VM and the day-one runbook (apply stays disabled). |
| M6.5 | S, 2 | todo | OD-09 copy refresh before release: README, repository description, topics and hero shots updated to the final state from verified facts only; UI copy stays Spanish (es-419, tú). |

Exit: as ecosystem 3A, plus MV-R. Risks: a floor axis cannot reach 95 offline: record the blocker and keep the floor.

## M7: Release to main (Phase C, 12 h)

Order across repos: APIs, backoffices, sites, `vps-ops` pins; this repo releases after `pequeverso-assistant-api` (consumer of its contracts).

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M7.1 | S, 2 | todo | Release PR from release-please (version 2.0.0, PVB-D13), **[owner]** merges it; `develop` to `main` promotion PR with merge commit on **owner request only**, `release` profile green. |
| M7.2 | M, 6 | todo | Release workflow: build once, SBOM, provenance, scan, `gh attestation verify`, image to GHCR (private package), immutable GitHub Release; verify private-package attestation (unverified until now). |
| M7.3 | S, 2 | todo | `vps-ops` PR to `releases/production.lock` (cross-repo); owner approves; nothing deploys (deploy is MV). |
| M7.4 | S, 2 | todo | Back-merge PR `main` to `develop`; CHANGELOG and tag `v2.0.0`. |

Exit: `main` equals released `develop`; tags and changelog published. Risks: private GHCR attestation verification fails (then make the package public: the repo is public and the image holds no secrets; owner decision).

## M8: Profile showcase (after every repo reaches M7; 2 h)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| M8.1 | S, 2 | todo | Provide this repo's featured-project entry for the GitHub profile redesign (OD-08): description, topics, social preview and measured results (accessibility, performance, mutation score) from verified facts; the profile README is owned by `gonzalomartinperez/gonzalomartinperez`. Acceptance: repo metadata matches the final state; `checkpoint/M8`. |

## MV: VPS activation (gated: VPS purchase and spend authorization)

| ID | Size, h | Status | Task and acceptance |
|---|---|---|---|
| MV.1 | gated | todo | **[owner]** Real OAuth apps (Google, GitHub), origin and TLS, `BETTER_AUTH_SECRET` in SOPS; deploy by digest through `vps-ops`; migrations as a pre-deploy job gated by a backup marker. |
| MV.2 | gated | todo | Live reading from `pequeverso-assistant-api` (`LIVE_OPS_URL`, `LIVE_OPS_TOKEN` in a private network); the three live Playwright cases run; real latency and spend appear without fixture banner. |
| MV.3 | gated | todo | Observability live: OTLP collector, `observability/*` dashboards and burn-rate alerts, SLOs (availability 99.5% monthly for the panel as a service, p95 server time), request-id correlation checked through the API. |
| MV.4 | gated | todo | Restore drill of the IAM database (monthly), secret recovery test, real-device Safari and Android smoke, Lighthouse on the real host, ZAP against the deployed instance, uptime probes. |
| MV.5 | gated | todo | Optional: web-vitals RUM only after an owner decision. |

Exit: restore drill passed; SLO dashboards live; D7 re-scored without the floor.
