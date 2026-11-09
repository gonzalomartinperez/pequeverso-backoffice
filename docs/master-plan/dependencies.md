# Dependencies

Policy (`ecosystem.md` section 7): every new runtime dependency passes an ADR (need versus platform, health via Scorecard and deps.dev, licence allow-list MIT, Apache-2.0, BSD, ISC, 0BSD, BlueOak, bundle cost over 10 KB gz justified, maintainer count, exit cost); install-time scripts off; lockfile committed and diff-reviewed in the weekly PR. Health columns below say **unverified** where the numbers (Scorecard, deps.dev, advisories) were not fetched during this planning pass; the ADR for each addition records them. Versions are read from `package.json` at origin/develop; they are not repeated in prose elsewhere (no volatile facts).

## 1. Current dependencies

| Package | Purpose | Alternatives considered | Cost | Licence | 2026 health and security | Decision |
|---|---|---|---|---|---|---|
| `next` 16.4.2 | App Router, standalone output | none (framework fixed by the sibling and ADR) | server runtime | MIT | LTS line; monthly security releases with out-of-band ones on 2026-09-22 and 2026-10-14 (`research/01` section 8) | Keep; pin the 16.4.x line, subscribe to security releases, weekly PR carries bumps |
| `react`, `react-dom` 19.3.1 | UI runtime | none | about 45 KB gz client | MIT | actively maintained | Keep |
| `better-auth` 1.7.10 | OAuth, sessions, PostgreSQL adapter | Auth.js, Lucia (deprecated), custom | core of IAM | MIT | Two 2026 advisories (fixed in 1.6.2 and 1.6.11); current version above both; regression tests required | Keep; floor 1.6.11 enforced by a test reading the lockfile |
| `pg` 8.23.1 | PostgreSQL client | postgres.js, drizzle | server only | MIT | mature | Keep |
| `@opentelemetry/*` (api, resources, sdk-trace-base, exporter-trace-otlp-http) | Isolated manual tracing | none lighter that speaks OTLP | server only, loaded only when enabled | Apache-2.0 | active; exporter minor is on a 0.x line, so bumps need the observability tests | Keep |
| `class-variance-authority` 0.7.1 | Variant API for owned primitives | tailwind-variants | under 1 KB | Apache-2.0 | stable, slow-moving | Keep (ecosystem O4) |
| `clsx` 2.1.1, `tailwind-merge` 3.7.0 | Class composition | none | about 2 KB | MIT | healthy | Keep; custom size registry moves to `shared/lib/cn.ts` |
| `lucide-react` 1.55.0 | Icons | inline SVG set | tree-shaken, imports per icon | ISC | healthy | Keep; named imports only (lint) |
| `recharts` 3.10.1 | Charts | owned SVG, visx, uPlot | **391 KB client JS, main cause of 2,966 ms TBT** | MIT | maintained but heavy | **Remove in M5** (ADR-0012); interim lazy load in M3 |
| `server-only` 0.0.1 | Build-time guard | none | zero | MIT | stable | Keep |
| `tailwindcss`, `@tailwindcss/postcss` 4.3.3 | Utility CSS | CSS Modules (sibling today) | build only | MIT | active | Keep |
| `@biomejs/biome` 2.5.15 | Lint and format | ESLint plus Prettier | dev | MIT or Apache-2.0 | active; pin exactly | Keep; add import and complexity rules |
| `typescript` 7.0.2 | `tsc` gate | TS 6 | dev | Apache-2.0 | native compiler; no programmatic API until 7.1 | Keep |
| `@typescript/typescript6` 6.0.2 | Compiler API for the boundary guard only | Biome rules alone | dev | Apache-2.0 | needed until TS 7.1 | Keep, remove when the guard migrates (ADR-0010) |
| `@playwright/test` 1.64.1 | E2E, visual, a11y | Cypress | dev | Apache-2.0 | active | Keep |
| `@axe-core/playwright` 4.13.0 | axe | Pa11y | dev | MPL-2.0 | active | Keep; **MPL-2.0 is outside the allow-list**: dev-only, not shipped or bundled, recorded as a documented licence exception in `quality/licence-exceptions.json` |
| `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom` | Types | none | dev | MIT | follow runtime majors | Keep; `@types/node` major follows Node LTS (24 until the E10 flip) |

## 2. Proposed additions (all dev or CI-only unless stated)

| Package or tool | Purpose | Alternatives | Cost | Licence | Health | Decision |
|---|---|---|---|---|---|---|
| `c8` | Merge V8 coverage of unit and integration runs | Node built-in only, nyc | dev | ISC | maintained (unverified) | Add (M2) |
| `diff-cover` (run with `uvx` in CI, not a repo dependency) | Diff coverage gate | codecov patch status | CI only | Apache-2.0 | maintained (unverified) | Add (M2) |
| `fast-check` | Property tests and validator fuzzing | jsverify | dev | MIT | active (unverified) | Add (M2) |
| `@stryker-mutator/core` and `@stryker-mutator/tap-runner` | Mutation testing (runner per the DR-09 spike) | Vitest runner (needs migration) | dev, CI minutes | Apache-2.0 | active; TS 7 interplay is spike S1 | Add after spike S1 (M2, DR-09) |
| `knip` | Unused files, exports, dependencies | ts-prune, depcheck | dev | ISC | active (unverified) | Add (M1) |
| `style-dictionary` v5 (default) or Terrazzo | DTCG tokens to `theme.css` | hand-written CSS | dev | Apache-2.0 / MIT | v5 current line; decide in the M5a half-day spike | Add (M5a) |
| `@lhci/cli` pinned (via `npx` in the job) | Lighthouse CI median of 5 | custom Lighthouse script | CI only | Apache-2.0 | maintained (unverified) | Add (M2) |
| `cspell` with the Spanish dictionary | Copy lint (tuteo, spelling) | LanguageTool | dev | MIT | active (unverified) | Add (M2) |
| `markdownlint-cli2`, `lychee` (binary), Vale | Docs CI | none | CI only | MIT / Apache-2.0 or MIT / MIT | active | Add (M1, docs profile) |
| hadolint (binary, GPL-3.0, not distributed or linked), dockle, container-structure-test, Syft, Grype | Image gates, SBOM, scan | Trivy (SHA-pinned binary at or after v0.35.0 allowed only if needed) | CI only | GPL-3.0 (tool only) / Apache-2.0 | active | Add (M1) |
| OWASP ZAP baseline (container) | DAST on the preview stack | Nuclei | CI only | Apache-2.0 | active | Add (M2) |
| release-please action, `step-security/harden-runner`, CodeQL, `dependency-review-action`, Scorecard action | Release and supply-chain workflows | Changesets, Renovate | CI only | Apache-2.0 / vendor terms (harden-runner free tier is public-repo only, vendor product) | official or widely used; each needs the trust ADR | Add (M1, M7) |
| Handwriting font subset (S5) | One-line margin notes | Fraunces italic fallback | at most 15 KB | OFL-1.1 (to confirm per family at selection) | n/a | Add (M5), owner taste approval PVB-D10; fallback ships if the licence check fails |

## 3. Rejected

| Candidate | Reason |
|---|---|
| Base UI, Radix, shadcn registry as dependencies | Ecosystem O4: owned CVA primitives, no UI kit; native `<dialog>`, Popover and `<details>` cover the need (PVB-D4) |
| `cmdk` | The palette is a small owned combobox on native `<dialog>` |
| Zustand, Redux, TanStack Query | No client state worth a library: URL, cookies and server components |
| A date library | `Intl.DateTimeFormat` with explicit time zone |
| Sentry or other error SaaS | Phase V decision (GlitchTip or the OTel path in `vps-ops`); no new data egress now |
| Web-vitals RUM library | New telemetry for a private app needs an owner decision; deferred to MV |
| Playwright component testing, Vitest Browser Mode | Not needed for server-rendered kit components |

## 4. Update mechanics

One weekly Dependabot PR (Monday 09:00 ART, target `develop`, all ecosystems; `ci-cd.md` section 6). Next.js security releases that must not wait for Monday are an ordinary task-branch PR bumping `next` only, merged by the owner; they never create a second Dependabot PR. `better-auth` bumps re-run the advisory regression tests; `@opentelemetry/exporter-trace-otlp-http` is a 0.x line, so its bumps also run the observability redaction tests. Every ignored advisory or licence exception is an issue with owner, reason and expiry of at most 90 days.
