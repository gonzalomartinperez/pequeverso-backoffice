# Agent harness

Committed configuration for Claude Code and Codex, from the engineering-standards harness
v1.0.0 and tuned to this repository. Skills are described in [agent-skills.md](agent-skills.md).

| File | Purpose |
|---|---|
| `CLAUDE.md` | Imports `AGENTS.md` only (`scripts/check-skills.ts` requires exactly `@AGENTS.md`) |
| `.claude/settings.json` | Allow: lint, typecheck, tests, knip, docs and skills checks, build, `test:db`, `test:browser`, read-only `git` and `gh`. Ask: push, merge, release. Deny: force push, `reset --hard`, `rm -rf`, reading `.env*`. Wires the guard hooks and a Stop hook that runs `npm run check:fast` once per stop (`stop_hook_active` loop guard) |
| `.claude/hooks/guard-bash.py`, `guard-files.py` | Byte-matched to engineering-standards through `standards.lock`; do not edit here |
| `.claude/agents/` | Read-only `reviewer`, `architecture-reviewer`, `designer-evaluator` and `test-runner`; `docs-updater` edits Markdown in a worktree |
| `.codex/config.toml` | `on-request` approval, `workspace-write` sandbox, network off. Hooks stay commented out because the hook schema is unvalidated for the installed Codex |
| `.mcp.json` | Playwright (isolated, headless) and next-devtools only, pinned versions, no secrets |
| `.worktreeinclude` | Non-secret local files copied into worktrees; currently none |

`.github/workflows/agent-review.yml` (model-assisted PR review) is not part of this set; it needs a
paid model token and an owner decision.

## Claude-only guidance

- Subagents in `.claude/agents/`: `test-runner` for checks, `reviewer` before any commit or PR,
  `architecture-reviewer` for structural, contract, auth or migration changes, `designer-evaluator`
  for UI (both themes, rubric P1 to P6, operator lens), `docs-updater` after behavior changes.
- Run `npm run check:fast` before saying a task is done; the Stop hook repeats it once and blocks on failure.
- Hooks block force pushes, `rm -rf` outside temp, `.env*`, lockfile and secret edits; do not work
  around a block, ask the owner.

## Verify the hooks

The guards read the event JSON on stdin and exit 2 with a message on stderr to block:

```sh
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push --force origin develop"}}' \
  | python3 -I .claude/hooks/guard-bash.py; echo "exit=$?"
echo '{"hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":".env.local"}}' \
  | python3 -I .claude/hooks/guard-files.py; echo "exit=$?"
```

Both must print a `BLOCKED by ...` line and `exit=2`. A harmless command such as
`npm run check:fast` must exit 0. Check the JSON files with
`python3 -c "import json;json.load(open('.claude/settings.json'));json.load(open('.mcp.json'))"`.
