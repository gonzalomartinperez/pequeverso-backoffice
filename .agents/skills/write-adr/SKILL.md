---
name: write-adr
description: "Writes a MADR 4 architecture decision record for pequeverso-backoffice from a decision, with options, consequences and a Confirmation section, and links it from the docs. Use when a decision changes structure, a contract, a dependency, an auth or data rule, a standard or a policy, or when asked to \"record this decision\", even if the change is small. Not for meeting notes, changelog entries or implementing the decision (use implement-task)."
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# write-adr

## Checklist

- [ ] Next number found; related and superseded ADRs identified
- [ ] MADR 4 sections complete, including Confirmation
- [ ] Both-way links and docs map updated
- [ ] `npm run docs:check` passes

## Procedure

1. Take the next free number in `docs/adr/` (files are `NNN-title.md`; the master plan lists
   planned ADR topics in `docs/master-plan/target-state.md` section 6 and moves the folder to
   `docs/decisions/` in a later task: use the location and numbering that exist on `develop`).
   Read the ADRs the decision relates to: [auth](../../../docs/adr/005-backoffice-auth-better-auth.md),
   [IAM](../../../docs/adr/006-iam-in-postgresql.md), [ops data](../../../docs/adr/007-ops-data-source.md).
2. Write the ADR in MADR 4: title, status and date, context and problem, decision drivers,
   considered options with pros and cons, decision outcome, consequences, and **Confirmation**
   (how compliance is checked: a test, a lint rule, `scripts/check-boundaries.ts`, a CI job).
   Link the Confirmation to something that exists or to the task that will add it.
3. Decisions that touch owner-only matters (OAuth apps, deployment, DNS, access policy) record the
   owner's decision and its date; do not decide them. Never include secrets or private operations
   details: the repository is public.
4. When superseding, link both ways and change the old status. Update the docs map or README
   Documentation section, then run `npm run docs:check`.
5. Docs in English; commit as `docs(adr): ...` on a `docs/` task branch from `develop`, PR into `develop`.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

The ADR path, the links added and the `npm run docs:check` result.
