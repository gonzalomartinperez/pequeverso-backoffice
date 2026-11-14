---
name: score-repo
description: "Runs the pequeverso-backoffice quality evidence pass, compares it with the committed ratchet baselines and assembles the three-lens evidence pack against docs/master-plan/rubrics.md. Use when preparing a milestone safe point or a release, or when asked for the score or quality status of the repo, even if CI is green. Not for fixing the findings (use implement-task)."
allowed-tools: Read, Grep, Glob, Bash
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# score-repo

## Checklist

- [ ] Rubric and scorecard read; baselines located
- [ ] Measured evidence per axis; unmeasured axes named as gaps
- [ ] Regressions against baselines listed
- [ ] Nothing fixed or loosened during scoring

## Procedure

1. Read `docs/master-plan/rubrics.md` and `docs/master-plan/scorecard.md`. The scorecard script and
   `quality/ratchets/*.json` are delivered by roadmap item M2.10; until they exist on `develop`
   (check with `ls quality`), collect evidence by hand and say so in the report.
2. Run the evidence commands: `npm run check` (lint, types, unit, knip, public-file, docs and
   skills checks, build), `npm run test:db`, `npm run test:browser`. Report counts, not just
   pass or fail, and mark any suite that could not run as "not run".
3. Compare each axis with the baseline files once they exist; any loosening of a ratchet is a
   finding. Never edit baselines while scoring.
4. Collect an evidence link per rubric criterion (CI run, screenshot in `docs/verification/backoffice/`,
   test name, file:line). A criterion without evidence is unmet.
5. Build the three lenses for the evaluator: engineering (checks, coverage, boundaries), product
   and design (screenshots both themes, mobile, "No disponible" states), and operator (what the
   owner can verify without reading code). Evidence is facts, never the author's reasoning.
6. Do not pad: a measured gap is reported as a gap. Nothing here deploys, merges or authorizes.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

Score per axis, regressions against baselines, evidence links, named gaps and what was not run.
