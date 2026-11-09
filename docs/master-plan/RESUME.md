# RESUME: pequeverso-backoffice master plan

Self-contained brief for any Claude account, machine or agent with no access to earlier chats. Nothing is resumed from memory: everything is in git.

## 1. What this is

The Pequeverso backoffice (`gonzalomartinperez/pequeverso-backoffice`, local checkout often named `pequeverso-assistant-backoffice`) is a private Next.js app (public repository) where the owner signs in with Google or GitHub (Better Auth, PostgreSQL IAM), reads the shopping assistant's operations (health, spend, catalog state, runs, optional site activity) from a private API and manages who has access. It shows no conversation content. The **master refactor** is a nine-repo effort (portfolio, portfolio-assistant-api, portfolio-backoffice, pequeverso, pequeverso-assistant-api, pequeverso-backoffice, vps-ops, pequeverso-marketing, dropshipping-ops) governed by a shared standard (`ecosystem.md`) and scored by `rubrics.md`. This repo's plan (this folder, `docs/master-plan/`) raises every rubric axis to at least 95 (floor 90 where the VPS or a human input blocks), redesigns the product as "El cuaderno del taller" on the shared six-destination view standard, brings CI, containers and supply chain to the standard, and adds a full test net. All work lands on `develop`; `main` is touched only at M7.

## 2. Where we are

Read `progress.md` first: current milestone, develop SHA, scorecard snapshot, next item, known issues, pending decisions. At the time of writing (2026-11-09) the plan is drafted, M0 (merge of this folder to `develop`) is pending, and develop was at `4d4fb96`.

## 3. Read order

1. `progress.md`, then `README.md` (decisions and open questions).
2. `roadmap.md` (find the first `todo` task of the lowest unfinished milestone; use the resume command of section 4a to confirm against git).
3. `owner-decisions.md` and `owner-decisions-existing.md` (binding registers; read before acting on anything they cover), then `ecosystem.md` (sections 3, 3A, 5, 6, 8, 11, 13, 15 matter most) and `rubrics.md`.
4. The files the item touches: `testing.md`, `ci-cd.md` and `ci-profile.json`, `design-playbook.md`, `target-state.md`, `standards.md`, `skills.md`, `dependencies.md`, `file-index.csv` and `file-moves.md`.
5. The repository's own `AGENTS.md`, `CLAUDE.md`, `docs/` (its rules win over this plan only where the plan says "deviation"; otherwise the plan refines them).
6. `audit.md` and `audit/` for the measured baseline; `research/` for the reasoning.
7. The ecosystem tracker (`engineering-standards/progress/ecosystem.md`, or `vps-ops` until that repo exists) and each sibling's `progress.md` when an item has a cross-repo dependency (contracts from `pequeverso-assistant-api`; kit from `portfolio-backoffice`; digest pin PR to `vps-ops`).

## 4. First commands

```bash
cd ~/projects/github/gonzalomartinperez/pequeverso-assistant-backoffice   # folder name may differ; remote is gonzalomartinperez/pequeverso-backoffice
git fetch -q && git status --short                                       # preserve other agents' uncommitted work; never reset or stash it
git switch develop && git pull --ff-only                                 # only with a clean tree
git tag --list 'checkpoint/*'                                            # last safe point
sed -n 1,60p docs/master-plan/progress.md                                # (before M0 is merged, read the plan folder in the reports workspace)
nvm use && npm ci && npm run check                                       # baseline: lint, types, unit, guard, docs, skills, build
# Database and browser suites need a disposable PostgreSQL (see docs/how-to/run-the-checks.md, or CONTRIBUTING.md before M3):
#   npm run test:db   and   npm run test:browser

```

## 4a. Resume command: find the true next task mid-milestone

```bash
git fetch -q
git log --oneline origin/develop --grep '\[M[0-9]*\.[0-9]*\]' | head -30      # finished task IDs (PR titles end with [M<n>.<k>])
gh pr list --state all --search '[M2.' --json number,title,state,mergedAt        # replace M2. with the milestone prefix
sed -n 1,60p docs/master-plan/progress.md                                         # In-flight tasks
# next task = first `todo` row of the lowest unfinished milestone in docs/master-plan/roadmap.md whose dependencies are done

```

An `in-progress` row with no open PR and no branch is reset to `todo`.

**If E1 slips** (the `engineering-standards` repository does not exist yet): vendor the reusable workflows from the plan's templates into `.github/workflows/` unchanged, mark `standards.lock` as vendored, and reconcile when E1 exists (`ci-cd.md` section 5). Do not wait on E1 for M1.2.

## 5. Ready-to-paste prompt

```
You are resuming the master refactor of the pequeverso-backoffice repository (gonzalomartinperez/pequeverso-backoffice).
You have no chat history. Everything you need is in git.
1. cd to the checkout, git fetch, switch to develop (clean tree only), pull --ff-only.
2. Read docs/master-plan/RESUME.md, then progress.md, README.md, roadmap.md, ecosystem.md, rubrics.md, and the repo's AGENTS.md.
3. Find the true next task (the resume command in RESUME.md section 4a, then the first `todo` row in roadmap.md) and do only that task on a short task branch
   named <type>/<milestone>-<slug> (types: feat fix chore docs ci test build), at most 400 changed lines, with Conventional Commits. Open a PR into develop; never push to develop or main.
4. Before the PR run npm run check (and test:db, test:browser when relevant). Run the review chain in docs/master-plan/skills.md section 6
   (independent reviewer agent; Codex second opinion if available; architecture review for structural changes).
5. Merge only with green CI: gh pr checks --watch && gh pr merge   (never chain with ';', never --admin).
6. Set the task Status to `done (PR #, SHA)` in roadmap.md and update progress.md "In-flight tasks"; at a milestone exit update progress.md and push the annotated tag checkpoint/M<n> on develop.
7. Stop and ask the owner for anything listed under "Owner-only decisions". Report at the end in Spanish, concisely.
Rules that never bend: GitHub identity gonzalomartinperez only (never the secondary account); no secrets in git, images, logs or docs;
UI copy in neutral Latin American Spanish with "tu"; repository docs in English; never pkill -f (kill by verified PID);
no deploy, spend, DNS or production action without explicit owner authorization.
```

## 6. Owner-only decisions (ask, never assume)

PVB-D1 to PVB-D15 are Resolved (delegated, 2026-11-09; `README.md` section 6). Owner inputs still needed (3): (1) PVB-D9 and PVB-D10, the taste checkpoint on the M5 screenshots (one revision round); (2) PVB-D14, owner-only repository settings (ruleset step, Dependabot security updates off, release-please App or PAT); (3) real OAuth apps and secrets at MV; plus the per-task **[owner]** steps marked in `roadmap.md` (M0.3 branch deletion, M5.10 screen-reader pass, M7.1 and M7.3 release approvals). Inherited E1 to E14 of `ecosystem.md` section 19 are resolved as recommended. Always owner-only (ecosystem 15.4): production activation (VPS purchase, deploy, enabling anything), any spend (live model runs, paid tools, VPS), legal and commercial facts, promotion `develop` to `main`, hotfix authorization, manual merge of the weekly Dependabot PR, granting scopes (tokens, GitHub App, Coolify, OAuth apps), accepting a vulnerability exception, changes to the standard's decisions log, repository ruleset and setting changes, deleting branches or tags, taste approvals (illustrations, palette, margin-note font), the label and wording of anything the public sees.

## 7. Non-negotiable rules

- Flow: task branch, PR into `develop`, green `ci-gate` (until M1.3 completes the swap, green "Required checks"), merge commit (no squash) with a Conventional Commit PR title; `main` receives only the M7 release PR; no hotfixes before M7 (OD-11, DR-01); never `--admin`, no bypass actors, never force-push to `main` or `develop`.
- Merge only with green CI using `gh pr checks --watch && gh pr merge`; never chain with `;`.
- No secrets: `.env.local` is gitignored; no tokens, keys, cookies or customer data in commits, images, logs, screenshots or docs; the fake IdP and mock ops data are synthetic and labelled so.
- Dependabot: exactly one PR per week with all ecosystems (Monday 09:00 America/Argentina/Buenos_Aires, target `develop`); never a second open Dependabot PR; security-update PRs stay off; urgent fixes are a normal task PR bumping one dependency.
- Backoffice invariants: access only through Better Auth OAuth, role re-checked server-side on every page and action, operations data only from the pinned contracts and validated at the adapter, unavailable is never zero, no conversation content, no provider key in the app.
- Audience and domain: UI copy Spanish (es-419, tú); only pequeverso.com contacts, never `digitalproductsteam.com` (OD-53).
- Never `pkill -f` (it kills your own shell and other agents' watchers); kill by a verified PID.
- GitHub identity: `gonzalomartinperez` only in commits and `gh`; never the secondary account.
- A skill is a procedure, never an authorization. Preserve other agents' uncommitted work; never reset or stash it.
- Planning documents are not authorization: execution happens milestone by milestone with the owner's go-ahead. Merge each docs or code PR only after the review chain is recorded.
