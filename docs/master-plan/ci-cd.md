# CI/CD

Applies `ecosystem.md` sections 5 to 8 and 3: profiles (6.0), graph and rules (6.1), budgets (6.2), flake policy (6.3), hardening (6.4), central repository (6.5), supply chain (7), containers (8), Dependabot (5), release (3.2). Draft machine-readable map: `ci-profile.json` (same folder). Nothing here deploys or spends; image publication happens only in the M7 release workflow and only after the owner promotes `develop` to `main`.

## 1. Baseline and gaps (`audit.md`)

Seven jobs in `.github/workflows/quality.yml` (workflow validation, secret scan, static, database, container, browser, aggregate "Required checks"); good hygiene (SHA-pinned actions with version comments, `permissions: {}`, checkout without persisted credentials, source identity record, actionlint, zizmor, gitleaks over full history, concurrency that never cancels branch pushes). Gaps: not dynamic, every PR runs all four browser projects, each job builds on its own, the required context is not `ci-gate`, no SBOM, scan, provenance or release, Dependabot rule violated, no CodeQL, Scorecard, dependency-review, osv or duration report, no nightly workflow.

## 2. Graph (code profile) and rules

```
classify (<= 30 s) ─┬─> secrets, workflow lint (zizmor, actionlint, shellcheck)
                    ├─> static: biome, tsc (TS 7), guard + knip, unit + coverage (c8) ─┬─> mutation (incremental, affected)
                    │                                                                  └─> diff-cover
                    ├─> database (affected): PostgreSQL 18.6 container, migrations, integration, authz matrix
                    └─> build ONCE (npm run build → artifact .next standalone + build-info)
                           ├─> browser PR: Chromium + WebKit iPhone (a11y, keyboard, overflow, security headers)
                           ├─> visual (affected routes, pinned Playwright image)
                           ├─> lighthouse + check-bundle (budgets)
                           └─> container (affected): image build → hadolint, dockle, structure test, smoke, Grype, SBOM
ci-gate: if always(), needs all, success or skipped passes, failure or cancelled fails
```

| Rule | This repo |
|---|---|
| Single required check | `ci-gate`. Today the ruleset requires "Required checks". Procedure from `docs/ci.md`, kept: ship `ci-gate` green, owner adds it to the ruleset, only then retire "Required checks"; never an enforcement gap (owner-only ruleset change, PVB-D14) |
| Affected-only | `plan` script (15 lines, no third-party action) from `engineering-standards`; job-level `if:`; unknown or missing diff means run everything; docs-only runs docs checks, link check and the gate |
| Build once | The production `.next` standalone output is built in one job and consumed by browser, visual, Lighthouse and bundle jobs. The image job builds from the Dockerfile with BuildKit cache (the Dockerfile builds inside the image by design, so the image is a second build from the same SHA; the **released** digest is built once, in the release workflow, and that exact digest is scanned, attested and deployed) |
| Caching | npm store keyed on lockfile; `.next/cache` keyed on lockfile + source hash; Playwright browsers cached per version; BuildKit `type=gha` (single small image) with distinct scope for the postgres fixture |
| Sharding | Not needed: PR critical path is estimated at 5 to 6 min; if the browser job exceeds 8 min, shard with `--shard` and blob reports merged in a final `if: !cancelled()` job |
| Concurrency | `ci-${{ github.workflow }}-${{ github.ref }}`, cancel in progress for PRs only; never for release |
| Timeouts | lint/types/unit 10, database 15, browser 25, container 20, gate 2 |
| Required-check hygiene | Workflows listen to `merge_group` so a merge queue could be enabled later (not adopted, E4) |

Measured budget (ecosystem 6.2 backoffice): PR critical path p50 **6 min**, p95 **12 min**; nightly at most 45 min; release at most 30 min. Today's reference: `npm ci` 188 s locally (CI cache reduces it), build 178 s, browser suite 274 s with four projects, so the new split must remove roughly 3 minutes from the PR path: Chromium plus WebKit only (instead of four projects), build once, database and container jobs only when affected. Over budget order of fixes: cache hit rate, split jobs, shard, paid runners last. A weekly workflow prints p50 and p95 of the last 30 runs; alert when p95 drifts 25% above the four-week baseline (`quality/ratchets/ci-duration.json`).

## 3. Profiles for this repo

Full map in `ci-profile.json`; summary:

| Profile | Trigger | Runs | Budget p50 |
|---|---|---|---|
| `docs` | only markdown, `docs/**`, skills, license files | secrets, docs checks (links, README headings, markdownlint, Vale on English prose, skills validator) | 2 min |
| `code` | any source, config, test, migration, public, Docker change | lint, types, guard, knip, unit coverage; affected database, container, visual, a11y, performance, mutation, authz matrix; build once; browser PR | 6 min |
| `contract` | `contracts/**` | code plus validators against pins, generated-type compile, `contract-major` label if breaking | 8 min |
| `workflow` | `.github/**` | actionlint, zizmor (high), SHA-pin policy, shellcheck, dry run of a changed reusable workflow; includes `agent-review.yml` (Codex second opinion on PRs, Claude review on request, minimal permissions, nothing for fork PRs) | 3 min |
| `deps-weekly` | `dependabot/**` | code plus dependency review, licence check, SBOM diff, lockfile lint, image rebuild and scan if Docker or base changed, read-only policy assessment | 9 min |
| `release` | PR `develop` to `main` | everything: three engines plus Pixel, full mutation (or nightly green within 24 h), Lighthouse, visual all routes, image build with SBOM and provenance and verification, authz matrix, changelog check | 20 min |
| `hotfix` | `hotfix/*` with owner label | code plus release verification of touched surfaces, auto back-merge PR | 6 min |
| `assistant-quality` | not applicable | no prompts, retrieval or golden set here | n/a |

Nightly (`nightly.yml`): full mutation, flake detector, all engines and Pixel, visual all, forced colors and zoom, ZAP baseline, osv and Grype on the latest image, Scorecard, scorecard.json and ratchet check, contract drift watch. Weekly: `deps-weekly-guard`, docs link check, standards drift, CI duration report, develop-ahead-of-main report. Daily: osv vulnerability job and compromised-actions watch.

## 4. Hardening (ecosystem 6.4)

| Control | Status and plan |
|---|---|
| Token | `permissions: {}` at top already; grants per job; `id-token`, `attestations`, `packages` write only in the release attest job |
| Actions | Already full-SHA pinned with comments; repository policy "require full-SHA pinning" turned on (owner or gh script in M1) |
| Checkout | `persist-credentials: false` already |
| Triggers | `dependency-policy.yml` uses `pull_request_target` with default-branch code and sparse checkout; it never checks out, installs or executes the PR head (verified by reading the workflow); kept as a documented exception (ADR-0014, zizmor ignore with reason). No `workflow_run`. Untrusted context is passed through `env:` |
| Scanners | zizmor 1.30.1 and actionlint 1.7.12 (versions via Dependabot), gitleaks, secret scanning and push protection verified on; CodeQL default setup (JS/TS and Actions) free on a public repo; osv-scanner daily |
| Egress | `step-security/harden-runner` audit then block with allowlist on the release and publish jobs only (public repo, free tier); vendor product, trust decision in ADR-0015 |
| Environments | `production` environment with the owner as required reviewer and branch restriction for the publish job |
| Third-party actions that see secrets | none today besides official ones; any addition needs an ADR; `tj-actions/*` banned; Trivy only as SHA-pinned binary at or after v0.35.0 if ever used (Grype is the default scanner, E8) |

## 5. Central standards repository

The reusable workflows (`ci-node.yml`, `docker-build.yml`, `security.yml`, `attest-image.yml`, `release.yml`, `deps-weekly-guard.yml`, `scorecard.yml`, `drift.yml`) come from `gonzalomartinperez/engineering-standards` once it exists (E1, owner decision). Callers pin by SHA with a version comment. `standards.lock` records the ecosystem version, SHA-256 of `docs/master-plan/ecosystem.md` and `rubrics.md`, workflow SHAs and the Dockerfile template version. **Fallback if E1 slips:** vendor the workflow files from the plan's templates into `.github/workflows/` unchanged and reconcile later; the roadmap marks every item that depends on E1.

## 6. Dependabot: weekly single PR (ecosystem 5; `shared/dependabot-rule.md`)

Draft `.github/dependabot.yml` (replaces the current file; copied from the standards template at M1):

```yaml
version: 2
multi-ecosystem-groups:
  weekly:
    schedule: { interval: weekly, day: monday, time: "09:00", timezone: America/Argentina/Buenos_Aires }
    target-branch: develop
    labels: [dependencies]
    commit-message: { prefix: "build(deps)" }
updates:
  - package-ecosystem: npm
    directory: /
    multi-ecosystem-group: weekly
    patterns: ["*"]
    open-pull-requests-limit: 1
    cooldown: { default-days: 7, semver-major-days: 14, semver-patch-days: 3 }
  - package-ecosystem: github-actions
    directory: /
    multi-ecosystem-group: weekly
    patterns: ["*"]
    open-pull-requests-limit: 1
  - package-ecosystem: docker
    directories: [/infra/docker/app, /infra/docker/postgres]
    multi-ecosystem-group: weekly
    patterns: ["*"]
    open-pull-requests-limit: 1
```

Required before rollout (sandbox proof, E2, four unverified points in ecosystem 5.4): open group PR updated instead of a second PR; day, time and timezone honoured on groups; `github-actions` and docker accepted in a group; cooldown inside groups. If the first fails, the guard performs the supersede flow. Security-update PRs are disabled in repository settings (owner or `gh api` script, E-level owner action) with alerts on; the daily osv job records findings silently and the Monday summary notifies (OD-75). `deps-weekly-guard` runs Monday 10:30 ART and on Dependabot PR events (at most one open Dependabot PR, up to date with develop, `needs-fix` label on red). Today eight stale Dependabot branches exist on origin; M1 closes them, because the rule forbids a backlog of per-dependency PRs. The existing read-only policy workflow stays as the `deps-policy-readonly` job. Cooldown stays long here because no Hostinger path exists but the image is the only artifact and a bad package should not reach an image digest unreviewed.

## 7. Supply chain (ecosystem 7)

| Control | Plan |
|---|---|
| SBOM | Syft CycloneDX JSON of the built image, uploaded as an artifact on PRs touching Docker or lockfile, attested and attached to the release at M7 |
| Provenance | `attest-image.yml` (isolated reusable workflow, `actions/attest-build-provenance`, `subject-digest`, `push-to-registry`); claim Build L2 now, L3 through the isolated workflow; never more |
| Verify | `gh attestation verify oci://ghcr.io/gonzalomartinperez/pequeverso-backoffice@sha256:... --signer-workflow gonzalomartinperez/engineering-standards/.github/workflows/attest-image.yml` in the release job and in the `vps-ops` PR that records the digest. Private-package verification needs authentication: unverified, proved at the first M7 dry run |
| Image scan | Grype on the digest, fail on fixable high or critical; hadolint, dockle (CIS-DI), container-structure-test before it |
| Dependency review | `dependency-review-action` on every PR (public repo); osv-scanner PR mode not needed |
| CodeQL, Scorecard | Default CodeQL; Scorecard weekly with SARIF and badge, fail if the score drops more than 1 point; accept the ceiling on Code-Review and Branch-Protection for a solo repo |
| Secrets | GitHub secret scanning and push protection, gitleaks, secret-serialization audit of logs and spans |
| Immutable releases | Switched on before the first release; tag ruleset for `v*` |
| Install-time code | `npm ci --ignore-scripts` with an allowlist for builds that need scripts (none known; Next and Tailwind need none), lockfile diff review in the weekly PR |

## 8. Containers (ecosystem 8)

**App image** (`infra/docker/app/Dockerfile`, canonical Next.js standalone rules, already close). Target:

```dockerfile
# syntax=docker/dockerfile:1@sha256:<pinned>
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:<pinned>          # Node 26 after E10
ARG VERSION=0.0.0-dev                                             # release-please version, passed by docker-bake.hcl
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:<pinned>
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --ignore-scripts --no-audit --no-fund
COPY next.config.ts next-env.d.ts tsconfig.json postcss.config.json ./
COPY src ./src
COPY public ./public
ARG SOURCE_DATE_EPOCH
ARG SERVICE_REVISION
ENV SERVICE_REVISION=${SERVICE_REVISION}
RUN npx next build --webpack

FROM ${RUNTIME_IMAGE} AS runtime
ARG SERVICE_REVISION
ARG VERSION
ENV SERVICE_REVISION=${SERVICE_REVISION} VERSION=${VERSION}      # read by /healthz and /readyz; ARGs do not cross stages, so both are redeclared here
LABEL org.opencontainers.image.title="pequeverso-backoffice" \
      org.opencontainers.image.source="https://github.com/gonzalomartinperez/pequeverso-backoffice" \
      org.opencontainers.image.version="${VERSION}" org.opencontainers.image.revision="${SERVICE_REVISION}" \
      org.opencontainers.image.licenses="MIT" org.opencontainers.image.description="Pequeverso private backoffice" \
      org.opencontainers.image.documentation="https://github.com/gonzalomartinperez/pequeverso-backoffice/tree/main/docs"
# ... unchanged: COPY --chown=65532:65532 standalone, static, public, migrations, scripts/db-migrate.ts;
# USER 65532:65532, STOPSIGNAL SIGTERM, HEALTHCHECK node fetch /healthz, CMD ["node","server.js"]

```

Rules satisfied: digests pinned, tag for humans; distroless nonroot (65532); no shell; read-only rootfs works with tmpfs for `/tmp` and `/app/.next/cache` (already tested and documented in the deployment contract); health by `node -e fetch` (no curl); no `ARG`/`ENV` secrets (revision is not secret; provenance `mode=max` embeds build args); `.dockerignore` deny-by-default kept; `docker-bake.hcl` as the single local and CI entry point; amd64 only until the VPS architecture is known. Deviation: health path stays `/healthz` (and `/readyz`) rather than `/api/health` because the deployment contract with `vps-ops`, the proxy matcher and the smoke script already use it; recorded in ADR-0008. Node 26 flip (E10): CI matrix runs 24 and 26 for two weeks starting M1; flip the Dockerfile ARGs, `.nvmrc`, `engines` and the distroless image together if Next 16.4 and native deps pass, otherwise stay on 24 (supported to 2028-04-30).

**Postgres fixture image** (`infra/docker/postgres/Dockerfile`): CI and restore-drill artifact only, never a second production engine (production is the API-owned engine with a separate IAM database, `docs/reference/deployment-contract.md`). Changes: add `HEALTHCHECK CMD pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" || exit 1` (clears trivy DS-0026), keep digest pin and signed Debian packages. The ecosystem fleet standard says one PostgreSQL 18.x trixie image for both stacks; this fixture follows `postgres:18.6-trixie`, consistent. The README line that says production is "Alpine/pgvector" is stale against the ecosystem (trixie everywhere, Alpine not used) and is corrected in the M3 docs rewrite after checking with the API plan.

Runtime hardening block for `vps-ops` (documented, not applied here): `read_only: true`, tmpfs `/tmp` and `/app/.next/cache` (uid 65532, mode 0700, 32 MiB), `cap_drop: [ALL]`, `no-new-privileges`, `pids_limit`, `mem_limit` 384 MiB proposal, `cpus: 1`, `stop_grace_period: 20s`, no published port except through the proxy. Health contract: `/healthz` `{status, version}`; `/readyz` `{status, version, schema_version}` with no reasons; SIGTERM drained; env schema published as `docs/reference/env.md` generated from `server/env-parse.ts`.

## 9. Release automation (ecosystem 3.2)

release-please (manifest mode) on `develop`: one release PR bumps `package.json` and `CHANGELOG.md` (Keep a Changelog sections); owner merges it when a release is wanted, then promotes `develop` to `main` by PR with merge commit; a workflow on `main` creates tag `vX.Y.Z` and an immutable GitHub Release with SBOM and provenance assets and builds and attests the image once (`ghcr.io/gonzalomartinperez/pequeverso-backoffice`, tags `vX.Y.Z` and `sha-<short>`, package private). Needs a GitHub App token or fine-grained PAT (`GITHUB_TOKEN` does not trigger CI on its own PRs): owner-only scope grant. Version: current baseline is 1.0.0 (source baseline, `CHANGELOG.md`); the redesign and IAM additions ship as **2.0.0** (`Release-As: 2.0.0`) because every page changes, even though URLs do not (PVB-D13). Open point E5 (release-please on develop) is sandbox-validated first, fallback on `main` with a back-merge workflow. `vps-ops` receives a PR to `releases/production.lock` with the digest and attestation URL at M7; nothing deploys without owner authorization.

## 10. Rulesets and repository settings (owner or `gh api` script from the standards repo)

PR required, `ci-gate` required, strict, no force-push or deletion, no bypass actors on `develop` and `main`; tag ruleset for `v*`; require full-SHA pinning for actions; secret scanning and push protection on; Dependabot security updates off, alerts on; private vulnerability reporting on; immutable releases on. Verification is the weekly drift report.

## 11. Duration and observability of CI

`ci-duration.json` ratchet from `gh run list --json` (p50, p95 per workflow, last 30 runs); weekly summary issue only when over budget; cache hit rate printed in the job summary; flaky list from the nightly detector.
