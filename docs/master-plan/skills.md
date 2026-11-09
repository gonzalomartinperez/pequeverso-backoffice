# Skills and agent harness

Applies `ecosystem.md` sections 15.1 to 15.6 and 15A, `research/08` sections 5.3 to 5.5, `research/14` (Codex) and `research/15` (Claude Code). Current state at origin/develop: three skills (`web-change-backoffice` 32 lines, `web-review-delivery` 34, `web-verify-backoffice` 33), a stdlib validator `scripts/check-skills.ts` (170 lines) with negative filesystem tests (`tests/unit/skills.test.ts`), skills canonical in `.claude/skills/<name>/SKILL.md` with relative directory links in `.agents/skills/` (the reverse of the standard, which is canonical `.agents/skills` because Claude Code reads only `.claude/skills` while Codex reads `.agents/skills`, `research/15`). No `.claude/settings.json`, hooks, agents, `.codex/config.toml`, `.mcp.json` or agent-review workflow are tracked.

## 1. Audit of existing skills and where their content lands

Rule of the catalog: existing skills are audited first and merged or renamed; nothing is deleted without its content landing.

| Existing skill | Strengths to keep | Gaps | Lands in |
|---|---|---|---|
| `web-change-backoffice` | Clear scope, ADR pointers, "not for the API repo, OAuth app setup or deployment" boundary | Old layout paths; no metadata or evals; no kit, tokens, states, authz-matrix or ratchet steps | `implement-task` (repo-flavoured per-PR pipeline) and `add-metric` (new metric or view with "unavailable is not zero") |
| `web-review-delivery` | Concrete review flags: admission without verified e-mail, implicit account linking, missing server-side role check, mutations without transactional owner re-check, secrets or sessions in browser or logs, unvalidated ops payloads, public access to private pages | No design review, no ratchet or scorecard step, no second-model step | `review-change` (flags kept verbatim) and `security-review-auth` |
| `web-verify-backoffice` | Honest: stops and reports "not run" when PostgreSQL is missing | No visual, overflow, Lighthouse or scorecard steps; examples use raw docker | `verify-release` plus `audit-visual`, `audit-accessibility`, `audit-performance` |

## 2. Layout and skill rules

Flip the direction in M1: canonical `.agents/skills/<name>/SKILL.md`; `.claude/skills/<name>` is a per-skill relative symlink to `../../.agents/skills/<name>`. `scripts/check-skills.ts` and `skills.test.ts` are updated first (the old direction fails), then the files move in the same PR; the validator also verifies every symlink resolves. Rules (ecosystem 15.1 and 15.5): `name` equals the directory (at most 64 characters, lowercase and hyphens); description starts "Use when ..." and states "Not for ...", key trigger first, at most 1,024 characters; body at most 120 lines (hard cap 500), checklist, step-by-step procedure with exact commands, output template, feedback loop (verify, fix, re-verify), references one level deep, allowed tools listed; fragile steps in `scripts/`; `metadata: {owner, last-reviewed, version}`; no secrets or network calls; third-party skills reviewed before install.

## 3. Skill set for this repository (catalog 15.5)

| Skill | Class | Purpose here |
|---|---|---|
| `implement-task` | core | Take a ready roadmap item through the per-PR pipeline: worktree, tests first, kit and states, PR template, review chain |
| `review-change` | core | Independent review of a diff against the rubric; reproduce every finding |
| `verify-release` | core | Release-profile checks, changelog, tag, image attestation verify, `vps-ops` pin PR; never merges, never deploys |
| `update-dependencies` | core | Handle the weekly Dependabot PR: read changelogs, run Better Auth advisory tests, fix breakage on the branch, keep CI green |
| `write-adr` | core | MADR 4 ADR (0008 to 0019 listed in `target-state.md`) with Confirmation |
| `resume-refactor` | core | Read RESUME, progress and the tracker; continue the next item |
| `score-repo` | core | Run `scripts/scorecard.ts`, compare with ratchets, build the three-lens evidence pack for the evaluator |
| `audit-visual`, `audit-accessibility`, `audit-performance` | web | Screenshots 320 to 1920 both themes and engines; axe, keyboard, zoom, forced colors; Lighthouse median of 5, bundle and frame-time |
| `evolve-design-system` | web | Change tokens, kit components, illustrations with contrast checks, kit lock and baselines (applies `design-playbook.md`) |
| `add-metric` | backoffice | New metric or view: `Metric` state set, messages dictionary, chart twin, authz matrix row, baselines |
| `security-review-auth` | backoffice | Auth, RBAC, CSRF and session review using the matrix and `research/04` section 12 |
| `refresh-contract` (consumer variant) | repo-specific | Refresh a pinned contract (ops, telemetry, analytics): fetch producer files at a SHA, verify SHA-256, update `source.json`, run validators and fuzz |

Not applicable here: `change-content`, `animate-scene` (sites), `evaluate-assistant`, `change-prompt` (APIs), `operate-release`, `restore-drill`, `harden-host` (vps-ops). A skill is a procedure, never an authorization.

## 4. Activation evals

Each skill has `evals/triggers.json` (at least 10 queries, this plan asks for about 20: 8 to 10 positive and 8 to 10 near-miss negatives, fixed 60/40 train and validation split) and `evals/evals.json` (at least 3 output evals with assertions, run with and without the skill). Protocol: 3 runs per query on a clean context; a positive passes at trigger rate 0.5 or more, a negative below 0.5; report precision and recall on the validation split only. Gate in the harness profile: no merge if validation trigger accuracy drops more than 10 points or the output delta turns negative. Near-misses written for this repo: "add a column to the members table" (data change; not `add-metric`), "deploy to the VPS" (owner-only), "update the storefront price" (other repo), "create a new OAuth app" (owner-only).

## 5. Committed harness files (ecosystem 15.6; M1)

| Path | Content for this repo |
|---|---|
| `AGENTS.md` (at most 200 lines) | Skeleton of `docs-and-community.md` section 5; commands tested against `package.json` |
| `CLAUDE.md` | `@AGENTS.md` plus Claude-only lines (skills to run before done, subagents to use) |
| `.claude/settings.json` | Allow: lint, types, tests, build, read-only `gh` and `git`; ask: push, merge; deny: force push, `rm -rf`, reading `.env*`; hooks wired; marketplace from `engineering-standards` |
| `.claude/hooks/` | `format` (PostToolUse Edit and Write), `guard-files` (block lockfiles, `.env*`, secrets, applied migrations), `guard-bash` (force push, reset --hard, `rm -rf` outside temp, DROP DATABASE, docker prune or `down -v`, `pkill -f`), `fast-check` on Stop with a loop guard (`npm run check:fast`, under 60 s) |
| `.claude/agents/` | `test-runner` (haiku), `reviewer` (sonnet, high), `architecture-reviewer`, `designer-evaluator` (screenshots both themes, rubric P1 to P6 and the operator lens); read-only except implementers with `isolation: worktree` |
| `.codex/config.toml` | `approval_policy = "on-request"`, `sandbox_mode = "workspace-write"`, network off, hooks on with the same guards, MCP without secrets; validated against the installed Codex version (`research/14` marks keys unverified) |
| `.mcp.json` | Playwright and next-devtools only; no secrets |
| `.worktreeinclude` | Non-secret local files only (never `.env*`) |
| `.github/workflows/agent-review.yml` | On PR: Codex review as second opinion (GitHub connector or `openai/codex-action` with `drop-sudo`), Claude review on request, minimal permissions, turn and budget caps, nothing for fork PRs; belongs to the `workflow` CI profile |

Division of labour (ecosystem 15.6): Claude orchestrates, plans, designs, reviews and decides; Codex takes well-scoped mechanical work in worktrees on its own quota and gives the independent second-model review; every Codex diff is reviewed by Claude before merge and every Claude diff gets a Codex review. Safety hooks and deny rules repeat in the repo because plugin agents ignore hooks.

## 6. Review chain and execution (ecosystem 15.2 and 15A)

Definition of ready for a task: linked roadmap item, measurable acceptance, affected files from `file-index.csv`, tests to add named, CI profile known, cross-repo dependency resolved. Slicing: one concern per PR, at most 400 changed lines excluding generated files and snapshots, moves separate from behaviour changes, branch `<type>/<milestone>-<slug>` from fresh `origin/develop`. Pipeline: implementer in a worktree, test-runner locally, PR from the template (what, why, evidence, risk, rollback, screenshots for UI), `ci-gate`, independent reviewer plus second-model review plus architecture review for structural PRs (M4 moves, kit sync, IAM use cases, contract pins; `--task adversarial` for auth and migrations) plus designer evaluator for UI, merge by the orchestrator only on green CI. Auth, migrations, CSP and sessions use the strongest agents from the start. A task failing CI or review three times is parked with a diagnosis note. The designer evaluator sees screenshots, the rubric and `design-playbook.md`, never the author's reasoning.

## 7. Rot control

Monthly `last-reviewed` staleness check (180 days opens an issue); lines that never change agent behaviour are deleted; hard rules go to hooks and `permissions.deny`, not prose; an agent failing twice at the same thing gets a script, lint rule or hook first and prose last; a test compares backticked commands in `AGENTS.md` with `package.json`.
