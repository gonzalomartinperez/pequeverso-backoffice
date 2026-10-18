# Agent skills

The three backoffice procedures have one source in `.claude/skills`. Claude reads that
catalog directly. Codex discovers the same folders through relative directory symlinks
in the real `.agents/skills` directory:

```text
.claude/skills/
  web-change-backoffice/SKILL.md
  web-review-delivery/SKILL.md
  web-verify-backoffice/SKILL.md
.agents/skills/
  web-change-backoffice -> ../../.claude/skills/web-change-backoffice
  web-review-delivery -> ../../.claude/skills/web-review-delivery
  web-verify-backoffice -> ../../.claude/skills/web-verify-backoffice
```

Automatic selection remains the default. Naming a skill explicitly is optional. There are
no additional invocation flags, client policies or duplicated adapters. Read the selected
procedure and only the references relevant to the task. `CLAUDE.md` imports `AGENTS.md`;
repository rules and the current request still determine scope and authorization.

## Maintenance

Edit the canonical procedure, keeping its folder and frontmatter name equal. Frontmatter
supports only single-line `name` and `description` strings; descriptions state when to use
the procedure. Keep the existing change, verification and review workflows distinct and
preserve their limits. Links resolve from the canonical file. Repository scripts in code
examples resolve from the repository root, and npm commands must exist in `package.json`.

The directory links are tracked by Git. Checkouts must preserve symlinks; a copied folder,
text stub or broken link is a validation failure. Do not repair discovery by duplicating
procedure text. If a link must be restored, run from the repository root, substituting the
existing skill name:

```sh
ln -s ../../.claude/skills/web-change-backoffice .agents/skills/web-change-backoffice
```

No resource folders or client metadata are needed for the current procedures. Add a
resource only when the procedure uses it, and link it where readers need it. A deliberate
catalog expansion also updates the validator's inventory and its fixtures.

## Verification and limits

```sh
npm run skills:check
node --test tests/unit/skills.test.ts
npm run docs:check
```

The validator uses Node's standard library and runs independently of its current working
directory. It inspects real directory links, entrypoints, portable frontmatter, references,
commands, script paths, scaffolds and secret-like patterns. Negative tests create disposable
filesystem fixtures for broken/absolute/escaping links, redundant editable copies, catalog
and metadata mismatches, missing resources and unsafe content. They never execute a skill
procedure, start a database or call a provider.

The existing Quality static job runs these tests through `npm test` and the catalog check
through `npm run skills:check`. Required checks retains every existing prerequisite. These
checks establish repository structure and reference validity; they do not prove that a client
has loaded a skill, that a procedure makes the right decision, or that a requested mutation
is authorized. No claim of live client discovery follows from a filesystem check.

The paired layout was inspected in the committed portfolio backoffice reference
`a124139e1cfa1d0d496fcf76c518830491fc1679`. This repository retains its own procedures,
authentication model, operations contracts and verification evidence; no shared runtime
package or cross-repository edit is introduced.
