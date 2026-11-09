# File moves, renames, merges, splits and deletions

Source of truth for each file is `file-index.csv` (all 268 tracked files at origin/develop 4d4fb96 with layer, kind, lines, target and action). This file lists every action other than keep, edit and rewrite-in-place, with the motive. Moves are done in the milestone named in the last column, each as a short task branch with `git mv` (history preserved), links fixed by `npm run docs:check`, and the guard and `ci-profile.json` coverage test green in the same PR. Nothing here is executed by the plan itself.

## 1. Decision on the unmerged local branch `chore/resume-backoffice-quality` (PVB-D1)

Facts (read-only, 2026-11-09): local-only branch (no remote), 2 commits on top of `db3d889` (2026-10-05): `bac9636` "docs(backoffice): align review procedures and verification with private operations" and `64ac321` "build(deps): patch source-map-js to 1.2.2". `origin/develop` is 186 commits ahead of that base. Content check against `origin/develop`:

| Commit | What it changes | State at origin/develop |
|---|---|---|
| `64ac321` | `package-lock.json`: `source-map-js` to 1.2.2 | Already 1.2.2 in `origin/develop` (identical version and URL). `git cherry` shows the commit as not applied only because the surrounding lockfile differs |
| `bac9636` | wording in `CONTRIBUTING.md`, `docs/design-system.md`, `docs/dependencies.md`, `docs/coordination.md`, `.agents/skills/web-review-delivery/SKILL.md`, `biome.json` schema 2.5.15 | `design-system.md` already carries the same "retained storefront token; unused by the backoffice" wording; `biome.json` is already on schema 2.5.15; `CONTRIBUTING.md` and `coordination.md` at origin are newer (TypeScript 7 note, 2026-10-12..18 entries that the branch would delete); `dependencies.md` is replaced wholesale by this plan; the skill moved layout |

**Decision: delete the branch. It is fully superseded and merging or rebasing it would revert newer content (it deletes 46 lines of 2026-10 coordination history and re-introduces the older Node 24.21.0 and TypeScript 6 wording).** No commit contains unique information. Safety: before deleting, record the two SHAs in `progress.md` and push nothing; `git branch -D chore/resume-backoffice-quality` is a destructive local operation, so it needs the owner's explicit OK (the harness blocks it otherwise); the commits stay recoverable from the reflog for the usual period and the SHAs are noted. Alternative rejected: rebase and PR (no value, high conflict risk); keep as a branch (stale reference that invites accidental merge). Also in M0: `git switch develop && git pull --ff-only` on the local checkout (it is 186 commits behind) after verifying a clean working tree, and note the remaining stale local branches (`chore/sync-previous-release`, `feat/backoffice-product-analytics`, `build/debian13-runtime`) for the owner to prune; they were not inspected for content and are not touched by this plan.

## 2. Action table

| From | To | Action | Motive | Milestone |
|---|---|---|---|---|
| `.agents/skills/web-change-backoffice` | `.claude/skills/implement-task` | replace-link | Old directory link removed; canonical folder is `.agents/skills/implement-task`, `.claude/skills/implement-task` becomes the relative symlink (ecosystem 15.1) | M1 |
| `.agents/skills/web-review-delivery` | `.claude/skills/review-change` | replace-link | Old directory link removed; canonical folder is `.agents/skills/review-change`, `.claude/skills/review-change` becomes the relative symlink (ecosystem 15.1) | M1 |
| `.agents/skills/web-verify-backoffice` | `.claude/skills/verify-release` | replace-link | Old directory link removed; canonical folder is `.agents/skills/verify-release`, `.claude/skills/verify-release` becomes the relative symlink (ecosystem 15.1) | M1 |
| `.claude/skills/web-change-backoffice/SKILL.md` | `.agents/skills/implement-task/SKILL.md` | move-edit | Merged into catalog skills implement-task and add-metric (ecosystem 15.5); scope updated to the new layout; content preserved | M1 |
| `.claude/skills/web-review-delivery/SKILL.md` | `.agents/skills/review-change/SKILL.md` | move-edit | Merged into review-change and security-review-auth; review flags preserved verbatim; adds design review step | M1 |
| `.claude/skills/web-verify-backoffice/SKILL.md` | `.agents/skills/verify-release/SKILL.md` | move-edit | Merged into verify-release and the audit-visual, audit-accessibility, audit-performance skills; PostgreSQL-missing honesty rule preserved | M1 |
| `.github/workflows/quality.yml` | `.github/workflows/ci.yml` | rename-rewrite | Becomes ci.yml: classify + profiles + ci-gate calling standards reusable workflows; Required checks retired only after ci-gate is required | M1 |
| `CHANGELOG.md` | `CHANGELOG.md` | regenerate | Owned by release-please from M1; 1.0.0 entry preserved as history | M3 |
| `THIRD_PARTY_NOTICES.md` | `THIRD_PARTY_NOTICES.md` | regenerate | Generated from the SBOM at release; test already guards licence text | M3 |
| `docs/adr/001-one-app-two-shells.md` | `docs/decisions/0001-one-app-two-shells.md` | move | Superseded history (chat shells removed); status set to superseded (chat shells removed; ADR-0008 records the current scope); MADR path of ecosystem 14.2 | M3 |
| `docs/adr/002-typescript-7.md` | `docs/decisions/0002-typescript-7.md` | move | MADR path; add Confirmation section | M3 |
| `docs/adr/003-plain-text-answers.md` | `docs/decisions/0003-plain-text-answers.md` | move | Mostly historical (chat in storefront); mark superseded | M3 |
| `docs/adr/004-same-origin-api-and-same-site-session.md` | `docs/decisions/0004-same-origin-api-and-same-site-session.md` | move | Mostly historical; mark superseded | M3 |
| `docs/adr/005-backoffice-auth-better-auth.md` | `docs/decisions/0005-backoffice-auth-better-auth.md` | move | MADR path; linked from threat model | M3 |
| `docs/adr/006-iam-in-postgresql.md` | `docs/decisions/0006-iam-in-postgresql.md` | move | MADR path | M3 |
| `docs/adr/007-ops-data-source.md` | `docs/decisions/0007-ops-data-source.md` | move | MADR path | M3 |
| `docs/agent-skills.md` | `docs/reference/agent-skills.md` | move | Diataxis reference | M3 |
| `docs/architecture.md` | `docs/explanation/architecture.md` | move | Diataxis explanation; C4 Mermaid added; verified-history paragraphs trimmed | M3 |
| `docs/architecture/README.md` | `docs/explanation/architecture-diagrams.md` | move | Diagram index folded under explanation | M3 |
| `docs/architecture/manifest.json` | `docs/explanation/diagrams/manifest.json` | move | Diagram provenance moves with the diagrams | M3 |
| `docs/architecture/system-dark.mmd` | `docs/explanation/diagrams/system-dark.mmd` | move | Mermaid source kept | M3 |
| `docs/architecture/system-dark.svg` | `docs/explanation/diagrams/system-dark.svg` | move | Rendered asset for README picture | M3 |
| `docs/architecture/system-light.mmd` | `docs/explanation/diagrams/system-light.mmd` | move | Mermaid source kept | M3 |
| `docs/architecture/system-light.svg` | `docs/explanation/diagrams/system-light.svg` | move | Rendered asset for README picture | M3 |
| `docs/authentication.md` | `docs/explanation/authentication.md` | move | Diataxis explanation; threat model links added | M3 |
| `docs/coordination.md` | `docs/explanation/history/coordination-2026-10.md` | move | Historical log of pins and renames; out of the reading path | M3 |
| `docs/observability.md` | `docs/reference/observability.md` | move | Diataxis reference | M3 |
| `docs/postgresql-runtime.md` | `docs/how-to/postgres-runtime-and-restore.md` | move | How-to restore drill; volatile image facts removed | M3 |
| `docs/product-analytics.md` | `docs/reference/product-analytics.md` | move | Diataxis reference | M3 |
| `docs/runtime-baseline.md` | `docs/reference/runtime-baseline.md` | move | Diataxis reference; versions generated from files | M3 |
| `docs/verification.md` | `docs/explanation/history/verification-2026-10.md` | move | Dated evidence log; frozen history | M3 |
| `docs/verification/native-runtime2026-10-19.md` | `docs/explanation/history/native-runtime-2026-10-19.md` | move | Frozen history | M3 |
| `docs/verification/runtime-cohort-2026-10-17.md` | `docs/explanation/history/runtime-cohort-2026-10-17.md` | move | Frozen history | M3 |
| `scripts/backoffice-stack.ts` | `scripts/preview-stack.ts` | rename | Name matches npm run preview:backoffice and the visual/ZAP/Lighthouse jobs that reuse it | M4 |
| `src/app/globals.css` | `src/shared/tokens/theme.css` | move | Split into tokens/structure.css + pack-atelier.css (hand-authored) and generated theme.css; Tailwind import stays in globals.css | M4 |
| `src/features/auth/presentation/account-controls.tsx` | `src/shared/shell/user-menu.tsx` | move | Becomes the shared shell user menu with theme, density, sign-out | M5 |
| `src/features/auth/presentation/confirm-action.tsx` | `src/shared/ui/confirm-dialog.tsx` | move | Generic type-to-confirm dialog (native dialog) in the kit | M5 |
| `src/features/operations/presentation/dashboard.tsx` | `src/features/operations/presentation/overview/overview.tsx` | split | 647 lines split into overview, runs, usage, catalog presentation modules under 200 lines each | M5 |
| `src/features/operations/presentation/format.ts` | `src/shared/lib/format.ts` | move | Intl-based formatting with explicit time zone; shared by all features | M5 |
| `src/features/operations/presentation/telemetry.tsx` | `src/features/operations/presentation/overview/technical-status.tsx` | move | Technical observation moves into the Resumen disclosure and status strip | M5 |
| `src/server/analytics.ts` | `src/server/container.ts` | merge | Merged into the composition root | M4 |
| `src/server/config.ts` | `src/server/env.ts` | rename | Single env module; no process.env elsewhere (guard) | M4 |
| `src/server/operations.ts` | `src/server/container.ts` | merge | Merged into the composition root | M4 |
| `src/server/parse-config.ts` | `src/server/env-parse.ts` | rename | Pairs with env.ts | M4 |
| `src/shared/ui/cn.ts` | `src/shared/lib/cn.ts` | move | Kit layout: lib holds non-visual helpers; registry of custom sizes kept | M5 |
| `src/shared/ui/sections.tsx` | `src/shared/ui/sections.tsx` | split | Section/Facts/TableRegion split into Card, Facts, DataTable | M5 |
| `tests/browser/analytics.spec.ts` | `tests/browser/audience.spec.ts` | rename | Route-named spec | M2 |
| `tests/browser/backoffice.spec.ts` | `tests/browser/overview.spec.ts` | split | 538-line spec split by route and concern: auth, overview, access, a11y, telemetry, invitation, responsive; test bodies preserved | M2 |

## 3. Deletions

| Files | Count | Motive | Milestone |
|---|---|---|---|
| `docs/verification/availability-2026-10-12/**` | 30 | Dated captures of the pre-redesign UI (fixture data); the README gallery that embeds them is rewritten; history stays in git and in tag `archive/verification-2026-10` pushed first | M3 |
| `docs/verification/compact-availability-2026-10-13/**` | 30 | Same | M3 |
| `docs/verification/analytics-native-2026-10-19/**` | 4 | Same | M3 |
| `docs/verification/backoffice/**` | 10 | Same; AGENTS.md currently tells agents to inspect these, the instruction changes to the visual baselines under `tests/visual/` | M3 |
| `docs/verification/*/manifest.json`, `capture-*.json`, `README.md` | included above | Provenance of the deleted captures | M3 |
| Recharts (`recharts` in `package.json`) and `daily-charts.tsx` | 1 file plus dependency | Replaced by owned server-rendered SVG (ADR-0012) | M5 |
| Commerce tokens in `globals.css` (`--purchase*`, `--price`, `--surface-user`, `--shadow-purchase`) | tokens | Retained but unused (documented in `docs/design-system.md`); removed with the Atelier pack | M5 |
| Local branch `chore/resume-backoffice-quality` | 1 branch | Section 1 | M0 (owner OK) |

Pre-delete checklist for the evidence directories: push `archive/verification-2026-10` at the current develop SHA, confirm the new README and `docs/explanation/history/` do not link to a deleted path (`docs:check` fails otherwise), keep `docs/explanation/history/verification-2026-10.md` (text only) for the narrative.

## 4. No JavaScript files

No `.js`, `.mjs` or `.cjs` file is tracked at origin/develop (all 268 paths checked), so there is no migration to TypeScript to schedule; `quality/js-exceptions.json` starts empty and a test fails if a file with those extensions appears without an entry.
