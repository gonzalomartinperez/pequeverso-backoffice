# Continuous integration

The paired backoffice CI core is implemented in
[quality.yml](../.github/workflows/quality.yml), named **Quality**. Its final **Required checks**
context remains unchanged. Existing repository rules require that context; this change does not
alter rulesets, approvals or branch settings. Changes follow task branch → `develop` → `main`.

| Job ID | Check name | Prerequisites | Verification |
| --- | --- | --- | --- |
| `workflows` | Workflow validation | None | SHA-pinned actionlint and zizmor |
| `secrets` | Secret scan | None | Redacted full-history secret scan |
| `static` | Static checks | None | Locked dependency audit, Biome, type checking, unit/contract/architecture tests, public-file/docs/skill checks |
| `database` | Database tests | `static` | Mandatory PostgreSQL migrations and IAM integration suite |
| `container` | Container verification | `static` | Production app image smoke and PostgreSQL artifact/restore verification |
| `browser` | Browser tests | `static` | Production build, disposable PostgreSQL, fake identity provider and synthetic private operations data |
| `checks` | Required checks | All six jobs above | Always runs; every explicit result must equal `success` |

Workflow validation, secret scanning and static checks run independently. Database, container and
browser jobs use independent fixtures and run after static checks; none consumes a different job's
image or database. Each checkout verifies its source SHA against the event SHA and records that SHA, workflow
revision, run ID and (for PR events) head/base SHAs. A synthetic PR merge SHA is distinct
from its PR head and from the later main merge commit. Container smoke uses
the image built within that same job, and browser tests use that job's own production build.
There is no cross-job artifact transfer or claim that separate builds are the same image digest.

Pull requests targeting `develop` or `main`, pushes to either branch and manual dispatch run this
profile. Only obsolete PR runs are cancelled. Production deployment, image publication, real OAuth,
model calls and paid services are not part of this workflow. The default token has no permissions;
checkout jobs receive only repository read access and do not persist credentials. Build records are
not uploaded. Dependency/browser caches contain downloaded tooling, not session data or environments.

## Coverage and local verification

The existing browser configuration retains four projects across Chromium, Firefox and WebKit,
including mobile Chromium. The recorded pre-change suite inventory is 54 browser IDs: 51 exercised
and three explicitly gated real-API cases skipped. The owner reported 122 unit and 19 database tests
before this CI change. Those are historical results, not results of a new workflow run; the added
CI policy tests also change the unit-test count. No browser test, project, command or skip condition
is removed by this profile alignment. Fake-provider tests do not verify real provider credentials.

Run `nvm use` and `npm ci`, then:

```sh
npm run check
npm run test:db
npm run test:browser
```

Database and browser verification require their documented isolated fixtures; see
[verification.md](verification.md). Container smoke remains in the hosted container job. A
source-only review or local policy-test pass does not establish database, browser or container
success. Hosted checks must pass on the exact proposed head and again after integration before
reporting the new workflow verified.

The unit suite includes [ci-profile.test.ts](../tests/unit/ci-profile.test.ts). It checks exact job
IDs/names/dependencies, rejects optional database coverage and cross-workflow status-name collisions,
and executes the fixed aggregate shell gate against success, failure, cancellation, skip, pending,
empty and missing results. Its bounded source-shape assertions supplement actionlint/zizmor; they
are not a general YAML parser or a substitute for GitHub's actual required-check enforcement.

The [skill catalog validator](../scripts/check-skills.ts) runs in the existing static
file/docs/skills step. Its [filesystem negative cases](../tests/unit/skills.test.ts) run
through the existing `npm test` unit glob before that step. They check actual directory
links and resources without executing procedures or contacting services. See
[agent skills](agent-skills.md) for the canonical catalog and limits. No new job,
optional gate, permission or status context is introduced.

## Dependencies and check-name maintenance

[Dependency policy](../.github/workflows/dependency-policy.yml) remains read-only and manual by
default. It checks trusted policy code from the default branch and does not approve or merge PRs.
A matching title, label or successful CI run alone is not dependency-update authorization.

Keep workflow names unique and reserve the seven core check names for this workflow. If a future
required context changes, first produce a green new context, then have the authorized owner add it
without an enforcement gap, and only then retire the old requirement or compatibility alias. Never
bypass checks or weaken protections to rename a job. The stable **Required checks** aggregate
continues to fail closed for every required prerequisite, including skipped or cancelled jobs.
