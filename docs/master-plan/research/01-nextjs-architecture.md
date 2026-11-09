# 01 - Best-in-class Next.js App Router architecture, November 2026

Research date: 2026-11-09. Method: ~35 sources read or fetched (official docs fetched directly where possible; third-party material marked as such). The WebSearch budget ran out mid-session, so Kent C. Dodds colocation, polyrepo-sync tooling and FSD criticism are only partially covered (flagged below).

Items marked **[COMMERCIAL]** come from a vendor with a product interest. Items marked **[UNVERIFIED]** rest on a single secondary source.

---

## 0. State of the world (what changed since 2025, verified against primary sources)

- **Next.js 16.4 (2026-10-06)**: Vercel now "recommends Cache Components as the best choice for every Next.js app". `create-next-app` enables it by default. It becomes the default in Next.js 17. Active LTS is **16.4.5** (security release 2026-11-03); 15.5.29 is Maintenance LTS. [S1, S2, S3] **[COMMERCIAL: Vercel authors both framework and host]**
- **Next.js 16.3 (2026-08-03)** added Instant Navigations, Partial Prefetching, root params (`next/root-params`), `catchError`, `import.meta.glob` in Turbopack, native Node streams (up to 22% more requests/s), and TS 7 type-checking in `next build`. The model is described as "dynamic by default, with no hidden or implicit caching". [S2]
- **TypeScript 7.0 GA (2026-07-08)**: Go-native compiler, installed as the normal `typescript` package with the `tsc` binary. Typical 8-12x faster builds. **No programmatic API until 7.1**. typescript-eslint, webpack loaders, Vue/Svelte/Astro/MDX tooling are blocked on it. `@typescript/typescript6` gives a `tsc6` binary and the 6.0 API side by side. [S4, S5, S6]
- **React 19.3 (2026-09-09)**: `<ViewTransition>` and Fragment refs are stable. Also `browser()`, Trusted Types support, and Server Components rendering client Context directly. [S7]
- **Biome 2.6 (2026-10-15)**: JavaScript plugins (developer preview). Biome 2.5 (2026-06-05) added cross-file linting and GritQL fixes. [S8, S9]
- **DTCG Design Tokens Format Module 2025.10** is the first stable spec (2025-10-28). [S10, S11]
- **Security cadence**: since July 2026 Next.js ships a formal monthly security release plus out-of-band patches (Sept 22, Oct 14). The Nov 3 release fixed several `use cache` cross-tenant/cross-user disclosure bugs. [S3, S12]

Implication: "best-in-class" in Nov 2026 means being on 16.4.x with Cache Components, TS 7 for type checks, a DAL, and a patch-within-days process.

---

## 1. Layered architecture applied pragmatically to RSC

### 1.1 What Next.js officially says

The Next.js data-security guide (updated 2026-10-06) is the only vendor-blessed architecture statement. It names three approaches (HTTP APIs, Data Access Layer, component-level access) and says: pick one, do not mix. For **new projects it recommends a DAL**: a server-only internal library that (1) only runs on the server, (2) performs authorization checks, (3) returns minimal DTOs. Only the DAL reads `process.env`. [S13]

Concrete rules from the guide worth encoding:

- `import 'server-only'` in every DAL module (build error if reached from client).
- Server Actions are reachable by direct POST. Re-verify authn **and** authz inside each action; a page-level check does not cover it. Check resource ownership (IDOR).
- Keep `"use server"` files thin; they delegate to DAL functions that carry auth, authorization and DB logic.
- Return only what the UI needs from actions (never raw rows).
- `proxy.ts` and `route.ts` "have a lot of power", audit with traditional techniques. Proxy is for optimistic redirects only, never the sole authz layer (reinforced by OWASP and the 2025 middleware-bypass CVE history). [S13, S14]
- React Taint APIs (`experimental.taint`) are defense in depth, not a substitute for DTO shaping. They are still `experimental_`. [S13]
- Prefer Server Components fetching from the source, not via your own Route Handlers (extra hop; fails at build for prerendered pages). Route Handlers are for webhooks, callbacks, non-HTML content, proxying with a server token. [S15]

### 1.2 Where Clean/Hexagonal adds value and where it is ceremony

Evidence is thin and mostly blog/skill-registry grade (no authoritative source on "how strict in Next.js"). Synthesis:

| Layer | Adds value when | Ceremony when |
|---|---|---|
| Ports/adapters around an external system (Postgres, Hotmart, Metricool, the Python RAG API, an LLM provider) | The dependency is swappable, flaky, or must be faked in `node --test` | A single adapter that will never change |
| Use-case functions (`placeOrder`, `revokeRole`) | Logic is shared by a Server Action, a route handler and a script/test; has invariants | CRUD with no rules |
| Domain entities/value objects | IAM rules, pricing, permission logic (backoffices) | Marketing content sites |
| Repository interfaces over an ORM | Almost never in TS; the typed query layer already is the seam | Default for "clean" tutorials |

Pragmatic rule: **server actions and route handlers are primary adapters**, so they parse/validate input (Zod/Valibot), call one use case or DAL function, map the result, and call `updateTag`/`revalidateTag`. They contain no business logic and no SQL. Several community guides converge on exactly this (actions as thin controllers calling use cases, with a lazily built singleton container) [S16, low-grade sources], and it matches the official "thin `use server` actions delegate to the DAL" advice [S13].

Kent C. Dodds' AHA principle (2020) is the counterweight: prefer duplication over the wrong abstraction; abstract once the pattern appears (rule of three). [S17] Epic Stack's stated philosophy is also minimal setup, common cases only, decisions documented. [S18] Both argue against pre-building ports for everything.

### 1.3 Composition root

- Next.js has no DI container and module instances are per-server-process, so a **single `server/container.ts` (server-only)** that builds adapters from validated env and exposes use cases is the idiomatic composition root. Keep it a plain object of lazily constructed singletons (cache with module scope, not `React.cache`, for process-wide clients; use `React.cache` for per-request things like `getCurrentUser`).
- Parse env once with a schema (e.g. `env.server.ts` with `server-only`) and only the container/DAL reads it. This mirrors the "only the DAL reads `process.env`" guideline. [S13]
- Do not leak the container into Client Components. Tests build their own container with fakes.
- Caveat from `use cache`: cached functions have **isolated `React.cache` scope**, cannot call `cookies()/headers()`, and accept only serializable args (no class instances). So `getCurrentUser()` must be read **outside** the cached scope and passed in as a primitive. This directly shapes the DAL: split "identity resolution" (uncached, request-scoped) from "data reads" (cacheable, take `userId`/`tenantId` as args). [S19]
- Security note: the Nov 2026 advisories show tenant/user identity must be an explicit argument of a cached function, never ambient (root params, closures, binary args). Treat every `use cache` function that touches tenant or user data as security-sensitive code requiring review. [S12]

### 1.4 Feature-Sliced Design (FSD)

- FSD v2.1 documents a Next.js recipe: the Next `app/` folder holds only routing, `src/` holds layers renamed `_app` and `_pages` (to avoid the router clash), plus `widgets/features/entities/shared`; route files re-export. [S20]
- **Steiger** (official FSD linter) is zero-config, **beta** (v0.5-era config format), 22 rules, four off by default (`no-cross-imports`, `no-higher-level-imports`, `import-locality`, `no-wildcard-exports`), rules not yet extensible, no Next.js mention. [S21] The ESLint plugin covers only a fraction and is reported stale. [S21]
- Judgment: FSD pays off for large teams with many product surfaces. For a solo/small-team estate it adds six layers of vocabulary, a router-naming workaround, and a beta linter. **Not recommended as the primary structure** for any of our 4 Next apps; steal two ideas only: strict one-way imports and public API per slice.

### 1.5 Reference folder structures

- Next.js official: unopinionated; offers three strategies (code outside `app`, code in top-level `app` folders, split by feature/route), private `_folders`, route groups, optional `src/`. "Choose a strategy that works for you and be consistent." [S22]
- Bulletproof React (alan2207): feature folders with unidirectional flow `shared -> features -> app`; it is a Vite SPA guide, not Next-specific; critics note it enforces nothing without lint rules. Next adaptations are third-party. [S23]
- next-forge (Vercel) **[COMMERCIAL]**: `apps/{web,app,docs}` + domain packages (`auth`, `database`, `email`, `ui`, ...), shared `biome.json`/`tsconfig`/`turbo.json`, Biome instead of ESLint/Prettier. Worth copying: split by responsibility not by file type. [S24]
- Epic Stack (Kent C. Dodds / epicweb.dev) **[COMMERCIAL: sells workshops]**: opinionated starter, "starter app is not docs", decision docs record trade-offs. [S18]

**Recommended pragmatic skeleton for a Next app (src/ optional):**

```
app/                       # routing only: page/layout/route/actions glue, thin
  (marketing)/ (shop)/ (admin)/   # route groups by intent
  _components/ _actions/          # route-private colocation
features/<feature>/        # UI + actions + schemas for one capability (public index.ts)
server/                    # server-only; the "inside" of the hexagon
  container.ts             # composition root
  env.ts                   # validated env, only reader of process.env
  dal/ (or data/)          # authz + DTOs, 'server-only'
  domain/                  # pure TS: entities, rules, use cases, ports (interfaces)
  adapters/                # db, hotmart, rag-api, email: implement ports
shared/                    # ui (shadcn), lib, tokens; no imports from features/server
```

Dependency direction: `app -> features -> server(dal -> domain <- adapters)`, `shared` imported by everyone, `domain` imports nothing. For the two content sites (portfolio, pequeverso) drop `server/domain` and keep `features/` + `shared/` plus a small `content/` loader. Ceremony there has negative value.

---

## 2. server-only / client-only boundaries

- `import 'server-only'` on DAL, container, env, adapters. Next resolves it internally; install the npm package only if lint complains about undeclared deps. [S13]
- `'use client'` files: keep prop types narrow (specific DTO fields, never `User`). Next's audit checklist explicitly asks for this. [S13]
- `client-only` for modules touching `window`/`localStorage`.
- `"use server"` modules may also `import 'server-only'` safely. [S13]
- React 19.3 `browser()` marks a component as skipping SSR; it complements `use client` for truly client-only widgets (timezone, theme flicker). Prefer it over `dynamic(..., {ssr:false})` hacks once on 19.3. [S7]
- Static export (pequeverso): Server Actions, cookies, proxy, headers/redirects config, ISR, default image loader, draft mode, and dynamic routes without `generateStaticParams` are unsupported. Route handlers only `GET` with `dynamic = 'force-static'`. [S25] `use cache` lists **Static export: No** under platform support. [S19]

---

## 3. Next.js 16.x features that matter

| Feature | Status (Nov 2026) | Relevance |
|---|---|---|
| Cache Components (`cacheComponents: true`) + `use cache`, `cacheLife`, `cacheTag`, `updateTag` | Stable since 16.0 API-wise; recommended universally since 16.4; default in 17 | Backoffices (Node server): adopt. Sites: see below |
| Partial Prerendering | Folded into Cache Components; old `experimental.ppr` and `experimental_ppr` removed | No separate flag |
| Partial Prefetching (`partialPrefetching: true`) | Opt-in in 16.3/16.4, part of the model | Reduces prefetch storms; Nov 2026 shell-poisoning bug did not affect it enabled |
| Instant Navigations: Stream (Suspense) / Cache (`use cache`) / Block (`export const instant = false`), Instant Insights, Navigation Inspector, `instant()` Playwright helper | 16.3 | Gives us an e2e **architecture guard**: assert what is visible instantly (`@next/playwright`) [S2, S26] |
| `ensureStatic = 'navigation' | 'prefetch' | 'shell'` | 16.4 | Build-fails if a dynamic component creeps into a static route: ideal for marketing/e-commerce pages [S3] |
| `navigation()` / `prefetch()` APIs | 16.4 | Defer work out of prefetch |
| Root params (`next/root-params`) | 16.3, Server Components only | i18n (`[lang]`); also works inside `use cache` |
| View Transitions | React 19.3 stable; "no configuration" in App Router; `transitionTypes` on `<Link>`; docs include reduced-motion CSS | Matches our reduced-motion rule: wrap in `@media (prefers-reduced-motion: reduce)` zeroing durations [S7, S27] |
| `typedRoutes: true` | Stable top-level (no longer `experimental.`) | Compile-time `Link href`; works with TS 7 `tsc` via Next. Note `PageProps<'/route'>` and `RouteContext` helpers are generated [S28] |
| `catchError` boundaries | 16.3 | Replace ad-hoc error.tsx for server-error retry [S2] |
| Rust React Compiler | Experimental | Skip until stable |
| `next upgrade --agent`, versioned AGENTS.md | 16.3/16.4 | Fits agent-driven maintenance; `next dev` writes a version-matched AGENTS.md block [S2, S3] |
| Adapters API | Stable in 16.2 | Relevant to Coolify/Docker self-hosting portability [S29] |

**Cache Components migration facts** [S30]: route segment config `dynamic/revalidate/fetchCache` errors once enabled; `generateStaticParams` cannot return `[]`; `dynamicParams` unsupported; `runtime='edge'` unsupported; routes preserved with `<Activity>` so component state now persists across navigations; synchronous IO (`new Date()`, `Math.random()`) in prerender must be wrapped (`connection()` + Suspense). `use cache` entries are per-deploy and in-memory by default (self-host persists, serverless doesn't); use `cacheHandlers` or `use cache: remote` for persistence. [S19, S30]

**Static export vs Cache Components**: the docs list static export as unsupported for `use cache`. The docs do not clearly state whether `cacheComponents: true` + `output: 'export'` builds. **Contested/uncertain (see section 9).**

---

## 4. Architecture guards (what works with a Biome-only stack)

Biome facts [S8, S9, S31-S34]:

- `noRestrictedImports` (since 1.6; `patterns` with gitignore-style groups, `importNamePattern` since 2.2.0). Configurable per path via `overrides` (config feature, doc does not show a folder example; I could not verify folder scoping from the rule page alone). Good for "no `pg`/`drizzle` outside `server/adapters`", "no `server/` from `features/**/ui`".
- `noPrivateImports` (since 2.0, recommended): JSDoc `@package`/`@private` visibility, "package" = folder. Gives slice-level encapsulation (FSD-lite) without a new tool. Does not work across workspace packages.
- `noImportCycles` (project domain, since 2.0, not recommended, scanner cost). Good cheap guard.
- `noUndeclaredDependencies` for workspace hygiene.
- GritQL plugins: pattern match + diagnostics + fixes (`fix_kind`), `includes` globs per plugin. **No semantic model/file kind access**, run on every file, so import-direction rules via path regexes are feasible but clumsy. [S35]
- JS plugins (2.6, developer preview) expose a subset of semantic model/module graph/package manifest services; no import-boundary example yet. Do not bet on it for guards. [S9]

Alternatives:

- **dependency-cruiser**: rule engine over the resolved module graph (`forbidden`, `not-to-test`, orphans, circular). Outputs "eslint-like" but needs no ESLint. Strong for CI. Heavy to configure; TS 7 compatibility **not verified** (it uses the `typescript` package API for TS resolution; the 7.0 API gap suggests it needs `@typescript/typescript6` or `tsconfig` handled without TS). **[UNVERIFIED for TS 7]** [S36]
- **eslint-plugin-boundaries**: best editor feedback but requires ESLint, which is now blocked by typescript-eslint/TS 7 for type-aware use. Pure import-rule use (no type info) does not need typescript-eslint, so it can still run with ESLint + `typescript` pinned to 6; but this reintroduces ESLint into a Biome-only stack. Not recommended. [S37, S6]
- **Steiger**: FSD only; beta. Not recommended. [S21]
- **knip v6**: dead files/exports/dependencies, not architecture, but excellent hygiene guard; requires `typescript` peer (TS 7 status not verified). [S38]
- **Custom import-graph tests with `node --test`**: parse imports with a tiny regex or `es-module-lexer`/`oxc-parser` and assert rules (for example, no file under `features/**` imports from `server/adapters`, every `server/**` file starts with `import 'server-only'`, every `"use server"` file calls an auth function or DAL). Zero extra deps, TS-version independent, trivially explainable to agents. This is the most robust option for our stack.
- Ts-archunit/ArchGuard-style libs: vendor self-comparisons, new; skip. [S36]

**Recommended guard stack for Biome-only repos**: Biome (`noRestrictedImports` per-folder overrides + `noPrivateImports` + `noImportCycles` + `noUndeclaredDependencies`) + one custom `node --test` architecture test file + knip in CI + (optionally) dependency-cruiser in CI with a minimal ruleset once its TS 7 behavior is confirmed. Add the Next-native guards: `ensureStatic`, `instant()` Playwright asserts, `typedRoutes`, `server-only`.

---

## 5. Sharing code across 7 repos: monorepo vs polyrepo

Two Next sites + two Next backoffices share: shadcn/Base UI components, Tailwind theme/tokens, Biome and tsconfig presets, a better-auth/IAM client, small utilities. The Python repos and vps-ops are a different language and share only conventions.

Options and evidence:

1. **Monorepo (pnpm workspaces + Turborepo)**: Turborepo's recommended layout is `apps/` + `packages/`, `workspace:*` deps, `exports` over `main`, Just-in-Time (TS source) or compiled internal packages, Node subpath `imports` over `paths`, per-package tsconfig extending a shared one. [S39] next-forge is the reference. [S24] Next 16.4 added `turbopackAdditionalRoots` and manual pnpm global virtual store integration for linked packages (experimental). [S3] Tailwind v4 officially supports sharing `@theme` CSS across packages "in monorepos or via npm". [S40]
2. **Polyrepo + published packages (GitHub Packages, private npm)**: versioned, but release overhead; one community thread favors a monorepo unless a team is dedicated to shared components. [S41, secondary]
3. **Polyrepo + shadcn private GitHub registry** (August 2026): `shadcn add acme/internal-toolkit/auth-kit` from private repos, auth through `gh` or fine-grained PAT (`Contents: read`), files pinned to the resolved commit SHA. Source is copied (own the code) rather than versioned. [S42] shadcn changelog: Base UI is the default since July 2026; CLI v4 (March), `shadcn apply`/presets (April). [S43]

**Tradeoffs for our estate**

| Option | Pros | Cons |
|---|---|---|
| Full monorepo of 4 Next apps (+ maybe python as non-JS dirs) | Atomic changes to design system and auth; one toolchain upgrade (Next/TS 7/Biome/Tailwind) instead of four; Turbo remote cache | Merges four repos with different deploy targets (static export vs Node/Coolify), different secrets, git history, CI; blast radius; Python repos stay out anyway; migration cost |
| Small `shared` monorepo (packages only: `@acme/ui`, `@acme/tokens`, `@acme/config`) published to GitHub Packages, apps stay in own repos | Versioned, apps upgrade at own pace; no repo merge | Release + Renovate overhead; two-step change flow |
| shadcn private registry for UI + `@acme/config` package for tsconfig/biome + tokens as CSS package | Matches shadcn/Base UI ownership model; zero build for UI; low overhead | Drift between copies (mitigated by `shadcn` diff/apply and Renovate on the tokens package) |
| Copy-and-sync via template repo | Simplest | Drift guaranteed |

**Recommendation**: do **not** move to a monorepo now. Seven repos in three runtimes with separate deploy/secret boundaries and agent-driven per-repo workflows argue against it. Use: (a) one tiny private package repo for **tokens + Biome preset + tsconfig base + architecture-test helpers** (versioned, Renovate-bumped), (b) the shadcn private registry for components that must stay in sync, (c) CI checks in each repo that detect version drift. Revisit a monorepo (Turborepo + pnpm, JIT packages, `workspace:*`) if you reach roughly 3+ shared runtime packages with frequent cross-cutting changes, or if two or more apps need the same auth/IAM UI changes in lockstep. Note the two backoffices are the strongest monorepo candidates (same better-auth/IAM/ops-dashboard shape); merging only those two is a defensible middle path.

---

## 6. Shared design tokens

- **DTCG 2025.10** (stable 2025-10-28): JSON with `$value/$type/$description/$extensions/$deprecated`, groups with `$root` and `$extends`, aliases `{group.token}` plus JSON-pointer `$ref`, structured `color` (colorSpace + components: Display P3, OKLCH, CSS Color 4), `dimension {value, unit}` (`px|rem`), `duration`, `cubicBezier`, composites (shadow, border, transition, strokeStyle; gradient and typography are listed), media type `application/design-tokens+json`, extension `.tokens.json`. Several types (font style, percentage, file) are still TODO; the theming/resolver content is a separate module not confirmed from what I read. [S10, S11, S44]
- **Style Dictionary v5**: Node >= 22, stricter references (token refs only, fixed `{}` syntax), performance work. The docs state 2025.10 support is "a work in progress in v5", and zeroheight notes v5 is the reference base for 2025.10. [S45, S46, S47] Other implementers: Tokens Studio, Terrazzo (has a Tailwind v4 integration). [S11, S48]
- **Tailwind v4.3 `@theme`**: namespaces (`--color-*`, `--spacing-*`, `--radius-*`, `--font-*`...), `@theme inline` when referencing another variable, `@theme static` to force emission, `--*: initial` to drop defaults, theme files importable across projects via `@import` from a package. [S40]

**Recommended pipeline** (low ceremony): author `tokens/*.tokens.json` in DTCG 2025.10 (OKLCH colors, rem dimensions) -> Style Dictionary v5 (or Terrazzo if SD's color-object support lags) -> emit one `theme.css` (`@theme` block, plus `:root`/`.dark` overrides for semantic tokens) -> published in the shared config package -> apps `@import` it after `@import "tailwindcss"`. Keep **primitive** tokens in `@theme`, **semantic/shadcn** tokens (`--background`, `--primary`) as `:root` variables mapped with `@theme inline`. Add a snapshot test of the generated CSS and a contrast check (APCA/WCAG) in CI. For two sites with very different brands (portfolio vs Spanish-language kids' store) share only **structure** (spacing, radius, type scale, motion durations, z-index, breakpoints) and let color/typography be per-brand sets via `$extends`.

---

## 7. TypeScript 7 (tsgo) and tooling compatibility

Facts [S4, S5, S6]:

- GA 2026-07-08; `npm i -D typescript@^7`, binary `tsc`; Next 16.3+ uses it for `next build` type checking just by bumping the dependency; `useTypeScriptCli` config exists. [S2]
- 6.0 deprecations are hard errors in 7: `target: es5`, `downlevelIteration`, `baseUrl`, `moduleResolution: node/node10/classic`, `module: amd/umd/systemjs/none`. New defaults: `strict: true`, `module: esnext`, `types: []` (set `["*"]` or list explicitly), `noUncheckedSideEffectImports: true`, `rootDir: ./`. Use Node subpath `imports` instead of `paths`/`baseUrl`.
- New flags: `--checkers` (default 4, experimental), `--builders`, `--singleThreaded`.
- **No stable programmatic API until 7.1.** Blocked: typescript-eslint (peer range `<6.1.0`; maintainers say nothing can be done until an API exists), `ts-node`/`ts-jest`/`ts-morph`, webpack loaders, Vue/Svelte/Astro/MDX tooling. Workaround: keep `typescript@^6.0.3` for tools via npm alias and run 7 as `tsc`/`typescript-7`, or `@typescript/typescript6` (`tsc6`). [S4, S6, S49]
- Biome does not depend on the TS compiler (own parser/type inference), so it is unaffected: a point in favor of a Biome-only stack. Knip and dependency-cruiser depend on the `typescript` package: **verify before adopting on 7** (not confirmed from their docs).
- `node --test` with TS: runs `.ts` through Node's type stripping (Node 22.6+/24); needs no `typescript` API; keep test code to erasable syntax (no enums/namespaces/parameter properties) or use `--experimental-transform-types`. **[general knowledge, not source-verified here]**
- Practical policy: CI runs `tsc --noEmit` (7.x) as the gate; editor uses the native-preview extension; do not install ESLint with type-aware rules.

---

## 8. Recommendations for our 7 repos

**All four Next repos**

1. Pin Next to current 16.4.x LTS; subscribe to the monthly security release; add `next` to Renovate with a 48-hour SLA for security releases (Sept 22 and Oct 14 were out-of-band). Enable `experimental.agentUpgrade: 'security'`.
2. TS 7 for `tsc` gate, `typedRoutes: true`, node subpath `imports`, explicit `types`.
3. Add the architecture test file (`node --test`) with at least: server-only marker check, no `process.env` outside `env.ts`, no DB/HTTP client imports in `app/**`, `features/**` cannot import `server/adapters/**`.
4. Biome rules: `noRestrictedImports` (per-folder overrides), `noPrivateImports`, `noImportCycles`, `noUndeclaredDependencies`; knip in CI.
5. Shared package repo for tokens/Biome/tsconfig; shadcn private registry for Base UI components.
6. View Transitions only via `<ViewTransition>` with the reduced-motion CSS block from the Next guide, animating transform/opacity only.

**Portfolio (public, content)**

- Thin layered: `app/` + `features/` + `shared/` + `content/`. No ports/adapters. If hosted on Node/Coolify: enable `cacheComponents` + `ensureStatic = 'navigation'` in the root layout so a dynamic component cannot slip in; `instant()` Playwright tests for key navigations.
- If it stays a static export: skip Cache Components (see 9), keep `generateStaticParams` everywhere and `force-static` route handlers (sitemap, RSS, llms.txt).

**pequeverso.com (static export, Hotmart)**

- **Verify the deploy mode first**: the brief says static export, but the memory notes say Hostinger builds "standalone" on each merge. The two imply different feature sets (no Server Actions/proxy/headers under `output: 'export'`). [S25]
- Under static export: no DAL needed (no server data); put checkout out-links, pricing and copy in a typed `content/` module; headers/redirects must live in the host (hPanel/Hostinger), since `headers()/redirects()` config is unsupported. Keep Hotmart as a single `shared/lib/hotmart.ts` URL builder with unit tests. Keep UTM/tracking out per the bio decision.
- Guards: `ensureStatic` is moot in export mode (all static). Use a post-build test that scans `out/` for forbidden strings (secrets, `localhost`), plus `build-info.json` check already in use.

**Backoffices x2 (better-auth, Postgres IAM, ops dashboards)**

- Full hexagon-lite: `server/{container,env,dal,domain,adapters}`. IAM rules (roles, permissions) live in `domain/` as pure functions with exhaustive `node --test`. Every Server Action: validate -> `requireSession()` -> `authorize(permission, resource)` -> use case -> `updateTag`. Add a test that every `"use server"` export calls an auth function (static AST/regex scan).
- Adopt Cache Components with `use cache` only for **tenant-agnostic** reads (reference data, aggregates with explicit `tenantId` arg). Never read root params/cookies inside a cached scope. After the Nov 2026 advisories, forbid `unstable_cache` + `use cache` mixing and binary args in cached functions via an architecture test and code review.
- Use `proxy.ts` only for optimistic redirects; DAL enforces authz. `ensureStatic` not applicable; use `instant()` tests on dashboards' shells.
- Consider merging the two backoffices into a small Turborepo monorepo (shared IAM UI, auth client, DAL helpers) if their divergence stays low.

**Python repos x2 and vps-ops** (out of scope for Next, but): consume the same tokens-free conventions; expose OpenAPI and generate a typed client for the backoffices (adapter in `server/adapters/rag-api.ts`, port in `domain/`). A contract test in each backoffice against a recorded OpenAPI schema catches drift without a monorepo.

---

## 9. Contested / uncertain

1. **Cache Components for static-export sites.** `use cache` docs say static export is unsupported; the migration guide does not mention export at all. Test `cacheComponents: true` + `output: 'export'` in a throwaway branch before any plan commits to it. If unsupported, our sites stay on the pre-Cache-Components model until they move to a Node target. Next 17 making it default raises the eventual stakes.
2. **Is Cache Components production-ready for multi-tenant/private data?** Vercel says yes from 16.4; but the Nov 2026 release fixed three `use cache` disclosure/poisoning bugs (High and Medium). Treat as young; keep cached scopes free of identity.
3. **Clean/Hexagonal in frontends.** Evidence is community-grade; no authoritative benchmark of benefit. My "hexagon-lite for backoffices only" is judgment, not a sourced consensus.
4. **FSD vs plain feature folders.** FSD has an official Next recipe but needs renamed layers and a beta linter; no source I fetched evaluated long-term maintainability. Criticism search failed (budget).
5. **Biome folder-scoped `noRestrictedImports` via overrides**: believed to work (generic `overrides`), but the rule page shows no folder example. Verify in a spike. Biome JS plugins are preview; GritQL plugins lack semantic info.
6. **dependency-cruiser / knip with TS 7**: no source confirms behavior; may need `@typescript/typescript6` alias until 7.1.
7. **TS 7.1 date**: no primary timeline. Plan for ESLint-free tooling regardless.
8. **Style Dictionary v5 and DTCG 2025.10**: SD's own page says 2025.10 support is partial; Terrazzo may be the more complete implementation. One third-party tool (Hyva) said it could not parse 2025.10 yet, so verify each downstream consumer.
9. **Monorepo vs polyrepo** conclusions rest on community threads and first-party Turborepo docs; no controlled evidence exists. Decision depends on your change frequency across repos.
10. **View Transitions in Safari**: Next guide warns behavior may differ; ensure no functional dependency on the animation.
11. **Kent C. Dodds colocation article and Epic Stack folder layout** were not re-verified beyond the AHA article and the Epic Stack overview page.
12. Several sources are agent-skill registries and SEO blogs (mcpservers.org, skills.sh, noqta, pkgpulse); used only for context, never for hard claims.

---

## Sources

Primary or official (preferred)

- S1 Next.js 16.4, 2026-10-06 - https://nextjs.org/blog/next-16-4 **[COMMERCIAL: Vercel]**
- S2 Next.js 16.3, 2026-08-03 - https://nextjs.org/blog/next-16-3 **[COMMERCIAL]**
- S2b Next.js 16.3 Instant Navigations, 2026-06-25 - https://nextjs.org/blog/next-16-3-instant-navigations **[COMMERCIAL]**
- S3 Next.js blog index (security cadence, 16.4.5 LTS), accessed 2026-11-09 - https://nextjs.org/blog **[COMMERCIAL]**
- S12 November 2026 Security Release, 2026-11-03 - https://nextjs.org/blog/november-2026-security-release
- S13 Data security guide, updated 2026-10-06 - https://nextjs.org/docs/app/guides/data-security
- S14 OWASP Next.js Security Cheat Sheet - https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html (via search listing)
- S15 Backend for Frontend guide, updated 2026-11-06 - https://nextjs.org/docs/app/guides/backend-for-frontend
- S19 `use cache` reference, updated 2026-11-06 - https://nextjs.org/docs/app/api-reference/directives/use-cache
- S22 Project structure, updated 2026-07-21 - https://nextjs.org/docs/app/getting-started/project-structure
- S25 Static exports, updated 2026-08-09 - https://nextjs.org/docs/app/guides/static-exports
- S26 Instant navigation guide - https://nextjs.org/docs/app/guides/instant-navigation (referenced from S2)
- S27 View transitions guide, updated 2026-10-15 - https://nextjs.org/docs/app/guides/view-transitions
- S28 typedRoutes config (stable, doc dated 2025-08-19) - https://nextjs.org/docs/app/api-reference/config/next-config-js/typedRoutes
- S29 Next.js across platforms (Adapters API), 2026-03-25 - https://nextjs.org/blog/nextjs-across-platforms
- S30 Migrating to Cache Components, updated 2026-10-15 - https://nextjs.org/docs/app/guides/migrating-to-cache-components
- S4 Announcing TypeScript 7.0, 2026-07-08 - https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ **[COMMERCIAL: Microsoft]**
- S5 InfoQ, TypeScript 7 released, 2026-08 - https://infoq.com/news/2026/08/typescript-7-released/
- S6 typescript-eslint issue 12518 (TS 7 blocked), closed 2026-08-10 - https://github.com/typescript-eslint/typescript-eslint/issues/12518
- S7 React 19.3, 2026-09-09 - https://react.dev/blog/2026/09/09/react-19-3
- S8 Biome blog index (2.4 to 2.6) - https://biomejs.dev/blog/
- S9 Biome v2.6, 2026-10-15 - https://biomejs.dev/blog/biome-v2-6/ ; Biome v2.5, 2026-06-05 - https://biomejs.dev/blog/biome-v2-5/
- S31 Biome noRestrictedImports - https://biomejs.dev/linter/rules/no-restricted-imports/
- S32 Biome noImportCycles - https://biomejs.dev/linter/rules/no-import-cycles/
- S33 Biome noPrivateImports - https://biomejs.dev/linter/rules/no-private-imports
- S35 Biome linter plugins (GritQL) - https://biomejs.dev/linter/plugins/
- S10 W3C DTCG: first stable version, 2025-10-28 - https://w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- S44 Design Tokens Format Module 2025.10 - https://w3c.github.io/cg-reports/design-tokens/CG-FINAL-format-20251028/
- S11 designtokens.org FAQ - https://www.designtokens.org/faq/
- S45 Style Dictionary v5 migration - https://styledictionary.com/versions/v5/migration/
- S46 Style Dictionary DTCG page - https://styledictionary.com/info/dtcg/
- S40 Tailwind CSS v4.3 theme variables - https://tailwindcss.com/docs/theme
- S39 Turborepo structuring a repository - https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository **[COMMERCIAL: Vercel]**
- S42 shadcn private GitHub registries, 2026-08 - https://ui.shadcn.com/docs/changelog/2026-08-private-github-registries
- S43 shadcn changelog - https://ui.shadcn.com/docs/changelog
- S21 Steiger (FSD linter) - https://github.com/feature-sliced/steiger
- S20 FSD with Next.js (v2.1) - https://feature-sliced.design/docs/guides/tech/with-nextjs
- S37 eslint-plugin-boundaries - https://github.com/javierbrea/eslint-plugin-boundaries
- S36 dependency-cruiser - https://github.com/sverweij/dependency-cruiser
- S38 Knip - https://knip.dev/overview/getting-started
- S17 Kent C. Dodds, AHA Programming, 2020-06-22 - https://kentcdodds.com/blog/aha-programming
- S18 Epic Stack - https://www.epicweb.dev/epic-stack **[COMMERCIAL]**
- S24 next-forge patterns (Vercel Academy) - https://blog.vercel.com/academy/production-monorepos/next-forge-patterns.md **[COMMERCIAL]**

Secondary / low-grade (context only)

- S16 Hexagonal in Next.js guides: https://kuze-dev.pages.dev/blog/next-hexagonal-architecture ; https://dev.to/yukionishi1129/building-a-production-ready-nextjs-app-router-architecture-a-complete-playbook-3f3h
- S23 Bulletproof React (via search listings): https://github.com/alan2207/bulletproof-react ; https://www.buildmvpfast.com/blog/react-architecture-medium-large-scale-app-2026
- S41 shadcn registry vs npm discussions: https://noqta.tn/en/news/shadcn-github-registries-code-sharing-2026 ; https://21st.dev/blog/private-component-registry **[COMMERCIAL: 21st.dev]**
- S47 zeroheight SD v5/DTCG migration note - https://help.zeroheight.com/hc/en-us/articles/48049028236187 **[COMMERCIAL]**
- S48 Terrazzo Tailwind integration - https://terrazzo.app/docs/cli/integrations/tailwind **[COMMERCIAL-ish: tool vendor]**
- S49 TS 7 breakage write-ups: https://dev.to/dev_encyclopedia/why-your-typescript-7-upgrade-broke-eslint-ts-jest-and-ts-morph-385k ; https://dev.to/the-modern-web/why-angular-vue-and-eslint-cant-upgrade-to-typescript-70-yet-and-why-ts-71-changes-441g
- Architecture-linting comparisons incl. vendor self-claims **[COMMERCIAL]**: https://github.com/lindseystead/archguard ; https://nielspeter.github.io/ts-archunit ; https://xebia.com/blog/taking-frontend-architecture-serious-with-dependency-cruiser/
- Monorepo guides (SEO-grade): https://www.pkgpulse.com/guides/javascript-monorepos-2026-best-practices-pitfalls ; https://noqta.tn/en/tutorials/turborepo-nextjs-monorepo-shared-packages-2026
- Next Beats demo (Next.js 16.3 instant nav reference app): https://github.com/nextjs/next-beats
