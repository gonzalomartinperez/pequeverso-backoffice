# pequeverso-backoffice: master plan v2

Date 2026-11-09 · baseline `develop` **4d4fb96** · repository `gonzalomartinperez/pequeverso-backoffice` (public; default branch `main`; integration branch `develop`; local checkout folder `pequeverso-assistant-backoffice`) · no earlier plan exists.

Planning only. Nothing in this folder authorizes code, deploy, spend or production changes; execution is decided per milestone by the owner. This folder becomes `docs/master-plan/` in the repository through a docs-only PR to `develop` (milestone M0).

## 1. Purpose

Take the Pequeverso backoffice (OAuth sign-in, access management, assistant operations dashboard, optional site-activity report) from a measured and judged baseline of 60 to 92 (most axes 70 to 86) to at least 95 on every axis of the ecosystem rubrics (floor 90 only where the VPS or a human input blocks, stated in `scorecard.md`), and keep it there with ratchets and an automatic scorecard. Three things change the most: (1) the product becomes a designed, unique workshop notebook ("El cuaderno del taller") on the shared six-destination view standard (`design-playbook.md`); (2) CI, containers and supply chain reach the ecosystem standard (dynamic profiles, `ci-gate`, SBOM, provenance, scan, release automation, one weekly Dependabot PR); (3) the test net gains mutation, property, fuzz, authorization-matrix, visual and budget gates without losing the 159 unit and 19 database tests that exist.

## 2. Owner requirements (verbatim list from `ecosystem.md` section 2.1) and repo-specific ones

1. Nine master plans (OD-01), one per repo, polished to the maximum, grounded in deep 2025-2026 research.
2. "Perpetual excellence": quality does not degrade over time (ratchets, automatic scorecard, cadences).
3. Consistent READMEs across the nine repos.
4. Assistants: a golden set of RAG questions, 100% correct as release gate.
5. Complete testing: unit, integration, mutation, E2E, contract, visual, a11y, performance, security, load, property-based.
6. Agentic harness (skills, reviewers, evals) good enough that the owner does not need to review code.
7. Use the available skills and harness.
8. First-class, consistent containers: LTS versions, same base configuration, same practices.
9. CI at the maximum: dynamic (runs only what is affected), secure, fast.
10. Dependabot identical in all nine: exactly one PR per week per repo.
11. Maximum redesign of both backoffices (designer quality, unique UI/UX, shared view/IA standard, per-project identity).
12. Master UI/UX on both public sites (not applicable to this repo; its identity and the shared standard are requirement 11).

Repo-specific (owner, 2026-11-09 and earlier): Pequeverso identity (cream and navy, warm, trustworthy, Spanish with "tú", unique and stunning, full creative freedom); the click-through **fake identity provider stays**; the backoffice never shows conversation content, buyer data, prompts or secrets; "unavailable is never zero"; Phase V (anything needing the VPS) waits for the owner's purchase and authorization; main receives releases only, hotfix with explicit OK, never `--admin`, merge only with green CI.

## 3. Method

Read-only analysis of `origin/develop` (`git ls-tree`, `git show`): AGENTS.md, README, docs, ADRs, CI and Docker files, package and lock, all source and test layout, the committed contracts; the measured baseline in `audit.md` (copied from the audit harness); the shared standard (`ecosystem.md`, `rubrics.md`, `plan-template`, Dependabot rule); research notes copied into `research/` (01, 04, 05, 06, 08, 09, 10, 11, 12, 14, 15). Every decision below has a why and a source; every target is measurable and automated (`scorecard.md`, `testing.md`, `ci-cd.md`).

## 4. Baseline summary (details in `scorecard.md` and `audit.md`)

Measured: unit 159/159, coverage lines 88.7, branches 88.8, functions 81.2; database tests 19/19; axe 0 violations on 24 captures; **`/panel/accesos` overflows horizontally at 390 px** with the e-mail wrapping per character; dashboard table clipped at 1440; **dashboard mobile TBT 2,966 ms** (performance 0.70) with Recharts at 391 KB; no image scan, SBOM, provenance or release workflow; Postgres Dockerfile without HEALTHCHECK; OpenTelemetry present; fake IdP click sign-in kept. Judged (provisional until the M3 independent re-score): D1 86, D2 82, D3 78, D4 70, D5 74, D6 60, D7 72, D8 70; P1 72, P2 70, P3 85, P4 68, P5 78, P6 78; operator lens O1 62, O2 92, O3 80, O4 85, O5 60.

## 5. Decisions

Decided by the plan (consistent with the ecosystem and owner decisions; open items are in section 6):

| ID | Decision | Why | Sources | Alternatives rejected |
|---|---|---|---|---|
| PVB-D16 | Six destinations (Resumen, Ejecuciones, Consumo, Actividad del sitio, Catálogo, Accesos) plus Cuenta, same skeleton as the sibling | One question per view fixes the 3,839 px stacked page; owner requirement 11 | `research/12` section 2, `audit.md` | Keep one page with jump chips |
| PVB-D17 | Identity "El cuaderno del taller": ruled ledger, gold marker, stamp, bookmark, margin note, taller illustrations; tokens only | Unique within the shared standard, warm, honest; `design-playbook.md` | `research/12` section 4.2, owner freedom | Generic admin theme; storefront pills everywhere |
| PVB-D18 | Tailwind 4 plus owned CVA primitives, native `<dialog>`, Popover, `<details>`; no UI library | Ecosystem O4; nothing in the kit needs a dependency | `ecosystem.md` 13, `research/12` section 2.1 (superseded on Base UI) | Base UI, Radix, shadcn registry |
| PVB-D19 | Keep the feature-folder architecture; add `server/container.ts`, `env.ts`, authz-export guard, Biome second layer; no separate `server/dal` | Already guarded and close to the target; extra layer would be ceremony | `target-state.md`, `research/01` sections 1.2, 4, 8 | Rewrite to `server/{dal,domain,...}` |
| PVB-D20 | Test runner: one spike (roadmap M2.2, S1) decides for all four TypeScript repos (DR-09): Vitest 4 preferred if StrykerJS works with TS 7, otherwise `node:test` with Stryker `tap-runner`; this repo does not pre-commit to either; c8 merges coverage | 159 fast `node:test` tests today; the same choice everywhere | `testing.md`, `research/04` section 13, DR-09 | Decide per repo; migrate without a spike |
| PVB-D21 | PR CI on Chromium plus WebKit iPhone, nightly on all engines; `ci-gate`; build once | Budget 6/12 min; ecosystem 6.0 | `ci-cd.md`, `research/05`, `research/11` | Keep four projects on every PR |
| PVB-D22 | Single weekly Dependabot multi-ecosystem PR, guard, read-only policy workflow kept | Owner rule | `shared/dependabot-rule.md` | Per-dependency PRs |
| PVB-D23 | Image: distroless nonroot, digests, SBOM, attestation, Grype, GHCR private at release only | Ecosystem 7 and 8; no deploy before owner authorization | `ci-cd.md`, `research/05` section 3, `research/11` | Publish from develop; Trivy action |
| PVB-D24 | Cookies for theme, density, time zone; no `use cache`; request id in `proxy.ts` | No flash; fresh per-user reads; observability standard | `target-state.md` section 3 | localStorage, inline script, server cache |
| PVB-D25 | Fake IdP stays as E2E, visual, Lighthouse and ZAP sign-in; production refuses it | Owner decision; real flow, no provider needed | `testing.md` | Mock sessions |
| PVB-D26 | Run detail shows only what contract 1.2 carries (time to first text, total) | Honesty; no invented stages | `design-playbook.md` section 10.2, ADR-0016 | Fake waterfall |
| PVB-D27 | Delete the superseded branch `chore/resume-backoffice-quality` after owner OK; archive evidence by tag before deleting images | Content is already in develop or older than it | `file-moves.md` section 1 | Rebase and merge |
| PVB-D28 | Skills merged into the ecosystem catalog (13 catalog skills plus one repo-specific) and the Claude Code plus Codex harness files committed in M1 | Ecosystem 15.5 and 15.6; no content of the three current skills is lost | `skills.md`, `research/14`, `research/15` | Keep three bespoke skills, no committed harness |

## 6. Open decisions: resolved by delegation (owner, 2026-11-09)

The owner delegated every open decision to the planner (`owner-decisions.md`, Delegated resolutions); each row is Resolved (delegated, 2026-11-09) as its recommendation. Owner inputs still needed (3): (1) PVB-D9 and PVB-D10, the taste checkpoint on the M5 screenshots (one revision round); (2) PVB-D14, owner-only repository settings (ruleset step, Dependabot security updates off, release-please App or PAT); (3) real OAuth apps and secrets at MV; plus the per-task **[owner]** steps marked in `roadmap.md` (M0.3 branch deletion, M5.10 screen-reader pass, M7.1 and M7.3 release approvals). (Taste is owner-only; at MV the owner steps are limited to purchase, DNS and entering secrets, OD-64.)

| ID | Question | Resolution | Why | Blocks |
|---|---|---|---|---|
| PVB-D1 | Delete the local branch `chore/resume-backoffice-quality` (2 unmerged commits, SHAs `bac9636` and `64ac321`)? | Resolved: yes, delete (owner OK required at M0.3) | Fully superseded: its lockfile change and wording are already in develop and the rest would revert newer content (`file-moves.md` section 1) | M0.3 |
| PVB-D2 | Test runner: leave it to the single spike for all four TypeScript repos (DR-09) instead of keeping `node:test` by default | Resolved (delegated, 2026-11-09): spike S1 decides (Vitest 4 if StrykerJS works with TS 7, else `node:test` + `tap-runner`) | One runner across the four repos | M2.2 |
| PVB-D3 | Replace Recharts with owned server-rendered SVG charts? | Resolved (delegated, 2026-11-09): Yes | 391 KB and 2,966 ms TBT; honesty and accessibility control | M5.7 |
| PVB-D4 | No UI library (no Base UI); native elements and owned hooks? | Resolved (delegated, 2026-11-09): Yes | Ecosystem O4; zero dependency exit cost | M5.1 |
| PVB-D5 | Ask `pequeverso-assistant-api` for optional per-run stage spans in the ops contract (expand only)? | Resolved (delegated, 2026-11-09): Yes, as a low-priority request; the UI ships without it | A real waterfall needs data the contract does not have | M4.9 |
| PVB-D6 | Show names (live join) instead of raw ids in the audit view, with "cuenta eliminada" when gone? | Resolved (delegated, 2026-11-09): Yes; the table still stores ids only | Usable audit without retaining e-mails | M4.6 |
| PVB-D7 | Add session list and revoke (own sessions, owner can revoke others)? | Resolved (delegated, 2026-11-09): Yes | IAM completeness; Better Auth supports it | M4.6 |
| PVB-D8 | Add theme, density and time-zone preferences; keep dark theme for this private app? | Resolved (delegated, 2026-11-09): Yes; ADR-0006 (single light theme) is the storefront's | Long sessions and phone use; both themes scored | M5.2 |
| PVB-D9 | Approve the illustration set and palette at the M5 taste checkpoint (one revision round)? | Owner input; delegated recommendation: Yes, owner reviews screenshots | Taste is owner-only | M5.8 |
| PVB-D10 | Allow a handwriting font subset (at most 15 KB) for the one-line margin note? | Owner input; delegated recommendation: Yes; fallback is Fraunces italic | Signature detail with a safe fallback | M5.8 |
| PVB-D11 | Format: es-AR numerals, Argentina time zone by default (UTC in tooltip and preference)? | Resolved (delegated, 2026-11-09): Yes | Owner reads in Argentina; day buckets are UTC and labelled | M5.3 |
| PVB-D12 | Define an operator lens (lens 3) for the backoffice, or take it to the standards process? | Resolved (delegated, 2026-11-09): Define it here as a repo-type note now, raise it at the next standards review | The rubric assigns lens 3 only to Pequeverso (CRO) and vps-ops (SRE) | M3.5 |
| PVB-D13 | Release as 2.0.0, image to GHCR as a private package? | Resolved (delegated, 2026-11-09): Yes, owner promotes only at M7 | Every page changes; no secrets in the image but no reason to expose it | M7 |
| PVB-D14 | Authorize the ruleset step (`ci-gate` required, then "Required checks" retired), Dependabot security-update PRs off, release-please App or PAT? | Owner input; delegated recommendation: Yes, in the two-step order | Required by the standard; owner-only settings | M1.3, M1.4, M1.10 |
| PVB-D15 | Audit-log retention? | Resolved (delegated, 2026-11-09): 13 months, enforced later by a job; no deletion now | Balances traceability and data minimization; legal facts are the owner's | MV |

Inherited ecosystem decisions that touch this repo: E1 (standards repo), E2 (Dependabot sandbox proof), E5 (release-please on develop), E7 (runner spike, DR-09), E8 (Grype), E9 (hardened-image pilot, not planned here), E10 (Node 26 move), E12, E13, E14 (token distribution).

## 7. Limits

No VPS, no real OAuth providers, no live API reading, no RUM, no real-device lab: all Phase V. Judged scores are provisional until M3. Product patterns cited in `research/12` come from the author's expertise, not fetched pages (the note says so); each hard requirement above was reduced to something this repo can test. Private GHCR attestation verification and Dependabot group behaviour are unverified until the M1 and M7 proofs. Dependency health columns are marked unverified where not fetched. Merges into `develop` use merge commits, never squash (ecosystem 15A; this repo's ruleset already allows only merge commits). The ecosystem standard gained sections 2.4, 15.5, 15.6 and 15A during planning; this plan was aligned to the version copied here.

Effort and declined review items: hours are agent estimates (S up to 4, M 4 to 12, L 12 to 40 per task; milestone headers are sums, 448 h in total, critical path 165 h, 5 to 7 weeks with three streams, assuming 6 productive agent hours per agent per day: 165 h / 6 = 27.5 working days is about 5.5 weeks on the critical path, plus review waits). Review items declined: none. The `test.fail()` mechanism of M2.6 and the Dockerfile `VERSION` default `0.0.0-dev` are plan proposals to be proven in M2.6 and M1.5.

## 8. Index

| File | Content |
|---|---|
| `README.md` | this file |
| `scorecard.md` | baseline, targets, automatic measurement, ratchets, floors, operator lens |
| `rubrics.md` | ecosystem rubrics v2 (byte-identical copy) |
| `audit.md` | measured baseline, findings P1 and P2, inventory, unmeasured items; evidence in `audit/` |
| `target-state.md` | target architecture, guard rules, typing policy, ADR list, migration order |
| `design-playbook.md` | "El cuaderno del taller" identity, shell, tokens, kit, states, views, gates |
| `testing.md` | test catalog mapped to this repo, thresholds, matrix test design |
| `ci-cd.md` and `ci-profile.json` | CI profiles, budgets, hardening, Dependabot, supply chain, containers, release |
| `file-index.csv` and `file-moves.md` | all 268 tracked files with targets; moves, deletions, branch decision |
| `standards.md` | style choices and deviations |
| `docs-and-community.md` | README outline, Diataxis map, threat model, community files |
| `skills.md` | skill audit, new skills, activation evals, review chain |
| `dependencies.md` | current and proposed dependencies with decisions |
| `readme-template.md` | README skeleton shared by all repos (byte-identical) |
| `owner-decisions.md`, `owner-decisions-existing.md` | Owner decisions register and pre-2026-11-09 decisions (byte-identical; binding) |
| `roadmap.md` | M0-M7 and MV checklists, acceptance, effort, risks |
| `ecosystem.md` | ecosystem standard (byte-identical copy) |
| `progress.md` | milestone log, starts at M0 |
| `RESUME.md` | session-independent resume brief |
| `research/` | copies of the cited research notes |
| `sources.md` | external sources and commercial-interest flags |
