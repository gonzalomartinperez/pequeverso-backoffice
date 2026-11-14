// Committed authorization matrix. The single source of permissions is `can()` in
// src/features/auth/domain/access.ts: expectations per role are derived from it, never restated.
// `scripts/authz-surface.ts` enumerates the real surface and tests/authz/check.ts compares it with
// this list, so adding a server action, route handler or page means adding a row here (and its
// coverage). Layouts do not gate their children in Next.js: every page carries its own guard.
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

/** A test that must mention `needle` (a path or export name of the row), or no test beyond the static check. */
type Covers = { file: string; needle: string } | "static-only";

export type Row = { id: string; guard: Guard; covers: Covers };

const AUTHZ = "tests/integration/authz-matrix.test.ts";
const AUTH = "tests/integration/auth.test.ts";
const BROWSER = "tests/browser/backoffice.spec.ts";
const SMOKE = "scripts/smoke-postgres.sh";
const accesos = "action:src/app/panel/accesos/actions.ts#";

export const MATRIX: readonly Row[] = [
  {
    id: `${accesos}inviteAction`,
    guard: "manage_access",
    covers: { file: AUTHZ, needle: "inviteAction" },
  },
  {
    id: `${accesos}removeMemberAction`,
    guard: "manage_access",
    covers: { file: AUTHZ, needle: "removeMemberAction" },
  },
  {
    id: `${accesos}revokeInvitationAction`,
    guard: "manage_access",
    covers: { file: AUTHZ, needle: "revokeInvitationAction" },
  },
  {
    id: "route:src/app/api/auth/[...all]/route.ts#GET",
    guard: "better-auth",
    covers: { file: AUTH, needle: "/api/auth" },
  },
  {
    id: "route:src/app/api/auth/[...all]/route.ts#POST",
    guard: "better-auth",
    covers: { file: AUTH, needle: "/api/auth" },
  },
  {
    id: "route:src/app/healthz/route.ts#GET",
    guard: "public",
    covers: { file: SMOKE, needle: "healthz" },
  },
  {
    id: "route:src/app/readyz/route.ts#GET",
    guard: "public",
    covers: { file: SMOKE, needle: "readyz" },
  },
  {
    id: "route:src/app/invitacion/[token]/route.ts#GET",
    guard: "public",
    covers: { file: BROWSER, needle: "/invitacion/" },
  },
  {
    id: "route:src/app/internal/v1/ops/metrics/route.ts#GET",
    guard: "bearer-token",
    covers: { file: BROWSER, needle: "/internal/v1/ops/metrics" },
  },
  { id: "page:src/app/layout.tsx#default", guard: "public", covers: "static-only" },
  { id: "page:src/app/page.tsx#default", guard: "public", covers: "static-only" },
  {
    id: "page:src/app/ingresar/page.tsx#default",
    guard: "public",
    covers: { file: BROWSER, needle: '"/ingresar"' },
  },
  {
    id: "page:src/app/panel/layout.tsx#default",
    guard: "read_operations",
    covers: { file: BROWSER, needle: '"/panel"' },
  },
  {
    id: "page:src/app/panel/page.tsx#default",
    guard: "read_operations",
    covers: { file: BROWSER, needle: '"/panel"' },
  },
  {
    id: "page:src/app/panel/analitica/page.tsx#default",
    guard: "read_operations",
    covers: { file: BROWSER, needle: "/panel/analitica" },
  },
  {
    id: "page:src/app/panel/cuenta/page.tsx#default",
    guard: "read_operations",
    covers: { file: BROWSER, needle: "/panel/cuenta" },
  },
  {
    id: "page:src/app/panel/accesos/page.tsx#default",
    guard: "manage_access",
    covers: { file: BROWSER, needle: "/panel/accesos" },
  },
];

/** Expected outcome of the guard (`requireActor`) for a caller; derived from `can()`. */
export function expectedOutcome(guard: Guard, caller: Caller): Outcome {
  if (guard === "public") return "allowed";
  if (guard === "better-auth") return "delegated:better-auth";
  if (guard === "bearer-token") return "token-required";
  if (caller === "anonymous") return "redirect:/ingresar";
  return can(caller, guard) ? "allowed" : "redirect:/panel";
}
