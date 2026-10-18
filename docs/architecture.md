# Architecture

The private backoffice of the Pequeverso assistant: sign-in, access management and an operations
dashboard. Feature-organized, with dependencies pointing inward; `scripts/check-boundaries.ts`
enforces the layers (part of `npm test`). The public conversation lives only in the storefront.

```
src/
  app/                      routes: composition and metadata only
    ingresar/               sign-in            invitacion/[token]/  invitation landing (route handler)
    panel/                  layout guard + dashboard, accesos/ (owner), cuenta/
    api/auth/[...all]/      Better Auth endpoints       healthz/  liveness
  proxy.ts                  per-request headers (nonce CSP on backoffice routes)
  server/                   server-only composition: config, auth (pool, Better Auth, guards), operations
  features/
    auth/
      domain/access.ts      roles, permissions, e-mail normalization, invitation state, admission route
      application/          use cases (admitSignUp, invite, revoke, remove, resolveActor) + ports
      adapters/             Better Auth config, PostgreSQL store, node crypto
      presentation/         sign-in, invite form, account controls, frame, navigation
    operations/
      domain/summary.ts     ops summary model and pure derivations (money, percentages, freshness)
      application/ports.ts  OpsSource port
      adapters/             HTTP client (server to server) and runtime validation
      presentation/         dashboard (server component), Recharts daily charts (client), formatting
  shared/ui                 owned primitives on the design tokens
migrations/                 committed SQL (Better Auth core + invitations/audit)
infra/docker/app/           application Dockerfile and deny-by-default context filter
infra/docker/postgres/      owned IAM fixture recipe and zero-copy context filter
tests/unit/                source policy and deterministic behavior
tests/integration/         real disposable PostgreSQL
tests/browser/             real IAM with fake IdP and synthetic operations
```

## Request flow

1. `proxy.ts` sets a per-request nonce CSP, `frame-ancestors 'none'`, no-store and noindex on
   `/panel`, `/ingresar`, `/invitacion` and `/api/auth`.
2. `panel/layout.tsx` calls `requireActor("read_operations")`: the Better Auth session is read
   from PostgreSQL and the role re-read from the user row; anonymous visitors go to `/ingresar`.
3. The dashboard page reads the API's private summary through `server/operations.ts` (bearer
   token from server env), validates it and renders it; failures become "no disponible".
4. Owner mutations are server actions that call `requireActor("manage_access")` again before the
   use case runs.

## Access model

See [ADR 005](adr/005-backoffice-auth-better-auth.md) and [ADR 006](adr/006-iam-in-postgresql.md):
OAuth only, owner by configuration, everyone else by single-use invitation bound to the verified
e-mail, explicit linking only, revocation by deleting the account.

## Operations data

See [ADR 007](adr/007-ops-data-source.md). The contract is pinned in `contracts/ops/` from a
committed API revision (`contracts/ops/source.json`); a unit test checks the pinned hashes and
that the example parses.

The former public chat shells (`/`, `/embed`) were removed once the storefront's native
assistant reached parity; their design remains in the git history.


## Optional operational observability

The private API telemetry endpoint1.0 is independent from summary1.2 and the public chat contract.
The dashboard consumes only committed pinned schemas; telemetry is disabled by default
and a missing/disabled/malformed reading never invalidates a valid legacy summary.
Readiness is a point-in-time observation, provider status can be unknown, counters begin
at process start, and null values never become zero.

The BO's isolated manual OpenTelemetry provider never registers globally, so Next's
automatic route/fetch spans cannot leak private URLs or invite tokens. An optional private
metrics endpoint requires a distinct machine bearer; protected human pages still recheck
Better Auth roles. See [observability](observability.md) for switches, bounds, privacy and
BO-only Prometheus/Grafana proposals. Infrastructure deployment remains owned by vps-ops.

## Enforced dependency boundaries

Domain and application modules contain rules and injected ports, with no browser, network,
process or timer globals. Adapters implement IO; `src/server` composes adapters and use cases;
`src/app` remains the route/composition boundary. Presentation can depend on its own domain,
shared UI and explicit `import type` / `export type` declarations from its own application.
Runtime application imports, re-exports and dynamic imports from presentation are rejected.
Keep use-case execution in the outer server/action composition.

Every module under `src/features/<feature>/` must use a recognized `domain`, `application`,
`adapters` or `presentation` directory. Unknown placement cannot opt out of layer checks.
Outer framework entry points such as `src/proxy.ts` and `src/instrumentation.ts` retain their
composition role; they do not make misplaced feature modules valid.

`npm test` runs the checker over real source and negative virtual-module fixtures for these
rules, alongside positive composition and type-only cases. The checker parses source snapshots with the official development-only TypeScript 6
compatibility API; the root application compiler stays TypeScript 7. It never imports or executes
fixture modules. Every current source module is classified explicitly: app/server, shared/ui,
auth/operations feature layers, and the exact proxy/instrumentation entry points. Unknown and
importless placement, syntax errors, computed imports, missing/ambiguous local targets and
undeclared packages fail closed. Imports, re-exports, import-equals, require and import types
produce typed dependency edges; all edges participate in cycle checks, while only runtime
edges contribute to transitive client reachability. Existing public JSON/CSS resources remain
valid leaves; private server resources cannot enter client graphs.

Purity checks inspect identifier references and lexical symbols, distinguishing injected ports
from ambient IO, clocks/randomness and documentation strings. A narrow Server Action RPC
boundary accepts named async exports from App Router actions modules with a real top-level
`use server` directive; mixed value exports/private re-exports are not that boundary. Positive
fixtures preserve the actual server-page/action-prop/client-form composition and public wire
validators. Next still validates action compilation and serializable props; this guard does not
certify arbitrary object serialization, authorization, reflection/eval or third-party side effects.
No runtime access decision depends on the architecture checker. Keep independent auth,
least-privilege database, contract, image and browser checks.

## Container and browser-test locations

Build application and IAM fixture recipes from the repository root with explicit paths:

```sh
docker buildx build --load -f infra/docker/app/Dockerfile -t pequeverso-backoffice:reviewed .
docker buildx build --load -f infra/docker/postgres/Dockerfile -t pequeverso-backoffice-postgres:reviewed .
```

Each recipe has an adjacent `Dockerfile.dockerignore`. The application filter retains only
its actual COPY inputs and excludes secrets; the PostgreSQL FROM/RUN-only recipe excludes
all context contents. No independently editable root recipe/filter remains. These locations
are the common project convention, not a framework requirement or a deployment action.
The IAM recipe supports local/CI artifact drills; production targets the API-owned project
PostgreSQL 18.6 Alpine/pgvector engine with a separate IAM database, never a second BO engine.

Playwright discovers `tests/browser`; the two renamed specifications retain identical bodies,
imports, timeouts, assertions and project coverage. Public verification PNG paths stay stable.
The source guard rejects direct static acquisition or destructuring of ambient clock/random
methods while allowing injected shadowed ports and deterministic `Date.parse`. It does not
trace global-object aliases, casts, later assignments or arbitrary reflection and is not a sandbox.


## Paired repository conventions

The feature spine remains `src/app`, `src/features/{auth,operations}`, `src/server`,
`src/shared` and `tests/{unit,integration,browser}`. Application container sources remain
under `infra/docker/app`. The portfolio backoffice reference at committed revision
`a124139e1cfa1d0d496fcf76c518830491fc1679` informed this shared layout; Pequeverso keeps
its own domain, contracts and access rules. There is no frontend business or identity change.

Agent discovery now follows the paired convention: canonical `.claude/skills` folders and
relative directory links from `.agents/skills`. See [agent skills](agent-skills.md) for the
portable checks and their limits. The local/CI IAM PostgreSQL recipe remains an intentional
exception for isolated compatibility and restore drills. It does not introduce another
production engine or replace the API-owned production artifact. The latest recorded local
compatibility checks cover 19 IAM integrations on PostgreSQL 18.6 Alpine and the exact
`4c3257d8fff12e0be6e768bd53264e647e1fa24d` application image smoke; these are prior runtime
evidence, not tests rerun by the skill migration.

## Local fixture analytics

`src/features/analytics/{domain,application,adapters,presentation}` owns the separate
synthetic site report. `src/server/analytics.ts` checks live `read_operations` membership
before any selection/read, then composes its private bounded adapter. `/panel/analitica`
inherits the panel's headers. Its independent server flag defaults OFF and cannot enable
production collection. Domain/application purity and cross-feature restrictions apply;
analytics does not import operations adapters or join IAM data. See
[product analytics](product-analytics.md) for wire provenance and pending paired acceptance.
