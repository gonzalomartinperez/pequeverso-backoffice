# Backoffice authentication threat model

**Date:** 2026-11-21

## Scope and method

This model covers six surfaces of the private Next.js backoffice, from OAuth sign-in and
IAM mutations to server-to-server reads and internal metrics. The storefront, the assistant
API's own authorization, and the OAuth providers' internal controls are outside this scope.

STRIDE-lite groups abuse cases by spoofing (S), tampering (T), repudiation (R),
information disclosure (I), denial of service (D), and elevation of privilege (E).
The model considers unauthenticated callers, signed-in viewers, and requests or data
crossing a trust boundary. Evidence comes from existing source, handler, database, and
browser tests using local or synthetic fixtures.

The citation guard checks each file and literal test name. Test bodies and their
assertions provide the coverage described here.

## Assets

- **Owner account.** A verified OAuth identity admitted through the configured owner e-mail
  can manage access. Invited owners also have IAM mutation privileges.
- **IAM data.** Member identities and roles determine access. Invitations grant one account
  the assigned role. A valid session represents the signed-in account. The audit trail
  records the actor, subject and time of access changes.
- **Assistant API credential.** The server uses `OPS_READ_TOKEN` to read private operations
  data. A separate machine bearer controls backoffice metrics.
- **Database credentials.** `DATABASE_URL` grants the backoffice runtime access to IAM data.
  The runtime and migration roles have different database privileges.

## Trust boundaries

- **Browser ↔ backoffice server.** The browser sends OAuth callbacks, session cookies,
  invitation URLs and action inputs. The server authorizes requests and sends rendered data
  or action results back. The future public reverse proxy is part of this boundary.
- **Backoffice server ↔ OAuth provider (Google or GitHub).** The browser carries redirects.
  Better Auth handles the callback and uses the provider identity and verification status
  for admission. The backoffice applies its own owner and invitation rules.
- **Backoffice server ↔ PostgreSQL.** PostgreSQL holds identities, sessions, invitations,
  audit records and rate-limit counters. Live IAM rows determine authorization.
- **Backoffice server ↔ assistant API.** The server sends the operations bearer and validates
  the response against pinned contracts before passing data to presentation.
  The metrics scraper instead connects to the backoffice on the private network.

## Surfaces and threats

| Surface | Threat | Mitigation | Existing evidence |
| --- | --- | --- | --- |
| OAuth callback | Login CSRF, identity spoofing, callback replay, and sign-in floods (S, T, D, E) | Better Auth binds state to the sign-in flow. Admission requires a verified owner or invited identity for a new account. The sign-in limiter persists counters in PostgreSQL. | `tests/integration/auth-security.test.ts` › `rejects a forged state with PKCE off, by the state check itself (error=state_mismatch)`<br>`tests/integration/auth-security.test.ts` › `rejects a callback replayed after it succeeded, and a state taken from another flow`<br>`tests/integration/auth.test.ts` › `rejects an unverified e-mail, even the owner's`<br>`tests/integration/auth.test.ts` › `limits sign-in attempts with database-backed counters` |
| Session cookie | Forgery, theft, and reuse after expiry or revocation (S, I, E) | The cookie is signed, HttpOnly, host-only, and SameSite=Lax. HTTPS configuration adds Secure. Better Auth reads sessions from PostgreSQL with cookie caching disabled. Sign-out deletes the server-side session. | `tests/integration/auth.test.ts` › `emits Secure host-scoped session cookies for an HTTPS-configured OAuth callback`<br>`tests/integration/auth-security.test.ts` › `rejects a tampered signature, a cookie signed with another secret and a bare token`<br>`tests/integration/auth-security.test.ts` › `issues sessions that last the configured hours, and ignores one that has expired`<br>`tests/integration/auth-security.test.ts` › `sign-out deletes the server-side session: the old cookie is dead afterwards` |
| Invitation link | Disclosure, use by the wrong identity, and reuse (I, T, E) | The landing route moves the token to a short-lived HttpOnly cookie and redirects with no-store and no-referrer. The database stores a digest. Admission binds the invitation to a verified e-mail and consumes it within the account creation transaction. | `tests/browser/invitation.spec.ts` › `invitation lifecycle: invite, accept as viewer, read-only, revoke`<br>`tests/unit/access.test.ts` › `refuses an invitation presented by a different e-mail or after expiry or revocation` |
| Server actions | Cross-site mutations, stale owner privileges, owner lockout, and disputed changes (T, R, D, E) | Next.js checks the request Origin against the request host. Each mutation checks the live role, and the store checks it again in the transaction. The removal path protects the actor and configured owner. Allowed mutations record the actor and subject IDs. | `tests/unit/authz-matrix.test.ts` › `lists every server action, route handler and page, with every guard verified`<br>`tests/integration/authz-matrix.test.ts` › `re-reads the role on every request: a demoted owner loses access at once`<br>`tests/integration/authz-matrix.test.ts` › `an owner cannot remove themselves or the configured owner, even as another owner`<br>`tests/integration/authz-matrix.test.ts` › `the audit trail records the actor id of each allowed mutation and none of the refused`<br>Server-action Origin check: No test. |
| Private ops read | Unauthorized data access, credential leakage, and unsafe API responses (I, T, E) | The panel requires a live read role. The server sends the bearer with no-store, refuses redirects, and validates the response. Failure returns an unavailable reading and redacted diagnostics. | `tests/unit/operations.test.ts` › `sends the bearer token, never caches and refuses redirects`<br>`tests/unit/operations.test.ts` › `returns unavailable instead of passing a rendering crash to the dashboard`<br>`tests/unit/log-redaction.test.ts` › `a failing ops request leaves the bearer token out of logs and the reading` |
| Metrics endpoint | Unauthorized scrape and disclosure through metric labels (S, I, D) | `GET /internal/v1/ops/metrics` is off by default (404). When enabled it requires a distinct machine bearer (401 if absent or invalid). It emits no-store Prometheus text with bounded labels. The deployment contract keeps it on the private network. | `tests/unit/observability.test.ts` › `observability is off by default and scrape credentials are independent`<br>`tests/unit/observability.test.ts` › `bounded labels and histogram counts exclude arbitrary errors, credentials and URLs`<br>`tests/browser/operations.spec.ts` › `private machine metrics require a separate bearer and expose no credentials` |

`/healthz` is a liveness probe. `/readyz` checks auth configuration and database
readiness. Both return status JSON and the deployment contract keeps both private.
The Prometheus scrape is served by the separate metrics route above.

On browser-facing auth and panel routes, the proxy adds a nonce-based CSP, denies
framing and sets private, no-store caching. The CSP test covers the production policy.
`tests/unit/proxy-csp.test.ts` › `backoffice CSP is nonce-based, unframable and has no unsafe script sources in production`.

## Abuse cases and evidence limits

- **Authorization matrix.** The [permissions matrix](../reference/permissions.md) covers
  owners, viewers and anonymous callers. The static test checks guard placement on the
  real entry points. The PostgreSQL matrix drives permission checks and the corresponding
  use cases, including stale-role writes.
- **CSRF and Origin.** Better Auth's cookie-bearing auth POSTs and Next.js server actions
  use distinct checks. The handler test covers sign-out, sign-in and linking.
  `tests/integration/auth-security.test.ts` › `refuses a foreign Origin on every state-changing route when the request carries cookies`.
  A foreign Origin on an actual Next.js IAM action request has **No test**.
- **OAuth state mismatch and replay.** The state test isolates the check with PKCE off.
  The replay test checks both a previously successful callback and cross-flow state.
  Session replay after sign-out is a separate check in the session row.
- **Rate limiting.** The sign-in test observes a 429 and stored PostgreSQL counters.
  Attribution of the client IP through the intended VPS edge has **No test**.
- **Invitation reuse.** The browser test follows the URL through signup and then observes
  refusal at the landing route once the invitation is spent. The application test also
  retries admission with the same verified identity and token.
  `tests/unit/access.test.ts` › `admits an invited e-mail once, with the invited role, and records the acceptance`.
- **Last-owner removal.** The matrix tests the two safeguards used by the app. An actor
  cannot remove themselves, and another owner cannot remove the configured owner.
  These safeguards operate on the live IAM path with the configured owner identity.
- **Credential leakage into React Server Component (RSC) payloads or logs.** The
  PostgreSQL DTO test checks whitelisted fields and absence of planted stored secrets.
  The browser check scans rendered HTML for the fixture ops and observability tokens.
  The static leak scan checks source references and the ops failure test checks log output.
  A direct check of credential absence in raw RSC responses has **No test**.
  `tests/integration/auth-security.test.ts` › `member and invitation DTOs expose only whitelisted keys and no secret values`.<br>
  `tests/unit/leak-scan.test.ts` › `flags a planted file for every pattern and spelling, and passes a clean one`.<br>
  `tests/browser/operations.spec.ts` › `technical observation stays honest, accessible and separate from provider availability @mobile`.

## Residual risks

- **Real OAuth app configuration.** No test against the owner-managed Google and GitHub
  apps. The registered callback origins, credentials, and provider behavior remain
  unverified with those apps. The handler and browser tests use a fake provider.
- **TLS-only cookies outside local runs.** No test of Secure cookie handling in a browser
  over deployed TLS. The HTTPS-configured handler test verifies Set-Cookie attributes.
  The public edge still has to terminate TLS and deliver HSTS.
- **Proxy header trust.** No test through the pending `vps-ops` reverse proxy. Rate-limit
  attribution depends on the trusted `X-Forwarded-For` chain, and server-action Origin
  checks depend on the forwarded host. The edge also controls private route exposure
  and must redact invitation paths and OAuth callback queries from access logs.
- **Next.js action Origin enforcement.** No test sends a foreign Origin to a real IAM
  server action. The authorization matrix and Better Auth tests exercise their own checks.
- **Raw RSC credential leakage.** No test inspects the raw RSC response for credentials.
  The evidence covers source patterns, IAM DTOs, rendered HTML, and selected application
  logs. Deployed proxy log redaction remains unverified.
- **Stolen credentials.** A stolen valid session cookie can be used while its session
  remains valid. A copied machine bearer remains usable wherever its endpoint is reachable
  until the credential is removed or rotated.

## Related design decisions

- [Authentication and access](authentication.md)
- [Deployment contract](../deployment-contract.md)
- [ADR 005 · Better Auth and OAuth admission](../decisions/0005-backoffice-auth-better-auth.md)
- [ADR 006 · IAM in PostgreSQL](../decisions/0006-iam-in-postgresql.md)
- [ADR 007 · Private operations data source](../decisions/0007-ops-data-source.md)
