# Scorecard

Rubrics v2 (`rubrics.md`, byte-identical across the nine repos) are frozen. Baseline date 2026-11-09, develop **4d4fb96**. "Measured" means a number from `audit.md`; "judged" means the planner's estimate from that evidence, provisional until the independent re-score at M3 (rubric rule: a criterion without evidence is unmet, scores below 85 mean a critical criterion is unmet). Targets are at least **95 on every axis**. Where an unauthorized input blocks an axis the floor is **90** and the axis says so.

## Lens 1: senior developer

| Axis | Baseline | Evidence (criteria unmet in bold) | Target | Automatic measurement | Ratchet file |
|---|---|---|---|---|---|
| D1 Architecture | 86 judged | Guard with negative fixtures and empty baseline (met). **No composition root file** (wiring spread over `server/auth.ts`, `operations.ts`, `analytics.ts`); no Biome import rules; no test that every `"use server"` export authorizes; 647-line presentation module | 96 | `check-boundaries.ts` output, Biome `noRestrictedImports/noPrivateImports/noImportCycles`, authz-export test, file size lint (presentation module max 250 lines) | `quality/ratchets/guard.json` (violations = 0) |
| D2 Code quality | 82 judged | Lint 0, types 0 (measured). **No complexity metric, no knip/dead-code gate**, no `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess` evidence | 96 | Biome complexity (max 10, ratcheted), knip, tsc flags, lint suppression count | `lint.json`, `complexity.json`, `types.json` |
| D3 Tests | 78 judged | Unit 159/159, DB 19/19, branches 88.8 (measured). **No mutation, no diff coverage, no merged coverage (store 32.9%), no flake data, no property tests**, no mutating-route matrix | 96 | node coverage + integration merged by c8, diff-cover, Stryker incremental and nightly, `--repeat-each` flake detector, matrix test | `coverage.json`, `mutation.json`, `flake.json` |
| D4 CI/CD | 70 judged | Single aggregate job, SHA pins, strict permissions (met). **Not dynamic, builds per job, required context is not `ci-gate`, Dependabot rule violated, no release automation, no duration report** | 96 | `ci-profile.json` coverage test, `gh run list` p50/p95 report, deps-weekly-guard result, release workflow dry run | `ci-duration.json` |
| D5 Security and supply chain | 74 judged | SHA-pinned actions, zizmor, gitleaks, CSP nonce, least-privilege DB role test (met). **No CodeQL, SBOM, provenance, image scan, Scorecard, threat model, vulnerability SLA job, push-protection evidence** | 96 | CodeQL alerts = 0 high, Grype on digest, SBOM attestation verify, Scorecard score, osv daily, threat-model file present and linked from tests | `security.json` (open high/critical = 0, Scorecard floor) |
| D6 Performance | 60 judged | Dashboard mobile 0.70, TBT 2,966 ms, 391 KB charts (measured). **No budget enforced in CI** | 96 | Lighthouse CI median of 5, `check-bundle.ts`, server-time probe on the mock | `lighthouse.json`, `bundle.json` |
| D7 Observability | 72 judged | OTel with privacy bounds, private metrics, alert and dashboard files (met in code). **No request-id propagation, no version in health, SLOs undefined, nothing live** | **90 floor** until MV (real SLO dashboards and alert delivery need the VPS); 96 on everything verifiable offline | log-redaction test, request-id propagation test, health contract test, SLO file lint | `observability.json` |
| D8 Docs and DX | 70 judged | Strong ADRs and architecture docs, one-command checks, skills validator (met). **README not on template (dated blocks, gallery), no automated CHANGELOG, missing community files, volatile facts in prose, skills without activation evals** | 96 | README heading check, lychee, markdownlint, Vale, skills validator plus activation evals, `docs:check`, standards drift | `docs.json` |

Axes below 85 at baseline (D3, D4, D5, D6, D7, D8 and several lens 2 axes) mean at least one critical criterion is unmet; the roadmap orders work so the cheapest critical criteria close first (M1 and M2).

## Lens 2: senior product designer (web repo; theme minimum counts)

| Axis | Baseline | Evidence (unmet in bold) | Target | Automatic measurement | Ratchet |
|---|---|---|---|---|---|
| P1 Visual design and system | 72 judged | OKLCH raw tokens and semantic roles exist (met). **Not DTCG, no generated theme, no literal lint, no contrast script, commerce tokens retained, chart palette collisions** | 96 | `check-tokens.ts`, `check-literals.ts`, snapshot of generated `theme.css` | `tokens.json` |
| P2 Interaction and motion | 70 judged | Reduced-motion honoured, native dialogs (met). **No skeleton loading, no standard states, no motion token test** | 96 | state fixtures in visual matrix, reduced-motion Playwright test, duration lint | `states.json` |
| P3 Accessibility | 85 judged | axe 0 on 24 captures, Lighthouse a11y 1.00, 44 px targets (measured). **1.4.10 reflow failure on `/panel/accesos` at 390**, no manual screen-reader pass, no 400% zoom check | 96; **floor 90 until a human screen-reader pass is recorded (human input)** | axe per route x theme x state, keyboard journeys, no-overflow gate, 200% and 400% zoom test, forced-colors test, manual checklist | `a11y.json` |
| P4 Responsive and cross-browser | 68 judged | Three engines run in CI (met). **Overflow at 390, clipped table at 1440, no visual regression baseline** | 96 | no-overflow test at 320/390/768/1440, visual matrix, WebKit iPhone project | `visual.json` |
| P5 Theme parity | 78 judged | Dark exists and passes axe. **No toggle, no per-theme contrast or visual evidence, dark is a port** | 96 (within 2 points of light) | token contract per theme, visual per theme, evaluator scores both themes | `parity.json` |
| P6 Consistency and identity | 78 judged | Identity coherent with the storefront, owned primitives (met). **Pill-everything, nested cards, one 647-line page, no shared kit with the sibling** | 96 | kit lock check, identity test, evaluator | `kit.lock.json` |

## Lens 3: operator lens (repo-type note, PVB-D12)

The rubric names CRO for Pequeverso and SRE for `vps-ops` but assigns no third lens to a backoffice. This plan scores the product from its real user, the owner reading and administering it. The five axes below are added as a **repo-type note** only; `rubrics.md` is unchanged (decision PVB-D12 asks the owner to confirm or to take the question to the standards process). They are recorded per release by the independent evaluator agent.

| Axis | Baseline | Evidence | Target | Measurement |
|---|---|---|---|---|
| O1 Answer first | 62 judged | Three owner questions need scrolling past six cards (3,839 px) | 96 | Evaluator task test with screenshots: three questions answered above the fold at 1440 x 900 and 390 x 844 (0 scroll, 0 clicks); a fresh evaluator answers all three in 10 s or less per view; stamp and sentence agree test (0 disagreements) |
| O2 Honesty | 92 judged | "Unavailable is not zero", synthetic labels, not-an-invoice wording (strong) | 97 | `Metric` state tests, grep for `?? 0`, fixtures with missing data, copy checks |
| O3 Plain language | 80 judged | Tuteo and calm copy; jargon (p50/p95, TTFT) on the surface; uppercase chip labels today | 96 | Dictionary tests (0 hard-coded strings in `.tsx`, 0 voseo or denylist hits), glossary coverage 100% of listed terms, 0 jargon terms (p50, p95, TTFT) outside `<details>`, 0 uppercase labels beyond the single 12 px eyebrow, evaluator read-through with 0 unexplained terms |
| O4 Safe administration | 85 judged | Single-use tokens, revoke dialog, last-owner protection (tested); no sessions view, no audit view, no consequence text | 96 | Authz matrix 100% of mutating routes, typed confirm tests, audit and sessions integration tests |
| O5 Speed to task | 60 judged | No search, no keyboard model, no deep links to filtered views | 96 | Playwright task timings within step budgets: open Resumen 0 clicks, find a failed run at most 3 interactions and 15 s, invite a person at most 5 interactions and 30 s; palette opens in 100 ms or less; every shortcut has a test |

## Floors and what blocks them

| Axis | Floor | Blocker |
|---|---|---|
| D7 Observability | 90 | VPS (live SLO dashboards, alert delivery, real traces); offline parts target 96 |
| P3 Accessibility | 90 until recorded | Human screen-reader pass (owner or a fresh human reviewer) |
| D5 Security | 95 | Fully automatable on a public repo (CodeQL, attestations, Scorecard are free); the real OAuth provider setup is MV |
| D3 Tests, live part | n/a | The three live-API browser tests stay skipped until MV; they are not part of the score |

## Scorecard tooling and cadence

- `scripts/scorecard.ts` aggregates CI artifacts (coverage, mutation, Lighthouse, axe, guard, bundle, visual, security, docs, kit lock, ratchets) into `scorecard.json` with per-axis inputs and pass or fail per criterion of `rubrics.md`; artifact `scorecard-<sha>`; nightly and on release; fails on regression against `quality/ratchets/*.json` (loosening needs an ADR and the owner).
- Judgement axes (lens 2 visual axes, lens 3) are scored by the independent evaluator agent at M3, M5, M6 and each release, with evidence links, never the planner's reasoning.
- Independent human or fresh-agent re-audit every quarter; the first re-score is the M3 exit criterion.
- Ratchet files committed in M2: `coverage`, `mutation`, `bundle`, `lighthouse`, `lint`, `types`, `complexity`, `guard`, `flake`, `ci-duration`, `security`, `tokens`, `visual`, `a11y`, `docs`, `observability`, `parity`, `states`, plus `scorecard.baseline.json` (axis values).
- Gate maturity: a new gate runs in warn mode for at most 14 days, then fails (ecosystem 3A, M2 exit).
