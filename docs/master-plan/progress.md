# Progress log

The Current state and Milestone log are updated at milestones (and by the owner's explicit request); "In-flight tasks" is updated on every task merge. A criterion without evidence is unmet; every row cites a CI run, report or checklist with commit SHA and date once work starts.

## Current state

| Field | Value |
|---|---|
| Current milestone | **M1 in progress** (M0 reached: plan merged in PR #101, tag `checkpoint/M0`). M1 tasks merged except the owner-only and post-activation items below; `checkpoint/M1` is tagged by the orchestrator after verification |
| Date | 2026-11-14 |
| develop SHA | `5d980ca` (before this M1 docs PR) |
| Baseline scorecard | judged and measured in `scorecard.md`: D1 86, D2 82, D3 78, D4 70, D5 74, D6 60, D7 72, D8 70; P1 72, P2 70, P3 85, P4 68, P5 78, P6 78; O1 62, O2 92, O3 80, O4 85, O5 60 (provisional until the M3 re-score) |
| Measured | unit 175+ (all green); dynamic CI live: code-PR wall-clock 5–7 min under shared-runner contention (full profile), docs-only profile measured on the M1 docs PR (see In-flight notes); image gates green (hadolint, dockle, structure test, Grype on both images, CycloneDX SBOM artifact) |
| **Next item** | **M1.3 [owner]** ruleset swap (`ci-gate` required, then retire **Required checks** and remove the alias job); in parallel **M2** (quality net) can start: the M1 minimum viable subset (M1.1, M1.2, M1.8) is merged |
| Known issues | (1) GitHub runs `schedule`/`workflow_dispatch` only from `main`, so `vuln-daily`, the Monday `deps-weekly-guard` run and Scorecard start at M7 (or an owner-authorized `main` sync); (2) the shared dependency-review licence allow-list lacks `LGPL-3.0-or-later` (`@img/sharp-*`, optional dependency of `next`), so a PR changing those lockfile entries fails `security` until the owner decides; (3) the E1 `deps-weekly-guard` template uses a spoofable `github.actor` check (fixed in this repo's copy; reported to the standards lead); (4) Windows C: below the 100 GB floor during M1 (other agents' load; old local `pequeverso-backoffice*` images, about 8 GB, predate M1 and were left for the owner) |
| Pending decisions | none (PVB-D1 to PVB-D15 resolved by delegation, `README.md` section 6) |
| Owner inputs still needed | (1) PVB-D9 and PVB-D10, the taste checkpoint on the M5 screenshots (one revision round); (2) PVB-D14, owner-only repository settings: **M1.3 ruleset swap**, enable **secret scanning and push protection** (both off), **CodeQL default setup** (not configured), **private vulnerability reporting** (off, while `SECURITY.md` points to it), release-please **GitHub App** (`RELEASE_APP_ID` variable, `RELEASE_APP_PRIVATE_KEY` secret), delete the orphaned branch `dependabot/docker/infra/docker/app/develop/node-a615538` (PR #96 closed; superseded on `develop`), licence decision for `LGPL-3.0-or-later` in dependency review; (3) real OAuth apps and secrets at MV; plus the per-task **[owner]** steps marked in `roadmap.md` (M0.3 branch deletion, M5.10 screen-reader pass, M7.1 and M7.3 release approvals). Optional: Codex login on the agent profile (`codex-<profile> login`) so the second-model review runs |

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
| M1.3 | parked [owner] | — | — | — | — | Ruleset swap; `ci-gate` and **Required checks** are both green on every PR since #115 |

## Milestone log

| Milestone | Date | develop SHA | Scorecard snapshot | What changed | Next | Issues |
|---|---|---|---|---|---|---|
| M0 | 2026-11-09 | `275dd45` (PR #101) | baseline above | plan merged; tag `checkpoint/M0` | M1 | |
| M1 | 2026-11-14 (in progress) | see Current state | baseline (re-score at M3) | E1 v1.0.0 adopted; dynamic CI with ci-gate; image gates and SBOM; Dependabot weekly group and guard; skills catalog and harness; setup and check:fast | M1.3 [owner], then M2 | owner settings and post-activation items in Current state |
| M2 | | | | | | |
| M3 | | | | | | |
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
