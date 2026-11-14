---
name: review-change
description: "Reviews a pequeverso-backoffice diff independently for correctness, security, accessibility, contracts, docs and verification evidence, reproducing every finding, and prepares its PR into develop. Use when asked to \"review this PR\", \"check this diff\", \"second look before merge\", or before committing a non-trivial change, even if the author already reviewed it. Not for writing the fix, style-only feedback, merging into main or deploying."
allowed-tools: Read, Grep, Glob, Bash
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# review-change

Read-only review. Never push to `main`, merge a release, deploy, bypass rulesets or approve on
the author's behalf without the owner's explicit authorization for that action.

## Checklist

- [ ] Diff against `develop` read; auth, IAM and ops-data ADRs consulted
- [ ] Every flag in step 2 checked
- [ ] Evidence for `npm run check`, `npm run test:db`, `npm run test:browser` confirmed
- [ ] Each finding reproduced or marked unverified; blockers separated from suggestions

## Procedure

1. Get the diff (`git diff origin/develop...HEAD` or `gh pr diff <n>`) and the PR description;
   ignore the author's reasoning. Read the ADRs on [auth](../../../docs/decisions/0005-backoffice-auth-better-auth.md),
   [IAM](../../../docs/decisions/0006-iam-in-postgresql.md) and [ops data](../../../docs/decisions/0007-ops-data-source.md).
2. Flag admission without a verified e-mail or presented invitation, implicit account linking,
   missing server-side role checks (`requireActor` on every page and server action), mutations
   without transactional owner re-checks, secrets or sessions exposed to the browser or logs,
   unvalidated ops payloads, and public access to private pages. Also flag: passwords or
   domain-based access, admission rules moved into UI code, missing values rendered as zero instead
   of "No disponible", fixtures not labelled synthetic, and prompts, answers or buyer data rendered.
3. Confirm evidence for `npm run check`, `npm run test:db` and `npm run test:browser`. For UI
   changes inspect desktop, dark and mobile screenshots in `docs/verification/backoffice/`; check
   keyboard use, focus restoration, overflow, contrast and reduced motion. Require reproducible
   evidence for defects.
4. Keep architecture, authentication, design system, deployment contract, pinned contracts and
   coordination docs accurate. Migrations are append-only; contracts come only from an identified
   committed API revision and `source.json` hashes must match.
5. Standards: Conventional Commit title, docs and `CHANGELOG.md` touched when behaviour changed,
   tests exercise the change, no workflow permission widened.
6. Reproduce each finding with a failing test, a command or a quoted line; drop what you cannot
   reproduce or mark it unverified. Report by severity with file:line, scenario and fix.
7. Review chain (structural, auth, migration or UI changes): reviewer agent, then the Codex second
   opinion (advisory; reproduce its findings), architecture-reviewer for structural changes, and
   `--task adversarial` for auth and migrations; a designer pass with screenshots for UI.
8. Dependency PRs: follow [dependencies.md](../../../docs/dependencies.md). The policy only assesses
   metadata; authorized maintainers merge manually after review and required checks. Never approve,
   merge or re-label to circumvent those gates; re-target security updates against `main` to `develop`.
9. Branch flow is a working agreement: task branches into `develop`; only `develop` into `main` at
   release with the owner; a `hotfix/*` into `main` only with the owner's explicit authorization,
   then merged back into `develop`. `ci-gate` (**Required checks**) must be green on the exact head.
10. PR preparation: open against `develop` with a Conventional Commit title, verification notes and
    the attribution footer the session requires.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

Findings table (severity, file:line, scenario, fix), blockers versus suggestions, then Confidence
and Escalate lines.
