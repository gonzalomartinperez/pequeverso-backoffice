# Progress log

The Current state and Milestone log are updated at milestones (and by the owner's explicit request); "In-flight tasks" is updated on every task merge. A criterion without evidence is unmet; every row cites a CI run, report or checklist with commit SHA and date once work starts.

## Current state

| Field | Value |
|---|---|
| Current milestone | **M3 complete, awaiting `checkpoint/M3`** (M1 and M2 tasks merged; M1.5 reproducibility parked, see In-flight). The orchestrator tags after verification |
| Date | 2026-11-22 |
| develop SHA | `0517a53` at the M3.5 re-score (later: #146 `dbe97d2`, #147 `8bf2717`, this docs PR) |
| Baseline scorecard | M3.5 independent re-score (rubrics v2, develop `0517a53`, 2026-11-22; table in the Milestone log): D1 87, D2 86, D3 84, D4 88, D5 84, D6 78, D7 74, D8 86; P1 72, P2 72, P3 86, P4 76, P5 78, P6 76; O1 66, O2 92, O3 80, O4 87, O5 60. Baseline (2026-11-09) in `scorecard.md` |
| Measured | CI on develop green (run 44963965429 on `6ae3bde`); unit 355 pass, 5 expected-red todo (M4.7); merged branch coverage 91.6 (auth 87.5, store lines 97.1); mutation 75.77 (hosted run 44956309025); dashboard mobile Lighthouse 0.96, TBT 180 ms (run 44955292803; was 0.90 and 359 ms); `/panel` first-load JS 158.4 KB gz (was 274.4); visual sign-in baselines identical on three CI runs; no-overflow green at 320/390/768/1440 |
| **Next item** | **M4** (after `checkpoint/M3`). Carry-overs: M1.5 reproducible digest; retire the unrequired **Required checks** alias job (needs an AGENTS.md change); Node 26 decision on 2026-11-28 (ADR 008, OD-77); Lighthouse and bundle budgets leave warn mode after 2026-11-28 |
| Known issues | (1) GitHub runs `schedule` only from `main`, so nightly scorecard, mutation, ZAP, `vuln-daily` and Scorecard start at M7; (2) bundle ratchet: four non-panel routes are 68 to 70 bytes above baseline after the Next 16.4.6 security bump (warn mode); (3) `qs` is overridden to 6.17.1 under Stryker (GHSA-q8mj-m7cp-5q26) until Stryker moves; (4) local test runs under load can time out the 2 s subprocess in `ci-profile.test.ts` (CI unaffected) |
| Pending decisions | none (PVB-D1 to PVB-D15 resolved by delegation, `README.md` section 6) |
| Owner inputs still needed | (1) PVB-D9 and PVB-D10 taste checkpoint on the M5 screenshots; (2) immutable releases and a `v*` tag ruleset (ADR 0015); Dependabot security updates are off; (3) real OAuth apps and secrets at MV; plus the per-task **[owner]** steps in `roadmap.md` (M0.3, M5.10, M7.1, M7.3). Resolved since M1: ruleset swap to `ci-gate`, CodeQL default setup, secret scanning and push protection, private vulnerability reporting (all verified 2026-11-22); release App not needed (OD-78); LGPL allow-list (OD-80, #146); `agent-review.yml` stays out (OD-79) |

## In-flight tasks

Updated on every task merge (not only at milestones). One row per task that is `in-progress` or merged since the last milestone tag; the true next task is found with the resume command of `RESUME.md` section 4a (git first, this table second).

| Task ID | Status | Branch | PR | Merge SHA | Date | Note |
|---|---|---|---|---|---|---|
| M1.12 | done | `fix/m1-old-domain-sweep` | #104 | `ec0c3ea` | 2026-11-14 | No reference found outside decision records; unit test with negative fixtures |
| carry-over | done | `build/m1-biome-2-6` | #105 | `40c8c0d` | 2026-11-14 | Biome 2.6.7; Markdown excluded (byte-identical plan copies) |
| M1.5 | done (gates); reproducibility pending | `build/m1-container-metadata`, `ci/m1-image-gates` | #106, #110 | `fa4d253`, `79fc3d1` | 2026-11-14 | Runtime ARGs and labels, PostgreSQL HEALTHCHECK, `--ignore-scripts`, `docker-bake.hcl`; hadolint, dockle, structure test, Grype (fixed zlib/apt CVEs), SBOM. **Open acceptance:** digest reproducible across two builds of one SHA (needs a deterministic Next build id and `rewrite-timestamp`) and a recorded `trivy config` 0-findings run |
| M1.6 | done (trial running) | `ci/m1-node-26-trial` | #107 | `845e16f` | 2026-11-14 | Node 24.22.0 and 26 advisory matrix; ADR 008 decision due 2026-11-28 |
| M1.8 | done | `chore/m1-import-rules-knip`, `docs/m1-agents-skeleton` | #108, #118 | `47211de`, `5d980ca` | 2026-11-14 | Biome import rules and domains, knip in `check` and CI; AGENTS.md skeleton with command-equality test |
| M1.9 | done (core catalog) | `chore/m1-skills-layout-flip`, `chore/m1-skill-catalog` | #109, #116 | `ff24e3e`, `94430b5` | 2026-11-14 | Layout flip; seven core skills with evals. Follow-up slice: web/backoffice/repo skills of `skills.md` section 3 (`audit-*`, `evolve-design-system`, `add-metric`, `security-review-auth`, `refresh-contract`) |
| M1.9b | done | `chore/m1-agent-harness` | #117 | `9727acc` | 2026-11-14 | Settings, hooks wired, agents, Codex and MCP config; hook dry run blocks force push and `.env.local`. `agent-review.yml` not added (needs a paid model token: owner) |
| M1.11 | done | `chore/m1-dev-experience` | #111 | `c554b16` | 2026-11-14 | `npm run setup`, `check:fast`, dev container, GLOSSARY; CI static job proves the one-command setup. Repository settings via the standards script: owner (PVB-D14) |
| M1.1 | done | `chore/m1-standards-lock` | #112 | `68403b1` | 2026-11-14 | E1 v1.0.0 lock, byte-matched files, drift workflow, pin test |
| M1.2 | done | `ci/m1-dynamic-ci` | #115 | `3483805` | 2026-11-14 | classify + profiles, build once, ci-gate, Required checks alias |
| M1.4 | done (guard); sandbox proof by E1 ADR 0002 | `ci/m1-security-workflows` | #113 | `87dc4df` | 2026-11-14 | deps-weekly-guard (bot check hardened); Dependabot group `weekly` with group-level limit and commit-message (#112). Stale branch deletion: owner |
| M1.7 | partly done | `ci/m1-security-workflows`, `ci/m1-dynamic-ci` | #113, #115 | see above | 2026-11-14 | vuln-daily, Scorecard, dependency review and harden-runner audit in CI. **Open:** CodeQL default setup, secret scanning and push protection (owner settings); first Scorecard run and daily-job dry run after activation on `main` |
| M1.10 | done (scaffolding) | `chore/m1-release-scaffolding` | #114 | `ae26599` | 2026-11-14 | release-please config, manifest and App-gated workflow, CODEOWNERS; community files via #112. App grant: owner |
| M1.3 | done [owner] | — | — | — | 2026-11-22 | Both rulesets require only `ci-gate` (verified); the alias job is now unrequired |
| M1.7 | done | `ci/od-80-lgpl-allowlist` | #146 | `dbe97d2` | 2026-11-22 | LGPL-3.0-or-later allowed for unmodified dynamic libraries (OD-80); owner settings verified enabled |
| M1.10 | done | `ci/m3-release-without-app` | #147 | `8bf2717` | 2026-11-22 | release-please replaced by the ADR 0015 version-bump flow (OD-78); create-only tag, `--verify-tag` |
| M1.5 | parked | — | — | — | 2026-11-22 | Reproducible digest needs a deterministic Next build id, `SOURCE_DATE_EPOCH` and buildx `rewrite-timestamp`, then two builds of one SHA plus a recorded `trivy config` run; disk- and CPU-heavy, so it is not run on the shared workstation (owner budget, 2026-11-21). Do it in CI with M4/M6 container work |
| M2.1 | done | `test/m2-coverage-gates` | #124 | `ec31a9f` | 2026-11-14 | Merged c8 coverage, floors, ratchet, diff gate |
| M2.2 | done | `test/m2-mutation` | #140 | `bac5a1c` | 2026-11-21 | ADR 0018: StrykerJS + tap-runner; PR gate per file, nightly full; ratchet 75.7 from the hosted run; `qs` override |
| M2.3 | done | `test/m2-property-fuzz` | #121 | `dd69764` | 2026-11-14 | fast-check property and validator fuzz suites |
| M2.4 | done | `test/m2-authz-matrix`, `test/m2-authz-csrf-leaks` | #123, #126 | `0445630`, `7e1b62c` | 2026-11-14 | Surface enumeration, role matrix, CSRF, advisory, session and leak tests |
| M2.5 | done | `test/m2-browser-projects` | #133 | `d72c2ed` | 2026-11-14 | Per-role projects, PR and nightly engine sets |
| M2.6 | done | `fix/m3-table-overflow` | #141 | `c574aa9` | 2026-11-21 | Landed green with the M3.1 fix (no expected-fail entry needed) |
| M2.7 | done | `test/m2-visual-infra` | #142 | `75b1fa6` | 2026-11-21 | Pinned image, frozen clock; three identical CI runs; `/__kit` absent from the production build |
| M2.8 | done | `ci/m2-lighthouse-bundle`, `fix/m2-lighthouse-rebaseline` | #125, #130 | `537140d`, `d3696f2` | 2026-11-14 | Warn mode since 2026-11-14 |
| M2.9 | done | `test/m2-zap-redaction` | #127 | `850723b` | 2026-11-14 | ZAP nightly, expected-red redaction tests (M4.7) |
| M2.10 | done | `chore/m2-scorecard` | #132 | `e6be8cf` | 2026-11-14 | Scorecard script, ratchets, contract drift watch |
| M2.11 | done | `test/m2-copy-lint` | #120 | `b25f44f` | 2026-11-14 | Voseo denylist with a shrink-only baseline |
| M2.12 | done | `docs/m2-signin-tbt-diagnosis` | #122 | `65bbc41` | 2026-11-14 | Sign-in TBT attribution |
| M3.1 | done | `fix/m3-table-overflow` | #141 | `c574aa9` | 2026-11-21 | Real cause: an absolutely positioned `sr-only` header escaped the scroll clip; full-width daily table and edge cue |
| M3.2 | done | `perf/m3-lazy-charts` | #138 | `af60cba` | 2026-11-21 | Recharts after hydration; dashboard mobile 0.96 / TBT 180 ms |
| M3.3 | done | `docs/m3-docs-structure` | #134 | `0982559` | 2026-11-15 | Diataxis and MADR layout, README template, heading check |
| M3.3b | done | `docs/m3-threat-model`, `docs/m3-references-community`, `ci/m3-docs-lint` | #143, #144, #145 | `028fe5c`, `6ae3bde`, `0517a53` | 2026-11-21/22 | Threat model with a cited-test guard; generated routes and env references; CONTRIBUTING 35 lines; markdownlint and offline lychee in CI; Vale not adopted (dated reason in roadmap) |
| M3.4 | done | `docs/m3-honesty-fixes` | #135 | `0094fde` | 2026-11-15 | Coral usage stated truthfully |
| M3.5 | done | `docs/m3-progress` | this PR | — | 2026-11-22 | Independent re-score below |
| unplanned | done | `fix/deps-next-16-4-6` | #139 | `a789090` | 2026-11-21 | Next 16.4.6 for GHSA-vvgp-ww4w-46vf (npm audit and Next's build refusal blocked every PR) |

## Milestone log

| Milestone | Date | develop SHA | Scorecard snapshot | What changed | Next | Issues |
|---|---|---|---|---|---|---|
| M0 | 2026-11-09 | `275dd45` (PR #101) | baseline above | plan merged; tag `checkpoint/M0` | M1 | |
| M1 | 2026-11-14 (in progress) | see Current state | baseline (re-score at M3) | E1 v1.0.0 adopted; dynamic CI with ci-gate; image gates and SBOM; Dependabot weekly group and guard; skills catalog and harness; setup and check:fast | M1.3 [owner], then M2 | owner settings and post-activation items in Current state |
| M2 | 2026-11-21 | `75b1fa6` (#142, last M2 task) | baseline | Quality net: coverage, mutation, property and fuzz, authz matrix, browser projects, no-overflow, visual infrastructure, Lighthouse and bundle, ZAP, scorecard, copy lint | M3 | Nightly jobs run only from `main` (M7); budgets in warn mode until 2026-11-28 |
| M3 | 2026-11-22 | `0517a53` (re-score subject) | D1 87, D2 86, D3 84, D4 88, D5 84, D6 78, D7 74, D8 86; P1 72, P2 72, P3 86, P4 76, P5 78, P6 76; O1 66, O2 92, O3 80, O4 87, O5 60 | P1 fixes (overflow, daily table, dashboard TBT), docs structure and content, threat model, docs CI; independent re-score (P0: none; A-P1-1, -2, -3, -5, -6, -7, -8 closed; A-P1-4 open until M7 publish and provenance; A-P1-9 information architecture open until M5); no M2 ratchet regressed apart from the 68 to 70 byte bundle note | M4 | Top gaps: the M5 design surface, warn-mode budgets, supply-chain provenance (M7), flake data and auth branch coverage below 90, observability todo tests (M4.7) |
| M4 | | | | | | |
| M5 | | | | | | |
| M6 | | | | | | |
| M7 | | | | | | |
| MV | | | | | | |

## Ecosystem status (nine repositories; identical table in every repo)

| Repo | Plan | Milestone | Branch and SHA at planning (`git rev-parse origin/<branch>` after `git fetch -q`, 2026-11-09) | Notes |
|---|---|---|---|---|
| portfolio | v2 written | M0 | `develop` `0a1ff564f66475a1d9a360a9c927ac804accbf83` | bilingual site; hero particle system v2 |
| portfolio-assistant-api | v2 written | M0 | `develop` `e749ca762fb3f1e74225d9126d4eb1bbd88e2885` | RAG assistant API; eval and typing debt |
| portfolio-backoffice | v2 written | M0 | `develop` `e356b13d81d509e640b3b318c0d37c7b4abcce1c` | assistant and site analytics ops |
| pequeverso | v2 written | M0 | `develop` `cbf519ce9c49f35a2536d4606520221a4a6debe0` | Spanish-only store; consent opt-in ships at M7 |
| pequeverso-assistant-api | v2 written | M0 | `develop` `6912579245506bbd60f745243905ce4974dfbfe9` | Spanish-only shopping assistant API; golden set and judge validation |
| pequeverso-backoffice (this repo) | v2 written | M1 (in progress) | `develop` `4d4fb9633f2d355ed80b3f05407cbd3a2a5cf5e0` | local folder `pequeverso-assistant-backoffice` |
| vps-ops | v2 written | M0 | `main` `f52c3e693250b17a2f8783f83cf1b5bf8097f238` | private, main-only; VPS not bought |
| pequeverso-marketing | v2 written | M0 | `main` `7d26bf4240c9034e339ee4545e5f883c75fd816f` | private, main-only; Spanish plan |
| dropshipping-ops | v2 written | M0 | `main` `8ff028365944ee69ef47fd7a871b1b63da4be089` | private, main-only; exploratory business line |

(SHAs read with `git -C <repo> rev-parse origin/<branch>` after `git fetch -q` on 2026-11-09; the local checkout of this repo is the folder `pequeverso-assistant-backoffice`. Each repo records its own SHA in its own `progress.md` when its plan merges; the table is drift-checked.)
