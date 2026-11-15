---
name: verify-release
description: "Verifies the pequeverso-backoffice app end to end and a develop to main release: checks, database suite, browser suite with the fake identity provider, optional real-API reading, image smoke, screenshot review, CHANGELOG, tag and post-deploy checks. Use when preparing or checking a develop to main promotion, a release tag or a deploy, or when asked to verify the whole app, even if CI already looks green. Not for writing features or day-to-day PR review, and never authorizes merging or deploying."
allowed-tools: Read, Grep, Glob, Bash
metadata:
  owner: gonzalomartinperez
  last-reviewed: "2026-11-14"
  version: "1.0.0"
---

# verify-release

Evidence only. This skill never authorizes merging or deploying; `main` receives `develop` only
with the owner, and nothing is deployed without explicit owner authorization.

## Checklist

- [ ] Prerequisites present, or the dependent suites reported "not run"
- [ ] `npm run check`, `npm run test:db`, `npm run test:browser` results with counts
- [ ] Image smoke and screenshots reviewed
- [ ] Release items (CHANGELOG, version, tag) agree; limits listed

## Prerequisites

Docker (or another disposable PostgreSQL) and Playwright browsers. If PostgreSQL is not available,
stop and report the database and browser suites as not run; do not substitute mocks.

## Procedure

1. `npm run check` (Biome, TypeScript 7, unit/contract/boundaries, knip, file/docs/skills checks,
   build). Quick loop: `npm run check:fast`.
2. Start a disposable server, e.g. `docker run -d --rm --name bo-pg -e POSTGRES_USER=test
   -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:18.6-trixie@sha256:885953109528ad3dfc90362b1a6f50a78620b5315be19f187753d267e484dc5b`, then
   `DATABASE_URL=postgres://test:test@127.0.0.1:55432/postgres npm run test:db`. Expect 0 schema
   differences and every integration test passing.
3. `TEST_DATABASE_URL=… npm run test:browser` (ports 3241, 8237, 8238 must be free). Expect all
   projects to pass, including axe and CSP-violation checks.
4. Optional real reading: run a **committed** API revision (`git archive <sha>`) with the fixture
   provider and `OPS_READ_TOKEN`, then `LIVE_OPS_URL=… LIVE_OPS_TOKEN=… npm run test:browser --
   live-ops.spec.ts`. Never use a paid provider or real keys.
5. Image: build with BuildKit (`docker buildx build --load -f infra/docker/app/Dockerfile .`, or
   `DOCKER_BUILDKIT=1 docker build -f infra/docker/app/Dockerfile .`) because the Dockerfile uses a
   cache mount. The distroless runtime runs as `65532:65532`; run `node scripts/db-migrate.ts` as a
   one-shot, then the server with `--read-only --tmpfs /tmp --tmpfs /app/.next/cache:uid=65532,gid=65532,mode=0700,size=32m
   --cap-drop ALL` and production-like variables; check `/healthz`, headers on `/ingresar` and the
   redirect from `/panel`. The hosted container job is described in [CI](../../../docs/ci.md).
6. Open the PNGs in `docs/verification/backoffice/` and judge them (layout, contrast, overflow,
   honest empty states, "No disponible" never zero). Record results and limits in
   [verification.md](../../../docs/explanation/history/verification-2026-10.md).
7. Release (develop → main, owner present): the promotion PR ran every CI job and `ci-gate`
   (**Required checks**) is green on the exact head; `CHANGELOG.md`, `package.json` version and
   the tag `vX.Y.Z` agree; after a deploy the owner authorizes, compare the build-info SHA with
   the merge SHA and run health checks. Record evidence in the release notes and `progress.md`.

## Feedback loop

Verify (run the check) → fix → re-verify. Stop after three failed attempts and report the blocker
with evidence.

## Output template

Commands, counts, engines, API revision used, CI run URL, release URL and build-info SHA when
applicable, and what was not verified (real Google/GitHub OAuth, TLS cookies, deployment).
