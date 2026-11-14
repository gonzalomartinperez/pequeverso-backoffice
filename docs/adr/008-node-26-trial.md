# ADR 008 — Node 26 LTS trial before flipping the runtime

**Status:** proposed (2026-11-14); decision due 2026-11-28. Master-plan reference: ADR-0019, task M1.6.

**Context.** Owner decision DR-10 moves the backoffices to Node 26 LTS after two weeks of dual CI.
The runtime today is Node 24 (`.nvmrc` 24.22.0, `engines` `>=24 <25`, `node:24` build image and
`distroless/nodejs24` runtime image). Node 24 is supported until 2028-04-30, so staying is safe.

**Decision (trial).** The advisory workflow [Node LTS trial](../../.github/workflows/node-matrix.yml)
runs type checking, the unit suite and the production build on Node 24 and Node 26 for every pull
request into `develop` and every push to `develop` (no schedule, so a red Node 26 run never sends
daily failure e-mails, OD-75). It is not a required context and is
not part of **Required checks**. Nothing else changes during the trial.

**Decision rule (2026-11-28).** Flip only if every Node 26 run of the trial window is green (or each
red run is explained by a non-runtime cause) and Next.js, Better Auth, `pg` and the Playwright
suite support Node 26. The flip changes `.nvmrc`, `engines`, `@types/node`, both Dockerfile base
images and the Dependabot `node` ignore rule together in one PR, verified by the full suite and the
image smoke. Otherwise stay on Node 24 and record why. Either way, this ADR is updated to
accepted with the evidence (run links) and the trial workflow is removed or reduced to the chosen
line.

**Consequences.** Extra CI minutes on a public repository (free). Upstream regressions are seen
only when a pull request or push runs.
