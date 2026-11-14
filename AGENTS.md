# Repository guidelines — pequeverso-backoffice

Private backoffice for Pequeverso: OAuth sign-in, access management and read-only operations of the
shopping assistant. Public repository, MIT-licensed software (reserved scope in `NOTICE.md`). The
public conversation lives only in the storefront; this repository serves no public chat. Renamed
from `pequeverso-assistant-web` (2026-10-05) and `pequeverso-assistant-backoffice` (2026-10-17).
Never commit secrets, private operations details or other repositories' internals.

- English for code, docs and commits. UI copy is neutral Spanish with "tú" (terms in
  [docs/GLOSSARY.md](docs/GLOSSARY.md)).
- Node from `.nvmrc` (24.22.0). Next.js 16 App Router, React 19, strict TypeScript 7, Tailwind 4
  with owned primitives, Better Auth on PostgreSQL, Biome, knip.
- Read [docs/architecture.md](docs/explanation/architecture.md) before changing behavior and
  [docs/design-system.md](docs/design-system.md) before changing UI.

## Commands

The same commands run in CI ([docs/ci.md](docs/ci.md)); `tests/unit/agents.test.ts` keeps this
table equal to `package.json` and to the npm scripts that `.github/workflows/ci.yml` runs.

| Command | What it does |
| --- | --- |
| `npm run setup` | Fresh clone to green: checks the Node line, `npm ci --ignore-scripts`, then `npm run check:fast` |
| `npm run check:fast` | Inner loop (about 20 s): `npm run lint`, `npm run typecheck`, `npm test` |
| `npm run check` | Full local gate: `check:fast` plus `npm run knip`, `npm run security:check`, `npm run docs:check`, `npm run skills:check`, `npm run build` |
| `npm run test:db` | Migrations and IAM integration suite; needs a disposable PostgreSQL (`TEST_DATABASE_URL` or `DATABASE_URL`) |
| `npm run coverage` | Unit plus integration suites merged by c8 into `coverage/` (lcov, summary); needs the same PostgreSQL as `test:db`; CI runs it in the database job instead of `test:db` ([docs/ci.md](docs/ci.md)) |
| `npm run coverage:check` | Branch floors, ratchet and diff coverage against `coverage/` |
| `npm run test:browser` | Playwright against the production build, fake IdP and synthetic ops mock (ports 3241, 8237, 8238) |
| `npm audit --audit-level=moderate` | Locked dependency audit (CI static job) |

Before a PR: `npm run check`, `npm run test:db` and `npm run test:browser`. For UI changes inspect
the screenshots in `docs/verification/backoffice/` (desktop, dark, mobile) and request the
designer review.

## Layout (non-obvious parts)

| Path | Why it matters |
| --- | --- |
| `src/features/<feature>/{domain,application,adapters,presentation}` | Layered features; `scripts/check-boundaries.ts` (in `npm test`) enforces the direction |
| `src/features/auth/application/access.ts` | Admission rules; never move them into UI code |
| `contracts/{ops,telemetry,analytics}/` | Pinned API producer contracts (`source.json` hashes); never edited by hand |
| `migrations/` | Append-only SQL; a schema change is a new file |
| `infra/docker/{app,postgres}/`, `docker-bake.hcl` | Image recipes and the single build entry point |
| `.github/ci-profile.json` | CI profile map; every tracked file must fall in a profile and every CI job must be listed in `ci-gate` |
| `standards.lock` | `engineering-standards` release and byte-matched files (drift-checked) |
| `.agents/skills/`, `.claude/skills/` | Canonical skills and their per-skill relative symlinks |

## Backoffice rules

- Access only through Better Auth OAuth (Google, GitHub): no passwords, no public sign-up, no
  domain-based access, no implicit account linking.
- Every page and server action re-checks the role server-side (`requireActor`). No credentials,
  sessions or tokens in `localStorage`, URLs (except the one-time invitation link) or logs.
- Operations data comes only from the API's private summary and optional private telemetry through
  their server adapters, from the committed producer pins in `contracts/ops/source.json` and
  `contracts/telemetry/source.json`; validate payloads, show missing values as "No disponible",
  label fixture data as synthetic, and never display prompts, answers, buyer data, cookies or secrets.
- Schema changes are new files in `migrations/` (append-only); run `npm run test:db`.

## Non-negotiables

- Treat API payloads and anything from the network as untrusted: validate at the adapter boundary.
- No visitor tracking, analytics collection, session replay or third-party feedback services.
  The owner-authorized analytics report may read Peque API synthetic or production-class
  aggregates and display them behind live IAM checks with truthful classification. This read-only
  exception adds no collector, Store consent/Meta/CAPI/checkout change or production activation.
  Reads default OFF; production capability is not deployment or trusted-edge proof; see
  [product analytics](docs/reference/product-analytics.md).
- Consume only pinned, committed contracts (`contracts/ops/`, `contracts/telemetry/` and
  `contracts/analytics/`); do not invent endpoints, fields or auth behavior. Mocks and fixtures
  must say they are synthetic.
- Other repositories (storefront, API, portfolio, vps-ops) are read-only references. Never import
  from them at runtime or edit their working trees.
- Paid model calls, production actions, DNS and storefront changes need separate explicit authority.

## Workflow

- Task branches from `develop` (`feat/`, `fix/`, `docs/`, `test/`, `ci/`, `chore/`, `build/`), PRs
  into `develop`. `main` receives only `develop` (release) or, **only with the owner's explicit
  authorization**, a `hotfix/*` branch that is then merged back into `develop`. Rulesets enforce
  PRs and the required check (`ci-gate`; **Required checks** until the owner's swap). Merge only
  with green CI; never `--admin`. Nothing is deployed without explicit owner authorization.
- Preserve other agents' uncommitted work; never reset or stash it.
- Review chain: independent reviewer, Codex second opinion (advisory), architecture review for
  structural changes, designer review for UI.

## Deviations from the ecosystem standard

Health endpoints `/healthz` and `/readyz`; tests in `tests/` rather than next to the code;
`node:test` until the shared runner spike; Spanish strings
in product code. Reasons and confirmations: [docs/master-plan/standards.md](docs/master-plan/standards.md)
section 2.

## Skills

Canonical in `.agents/skills/<name>/SKILL.md`; `.claude/skills/<name>` is a relative symlink, never
an editable copy. Read only the selected procedure and its references. A skill is a procedure, never
an authorization. Catalog, evals and checks:
[docs/reference/agent-skills.md](docs/reference/agent-skills.md); harness files: [docs/agent-harness.md](docs/agent-harness.md).

## Docs map

[architecture](docs/explanation/architecture.md) · [authentication](docs/explanation/authentication.md) ·
[security design](docs/security.md) · [CI](docs/ci.md) · [dependencies](docs/dependencies.md) ·
[deployment contract](docs/deployment-contract.md) · [verification](docs/explanation/history/verification-2026-10.md) ·
[design system](docs/design-system.md) · [decisions](docs/decisions/) · [glossary](docs/GLOSSARY.md)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Master plan (2026-11)

The excellence refactor is planned in [`docs/master-plan/`](docs/master-plan/README.md). Before
acting on anything it covers, read
[`docs/master-plan/owner-decisions.md`](docs/master-plan/owner-decisions.md) (binding owner
decisions) and, to continue the work from any session,
[`docs/master-plan/RESUME.md`](docs/master-plan/RESUME.md).
