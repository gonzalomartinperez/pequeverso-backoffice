# Permissions matrix

Generated from `tests/authz/matrix.ts` by `scripts/generate-permissions.ts`; do not edit by hand.
Each row is one server action, route handler or panel page. Outcomes derive from `can()` in
`src/features/auth/domain/access.ts`; `tests/unit/authz-matrix.test.ts` fails when this list and the
source drift apart.

| Kind | Entry | Guard | Owner | Viewer | Anonymous |
|---|---|---|---|---|---|
| action | `src/app/panel/accesos/actions.ts#inviteAction` | `manage_access` | `allowed` | `redirect:/panel` | `redirect:/ingresar` |
| action | `src/app/panel/accesos/actions.ts#removeMemberAction` | `manage_access` | `allowed` | `redirect:/panel` | `redirect:/ingresar` |
| action | `src/app/panel/accesos/actions.ts#revokeInvitationAction` | `manage_access` | `allowed` | `redirect:/panel` | `redirect:/ingresar` |
| route | `src/app/api/auth/[...all]/route.ts#GET` | `better-auth` | `delegated:better-auth` | `delegated:better-auth` | `delegated:better-auth` |
| route | `src/app/api/auth/[...all]/route.ts#POST` | `better-auth` | `delegated:better-auth` | `delegated:better-auth` | `delegated:better-auth` |
| route | `src/app/healthz/route.ts#GET` | `public` | `allowed` | `allowed` | `allowed` |
| route | `src/app/readyz/route.ts#GET` | `public` | `allowed` | `allowed` | `allowed` |
| route | `src/app/invitacion/[token]/route.ts#GET` | `public` | `allowed` | `allowed` | `allowed` |
| route | `src/app/internal/v1/ops/metrics/route.ts#GET` | `bearer-token` | `token-required` | `token-required` | `token-required` |
| page | `src/app/panel/layout.tsx#default` | `read_operations` | `allowed` | `allowed` | `redirect:/ingresar` |
| page | `src/app/panel/page.tsx#default` | `read_operations` | `allowed` | `allowed` | `redirect:/ingresar` |
| page | `src/app/panel/analitica/page.tsx#default` | `read_operations` | `allowed` | `allowed` | `redirect:/ingresar` |
| page | `src/app/panel/cuenta/page.tsx#default` | `read_operations` | `allowed` | `allowed` | `redirect:/ingresar` |
| page | `src/app/panel/accesos/page.tsx#default` | `manage_access` | `allowed` | `redirect:/panel` | `redirect:/ingresar` |
