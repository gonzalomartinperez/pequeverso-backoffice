# Agent skills

The backoffice uses the standard seven-skill catalog from `engineering-standards` v1.0.0,
tailored to this repository. Every procedure has one source in `.agents/skills`. Codex reads
that catalog directly. Claude discovers the same folders through relative directory symlinks
in the real `.claude/skills` directory:

| Skill | Purpose here |
| --- | --- |
| `implement-task` | A ready roadmap item or backoffice change through worktree, tests, checks, PR into `develop` and review chain |
| `review-change` | Independent diff review with the auth, IAM and ops-data flags; PR preparation |
| `verify-release` | Checks, database and browser suites, image smoke, screenshots, release and post-deploy evidence |
| `update-dependencies` | The weekly Dependabot PR; never merges |
| `write-adr` | MADR 4 decision records with Confirmation |
| `resume-refactor` | Continue the master plan from git, `RESUME.md` and `progress.md` |
| `score-repo` | Evidence pack against the rubrics and ratchets |

The former `web-change-backoffice`, `web-review-delivery` and `web-verify-backoffice`
procedures were merged into `implement-task`, `review-change` and `verify-release`
respectively, keeping their scope limits, review flags and the rule to report the database and
browser suites as not run when PostgreSQL is missing.

```text
.agents/skills/<name>/
  SKILL.md
  evals/triggers.json
  evals/evals.json
.claude/skills/<name> -> ../../.agents/skills/<name>
```

Automatic selection remains the default. Naming a skill explicitly is optional. There are
no additional invocation flags, client policies or duplicated adapters. Read the selected
procedure and only the references relevant to the task. `CLAUDE.md` imports `AGENTS.md`;
repository rules and the current request still determine scope and authorization.

## Maintenance

Edit the canonical procedure, keeping its folder and frontmatter name equal. Frontmatter
supports single-line `name`, `description` and `allowed-tools` strings plus one block:

```yaml
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
```

Descriptions start with the trigger ("Use when ..."), include "Not for ..." and stay within
1,024 characters. Bodies stay within 120 lines. Update `last-reviewed` whenever a procedure
is reviewed; entries older than 180 days are stale. Keep the procedures distinct and preserve
their limits: a skill is a procedure, never an authorization. Links resolve from the canonical
file. Repository scripts in code examples resolve from the repository root, and npm commands
must exist in `package.json`.

Each skill carries `evals/triggers.json` (at least 10 queries, at least 3 positive and 3
negative, validation share 30 to 50 percent, including near-misses such as deploying or
creating an OAuth app) and `evals/evals.json` (at least 3 output evals, each with a prompt and
assertions). The validator checks their shape; activation accuracy is measured with the
engineering-standards activation tooling, not by this repository's tests.

The directory links are tracked by Git. Checkouts must preserve symlinks; a copied folder,
text stub or broken link is a validation failure. Do not repair discovery by duplicating
procedure text. If a link must be restored, run from the repository root, substituting the
existing skill name:

```sh
ln -s ../../.agents/skills/implement-task .claude/skills/implement-task
```

`evals/` is the only resource folder in use. Add another resource only when the procedure uses
it, and link it where readers need it. A deliberate catalog expansion also updates the
validator's inventory and its fixtures.

## Verification and limits

```sh
npm run skills:check
node --test tests/unit/skills.test.ts
npm run docs:check
python3 tools/check_skills.py --skills .agents/skills --claude-links .claude/skills
```

The last command is the engineering-standards validator (`tools/check_skills.py` from the
`engineering-standards` v1.0.0 checkout); it is not vendored here and is optional locally.

The validator uses Node's standard library and runs independently of its current working
directory. It inspects real directory links, entrypoints, portable frontmatter, references,
commands, script paths, scaffolds and secret-like patterns. Negative tests create disposable
filesystem fixtures for broken/absolute/escaping links, redundant editable copies, catalog
and metadata mismatches, missing resources and unsafe content. They never execute a skill
procedure, start a database or call a provider.

The CI static and docs jobs run these tests through `npm test` and the catalog check
through `npm run skills:check`. Required checks retains every existing prerequisite. These
checks establish repository structure and reference validity; they do not prove that a client
has loaded a skill, that a procedure makes the right decision, or that a requested mutation
is authorized. No claim of live client discovery follows from a filesystem check.

The paired layout was inspected in the committed portfolio backoffice reference
`a124139e1cfa1d0d496fcf76c518830491fc1679`. This repository retains its own procedures,
authentication model, operations contracts and verification evidence; no shared runtime
package or cross-repository edit is introduced.
