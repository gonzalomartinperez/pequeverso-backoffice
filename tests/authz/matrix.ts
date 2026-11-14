// Committed authorization matrix. The single source of permissions is `can()` in
// src/features/auth/domain/access.ts: expectations per role are derived from it, never restated.
// `scripts/authz-surface.ts` enumerates the real surface; tests/unit/authz-matrix.test.ts fails on
// any unlisted or stale row, so adding a server action, route handler or panel page means adding
// a row here (and its coverage).
import { type Action, can, type Role } from "../../src/features/auth/domain/access.ts";

/** Who may call it: a permission from the policy, or a non-session mechanism named explicitly. */
export type Guard = Action | "public" | "better-auth" | "bearer-token";
export type Caller = Role | "anonymous";
export type Outcome =
  | "allowed"
  | "redirect:/ingresar"
  | "redirect:/panel"
  | "delegated:better-auth"
  | "token-required";

export type Row = {
  id: string;
  guard: Guard;
  /** Test that exercises the row beyond the static guard check. */
  coveredBy: string;
};

const AUTHZ = "tests/integration/authz-matrix.test.ts";
const AUTH = "tests/integration/auth.test.ts";
const SMOKE = "scripts/smoke-postgres.sh";

export const MATRIX: readonly Row[] = [
  {
    id: "action:src/app/panel/accesos/actions.ts#inviteAction",
    guard: "manage_access",
    coveredBy: AUTHZ,
  },
  {
    id: "action:src/app/panel/accesos/actions.ts#removeMemberAction",
    guard: "manage_access",
    coveredBy: AUTHZ,
  },
  {
    id: "action:src/app/panel/accesos/actions.ts#revokeInvitationAction",
    guard: "manage_access",
    coveredBy: AUTHZ,
  },
  { id: "route:src/app/api/auth/[...all]/route.ts#GET", guard: "better-auth", coveredBy: AUTH },
  { id: "route:src/app/api/auth/[...all]/route.ts#POST", guard: "better-auth", coveredBy: AUTH },
  { id: "route:src/app/healthz/route.ts#GET", guard: "public", coveredBy: SMOKE },
  { id: "route:src/app/readyz/route.ts#GET", guard: "public", coveredBy: SMOKE },
  { id: "route:src/app/invitacion/[token]/route.ts#GET", guard: "public", coveredBy: AUTH },
  {
    id: "route:src/app/internal/v1/ops/metrics/route.ts#GET",
    guard: "bearer-token",
    coveredBy: "tests/unit/observability.test.ts",
  },
  { id: "page:src/app/panel/layout.tsx#default", guard: "read_operations", coveredBy: AUTHZ },
  { id: "page:src/app/panel/page.tsx#default", guard: "read_operations", coveredBy: AUTHZ },
  {
    id: "page:src/app/panel/analitica/page.tsx#default",
    guard: "read_operations",
    coveredBy: AUTHZ,
  },
  { id: "page:src/app/panel/cuenta/page.tsx#default", guard: "read_operations", coveredBy: AUTHZ },
  { id: "page:src/app/panel/accesos/page.tsx#default", guard: "manage_access", coveredBy: AUTHZ },
];

/** Expected outcome of the guard (`requireActor`) for a caller; derived from `can()`. */
export function expectedOutcome(guard: Guard, caller: Caller): Outcome {
  if (guard === "public") return "allowed";
  if (guard === "better-auth") return "delegated:better-auth";
  if (guard === "bearer-token") return "token-required";
  if (caller === "anonymous") return "redirect:/ingresar";
  return can(caller, guard) ? "allowed" : "redirect:/panel";
}
