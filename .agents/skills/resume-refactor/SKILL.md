---
name: resume-refactor
description: "Resumes the pequeverso-backoffice master refactor from git alone: reads docs/master-plan/RESUME.md and progress.md, checks the last checkpoint and continues with the first unchecked roadmap item. Use when a new session starts on this repository or when asked \"where were we\" or \"continue the refactor\", even if you remember earlier work. Not for starting milestones the owner has not opened or for implementing the item itself (hand it to implement-task)."
allowed-tools: Read, Grep, Glob, Bash
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# resume-refactor

## Checklist

- [ ] RESUME, progress and roadmap read; git state confirmed
- [ ] Next item identified with its acceptance and open decisions
- [ ] Handed to implement-task; nothing resumed from memory

## Procedure

1. Read `docs/master-plan/RESUME.md`, then `docs/master-plan/progress.md` (milestone, develop SHA,
   next item, known issues, pending decisions), then `docs/master-plan/roadmap.md`.
2. `git fetch --tags`; confirm `develop` is at or after the last `checkpoint/M<n>` tag and that its
   latest `ci-gate` (**Required checks**) run is green. List other worktrees with `git worktree list`
   and preserve uncommitted work; never reset or stash it.
3. Pick the first `todo` item of the lowest unfinished milestone. Read `owner-decisions.md` and
   `owner-decisions-existing.md` for anything it touches; owner-only items (OAuth apps, DNS,
   deployment, releases to `main`) stop and ask.
4. Hand the item to [implement-task](../implement-task/SKILL.md).
5. Never resume from memory or chat history; if git and the tracker disagree, trust git and record
   the discrepancy in `progress.md`.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

Current milestone, develop SHA, last checkpoint, next item, blockers and decisions pending.
