---
name: update-dependencies
description: "Handles the weekly Dependabot PR of pequeverso-backoffice: reads changelogs, runs the Better Auth, Next.js and TypeScript breakage checks, fixes breakages on the same branch and keeps ci-gate green, leaving the merge to the owner. Use when the weekly dependency PR is open, labelled needs-fix, or the dependency policy reports it red, even if only one ecosystem broke. Not for urgent single-dependency security fixes (normal task-branch PR into develop) or for merging the PR (owner only)."
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# update-dependencies

Policy lives in [dependencies.md](../../../docs/dependencies.md): every dependency merge is manual,
labels and green checks are not merge authority, and the policy never auto-merges.

## Checklist

- [ ] PR body and policy summary read (versions per ecosystem: npm, Actions, Docker)
- [ ] Changelog read for every major, framework, runtime or browser-engine bump
- [ ] Fixes committed on the Dependabot branch; `npm run check` and `npm run test:db` green
- [ ] Summary for the owner written; nothing merged

## Procedure

1. Read the PR body, the dependency-policy job summary and the diff of `package.json` and
   `package-lock.json`. Never run `npm install`; use `npm ci` after checking out the branch.
2. For each major or elevated bump read the upstream changelog and list breaking changes that touch
   this repository. Better Auth (admission, linking, sessions), Next.js 16 (read
   `node_modules/next/dist/docs/` after the bump), TypeScript 7, Biome and Playwright need the most care.
3. Fix breakages on the Dependabot branch in small commits (this stops Dependabot rebases).
   Do not weaken an invariant (OAuth only, `requireActor`, no implicit linking) to make a bump pass.
4. Run `npm run check`, `npm run test:db` and, for Next, Better Auth or browser-engine bumps,
   `npm run test:browser`. Keep `ci-gate` (**Required checks**) green on the exact head.
5. Docker base-image bumps: check the Grype image gate in [CI](../../../docs/ci.md); a new fixable
   advisory can turn the container job red without a code change.
6. Never approve, merge, re-label or arm auto-merge. Re-target security updates against `main` to
   `develop`. Authorized maintainers merge after review and required checks.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

Summary for the owner in the PR description: bumps, breaking changes handled, commands run with
results, what was not verified.
