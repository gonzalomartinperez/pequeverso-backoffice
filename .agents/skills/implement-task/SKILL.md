---
name: implement-task
description: "Takes one ready roadmap item or backoffice change (access control, invitations, sessions, operations dashboard, pinned ops contract, UI) through the per-PR pipeline: worktree, tests first, local checks, PR into develop, review chain. Use when asked to \"implement M1.9\", \"do the next roadmap task\", \"change the backoffice\" or \"ship this item\", even if no PR is mentioned. Not for reviewing someone else's change (use review-change), the weekly dependency PR (use update-dependencies), the API repository, OAuth app setup or deployment."
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# implement-task

Procedure for `pequeverso-backoffice`. A skill is a procedure, never an authorization.

## Checklist

- [ ] [AGENTS.md](../../../AGENTS.md), the roadmap item and its acceptance read; `git status` checked, others' work preserved
- [ ] Worktree on a task branch from `develop`; one concern per PR
- [ ] Failing test first, at the right layer; invariants below intact
- [ ] `npm run check`, `npm run test:db` and `npm run test:browser` run (or reported not run)
- [ ] Review chain done; PR opened into `develop`; output template filled

## Scope

`src/features/auth`, `src/features/operations`, `src/server`, `src/app/{ingresar,invitacion,panel,api/auth}`,
`migrations/`, `contracts/`, `src/shared/ui`. Not for the API repository (read-only reference), OAuth
app setup, real credentials, DNS or deployment.

## Procedure

1. Read `docs/master-plan/roadmap.md` (item and acceptance) and `progress.md`; read
   [architecture](../../../docs/explanation/architecture.md), the ADRs on [auth](../../../docs/decisions/0005-backoffice-auth-better-auth.md),
   [IAM](../../../docs/decisions/0006-iam-in-postgresql.md) and [ops data](../../../docs/decisions/0007-ops-data-source.md),
   and [design system](../../../docs/design-system.md) for UI. Next.js 16 differs from older
   versions: read the matching guide in `node_modules/next/dist/docs/` first.
2. `git fetch` and `git worktree add ../wt/pequeverso-backoffice-<slug> -b <type>/<milestone>-<slug> origin/develop`
   (types: feat, fix, docs, test, ci, chore, build). `node_modules` is linked or restored with
   `npm ci`; `npm run setup` bootstraps a fresh clone.
3. Pick the layer: rules go to `features/auth/domain` or `application` (unit tests in
   `tests/unit/access.test.ts`); persistence to `adapters/postgres-access-store.ts` plus a **new**
   file in `migrations/` (append-only); provider and session settings to `adapters/better-auth.ts`;
   dashboard data to `features/operations/{domain,adapters}`; UI to `presentation/` with
   `src/shared/ui` and tokens. Boundaries are enforced by `scripts/check-boundaries.ts`.
4. Invariants, never weakened: Better Auth OAuth only (no passwords, no public sign-up, no
   domain-based access, no implicit linking); admission only for `OWNER_EMAIL` or a single-use
   invitation bound to the same verified e-mail, rules in `src/features/auth/application/access.ts`;
   role re-read per request and every page and server action calls `requireActor`; secrets only in
   server env, never in `localStorage`, URLs or logs; payloads from the network validated at the
   adapter; missing ops values shown as "No disponible", never zero; fixtures labelled synthetic;
   no prompts, answers, buyer data or cookies in the UI.
5. Contract change: re-pin only from a committed producer revision with `git show <sha>:<path>`,
   update `contracts/<ops|telemetry|analytics>/source.json` (sha and hashes), adapt
   the adapter validator and the synthetic fixture. Never pin from a working tree.
6. Write or extend the failing test, then implement. Keep about 400 changed lines, moves apart
   from behaviour changes. Run `npm run check:fast` while iterating.
7. Before the PR run `npm run check`, `npm run test:db` and `npm run test:browser` (ports 3241,
   8237, 8238 free); follow [verify-release](../verify-release/SKILL.md) for fixtures. For UI
   changes inspect the screenshots in `docs/verification/backoffice/` (desktop, dark, mobile).
8. Review chain: reviewer agent plus the second-model review ([review-change](../review-change/SKILL.md));
   architecture-reviewer for structural changes; reproduce every finding before acting.
9. Open the PR into `develop` from the template (what, why, evidence, risk, rollback, screenshots
   for UI) with a Conventional Commit title and the attribution footer the session requires.
   `ci-gate`, the **Required checks** context of [CI](../../../docs/ci.md), must be green on the
   exact head. Merge only when authorized; never push to `main`, release or deploy.
10. Remove the worktree after merge and tick the item in `progress.md`.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence. A task failing CI or review three times is parked with a diagnosis note.

## Output template

PR URL, CI run URL, tests added, commands run with counts (or "not run" and why), review findings
and how each was answered, what was not verified.
