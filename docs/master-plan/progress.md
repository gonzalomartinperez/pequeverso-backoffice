# Progress log

The Current state and Milestone log are updated at milestones (and by the owner's explicit request); "In-flight tasks" is updated on every task merge. A criterion without evidence is unmet; every row cites a CI run, report or checklist with commit SHA and date once work starts.

## Current state

| Field | Value |
|---|---|
| Current milestone | **M0, not yet reached** (the plan exists; reaching M0 means this folder is merged to `develop` as `docs/master-plan/`) |
| Date | 2026-11-09 |
| develop SHA at planning | `4d4fb96` (merge of PR #90) |
| Baseline scorecard | judged and measured in `scorecard.md`: D1 86, D2 82, D3 78, D4 70, D5 74, D6 60, D7 72, D8 70; P1 72, P2 70, P3 85, P4 68, P5 78, P6 78; O1 62, O2 92, O3 80, O4 85, O5 60 (provisional until the M3 re-score) |
| Measured | unit 159/159; coverage L88.7 B88.8 F81.2; `test:db` 19/19; axe 0 on 24 captures; `/panel/accesos` overflows at 390 px; dashboard mobile TBT 2,966 ms; Postgres Dockerfile without HEALTHCHECK; no SBOM, scan, provenance or release workflow |
| **Next item** | **M0.1** (docs-only PR adding this folder to `develop`), then **M1.1** (`standards.lock` and drift check, needs the `engineering-standards` repository) or, if E1 is not decided, **M1.2** (`ci.yml` with `classify` and `ci-gate`) |
| Known issues | The audit timings file lists `rc=1` for `security-check` and `docs-check` while their logs are clean (resolve in M0.4); the audit machine could not build Docker images (buildx missing); local checkout `develop` is far behind origin (fast-forward in M0.3); local branch `chore/resume-backoffice-quality` (SHAs `bac9636`, `64ac321`) awaits the owner's decision PVB-D1 |
| Pending decisions | none: PVB-D1 to PVB-D15 and inherited E-items are resolved by delegation (`README.md` section 6) |
| Owner inputs still needed | (1) PVB-D9 and PVB-D10, the taste checkpoint on the M5 screenshots (one revision round); (2) PVB-D14, owner-only repository settings (ruleset step, Dependabot security updates off, release-please App or PAT); (3) real OAuth apps and secrets at MV; plus the per-task **[owner]** steps marked in `roadmap.md` (M0.3 branch deletion, M5.10 screen-reader pass, M7.1 and M7.3 release approvals). (Three inputs in total, plus those per-task steps.) |

## In-flight tasks

Updated on every task merge (not only at milestones). One row per task that is `in-progress` or merged since the last milestone tag; the true next task is found with the resume command of `RESUME.md` section 4a (git first, this table second).

| Task ID | Status | Branch | PR | Merge SHA | Date | Note |
|---|---|---|---|---|---|---|
| (none yet: M0.1 is `todo`) | | | | | | |

## Milestone log

| Milestone | Date | develop SHA | Scorecard snapshot | What changed | Next | Issues |
|---|---|---|---|---|---|---|
| M0 | pending | pending | baseline above | plan merged | M1.1 | |
| M1 | | | | | | |
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
| pequeverso-backoffice (this repo) | v2 written | M0 | `develop` `4d4fb9633f2d355ed80b3f05407cbd3a2a5cf5e0` | local folder `pequeverso-assistant-backoffice` |
| vps-ops | v2 written | M0 | `main` `f52c3e693250b17a2f8783f83cf1b5bf8097f238` | private, main-only; VPS not bought |
| pequeverso-marketing | v2 written | M0 | `main` `7d26bf4240c9034e339ee4545e5f883c75fd816f` | private, main-only; Spanish plan |
| dropshipping-ops | v2 written | M0 | `main` `8ff028365944ee69ef47fd7a871b1b63da4be089` | private, main-only; exploratory business line |

(SHAs read with `git -C <repo> rev-parse origin/<branch>` after `git fetch -q` on 2026-11-09; the local checkout of this repo is the folder `pequeverso-assistant-backoffice`. Each repo records its own SHA in its own `progress.md` when its plan merges; the table is drift-checked.)
