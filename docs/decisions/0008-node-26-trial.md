# ADR 008 — Node 26 LTS trial before flipping the runtime

**Status:** proposed (2026-11-14); decision due 2026-11-28. Master-plan reference: ADR-0019, task M1.6.

**Context.** Owner decision DR-10 moves the backoffices to Node 26 LTS after two weeks of dual CI.
The runtime today is Node 24 (`.nvmrc` 24.22.0, `engines` `>=24 <25`, `node:24` build image and
`distroless/nodejs24` runtime image). Node 24 is supported until 2028-04-30, so staying is safe.

**Decision (trial).** The advisory workflow [Node LTS trial](../../.github/workflows/node-matrix.yml)
runs type checking, the unit suite and the production build on Node 24 and Node 26 for every pull
request into `develop` and every push to `develop`. The Node 24 leg is the pinned `.nvmrc` patch.
There is no schedule (OD-75: no daily scheduled failure e-mails; a red PR or push run still notifies
per the Actions e-mail setting). It is not a required context and is not part of **Required checks**.
Nothing else changes during the trial.

**Decision rule (2026-11-28).** The trial measures type checking, unit tests and the production
build. Flip only if (1) at least one Node 26 run on a `develop` head after 2026-11-14 is green and
every Node 26 run of the window is green or its failure has a recorded non-runtime cause, and (2) the
flip PR itself passes the full suite on Node 26: lint, database tests, the browser suite and the
image smoke (the trial does not run those). The flip changes together, in one PR: `.nvmrc`,
`engines`, `@types/node`, both Dockerfile base images, the Dependabot `node` ignore rule, this
workflow's pinned leg, and the Node version text in `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and
`docs/runtime-baseline.md`. Otherwise stay on Node 24 and record why. Either way, this ADR is updated to
accepted with the evidence (run links) and the trial workflow is removed or reduced to the chosen
line.

**Consequences.** Extra CI minutes on a public repository (free). Upstream regressions are seen
only when a pull request or push runs.
