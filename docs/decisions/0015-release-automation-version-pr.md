# ADR 015 — Release automation with a version-bump PR

**Status:** accepted (2026-11-22). Implements OD-78 and supersedes the App-gated `release-please`
setup documented in the [original CI plan](../master-plan/ci-cd.md#9-release-automation-ecosystem-32).

## Context and problem statement

The previous workflow could only open its version-bump PR with a GitHub App because PRs opened
with `GITHUB_TOKEN` do not start CI on their own (a maintainer must approve each run), so the
required `ci-gate` would not run unattended, and no App or PAT has been granted.
OD-78 adopts [engineering-standards ADR 0003](https://github.com/gonzalomartinperez/engineering-standards/blob/main/docs/decisions/0003-release-automation-without-release-please.md).

## Considered options

- Use an App to create the version-bump PR automatically. This requires a separate credential
  and owner approval.
- Review the version and changelog in a normal PR, then publish from `main`. This reuses the
  existing CI and branch protections and lets the workflow use the built-in token.

## Decision outcome

1. Open a version-bump PR on `develop`. Set the version in `package.json`, sync the root lockfile's
   version metadata and move the reviewed `Unreleased` entries into a dated `## [X.Y.Z]` section.
2. Promote `develop` to `main` through the existing owner-approved release PR.
3. On the push to `main`, [release.yml](../../.github/workflows/release.yml) reads the version and
   changelog via [release-notes.ts](../../scripts/release-notes.ts), creates tag `vX.Y.Z` on the
   merge commit with the create-only refs API (it never re-targets an existing tag) and publishes
   the section as a GitHub Release with `--verify-tag`. Immutable releases and a `v*` tag
   ruleset are owner-only repository settings; on 2026-11-22 neither is enabled (only the
   `protect-main` and `protect-develop` branch rulesets exist), so they are listed as owner inputs. See the [CI release procedure](../ci.md#release-automation).

## Consequences

- Release notes are curated and reviewed with the version change. The release job uses only
  `GITHUB_TOKEN` with `contents: write`.
- An existing published release stays in place, including for versions without a matching
  section. A missing section without a published release fails the workflow. The owner resolves
  drafts and tags without a release, or prepares a new version.
- No release exists yet and `CHANGELOG.md` has no `## [1.0.0]` section, so the first release
  (M7) needs a version-bump PR (2.0.0 for the redesign, PVB-D13) before `develop` reaches `main`; otherwise the
  workflow fails by design.
- GHCR publication for the backoffice image is separate M7 work. Deployment requires its own
  authorization.

## Confirmation

The [release tests](../../tests/unit/release.test.ts) check the changelog format and extraction,
version validation and the workflow trigger and pins. The [CLI tests](../../tests/unit/release-cli.test.ts)
check the output contract for both present and missing notes and cover usage and write errors.
