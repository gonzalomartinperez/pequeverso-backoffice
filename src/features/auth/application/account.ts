import { can } from "../domain/access.ts";
import {
  type AgentSummary,
  agentSummary,
  decodeAuditCursor,
  encodeAuditCursor,
  ipPrefix,
} from "../domain/sessions.ts";
import type { Actor } from "./access.ts";
import type { AuditEntry, AuditStore, Clock, SessionStore } from "./ports.ts";

// Account self-service (own sessions) and the owner's audit trail. The role is re-read per
// request by `requireActor` before any of these run; sessions are always scoped to the actor.

/** One of the actor's sessions, reduced for display (ADR 0017). */
export type SessionView = AgentSummary & {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  /** Network prefix (`203.0.113.0/24`), null when unknown or unparseable. */
  network: string | null;
  current: boolean;
};

export async function listSessions(
  deps: { sessions: SessionStore; clock: Clock },
  actor: Actor,
  currentSessionId: string,
): Promise<SessionView[]> {
  const records = await deps.sessions.listSessions(actor.id, deps.clock.now());
  return records.map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    lastSeenAt: record.updatedAt,
    expiresAt: record.expiresAt,
    network: ipPrefix(record.ipAddress),
    ...agentSummary(record.userAgent),
    current: record.id === currentSessionId,
  }));
}

export type RevokeSessionResult = "revoked" | "not_found" | "current";

/** Ends one of the actor's other sessions; the current one ends with "Salir", not here. */
export async function revokeSession(
  deps: { sessions: SessionStore },
  actor: Actor,
  sessionId: string,
  currentSessionId: string,
): Promise<RevokeSessionResult> {
  if (sessionId === currentSessionId) return "current";
  return (await deps.sessions.revokeSession(actor.id, sessionId)) ? "revoked" : "not_found";
}

export type RevokeOthersResult =
  | { ok: true; ended: number }
  | { ok: false; reason: "unknown_current" };

/**
 * Ends every session of the actor except the current one. The current session must be one of the
 * actor's live sessions: an empty or foreign id would otherwise end them all, current included.
 */
export async function revokeOtherSessions(
  deps: { sessions: SessionStore; clock: Clock },
  actor: Actor,
  currentSessionId: string,
): Promise<RevokeOthersResult> {
  const live = await deps.sessions.listSessions(actor.id, deps.clock.now());
  if (!currentSessionId || !live.some((record) => record.id === currentSessionId))
    return { ok: false, reason: "unknown_current" };
  return { ok: true, ended: await deps.sessions.revokeOtherSessions(actor.id, currentSessionId) };
}

export const AUDIT_PAGE_SIZE = 50;
const AUDIT_PAGE_MAX = 100;

export type AuditPage =
  | { ok: true; entries: AuditEntry[]; next: string | null }
  | { ok: false; reason: "forbidden" | "invalid_cursor" };

/**
 * A page of the audit trail for owners, newest first. Keyset pagination over (`at`, `id`): pages
 * neither skip nor repeat entries while new ones are written. `next` is null on the last page.
 */
export async function listAudit(
  deps: { audit: AuditStore },
  actor: Actor,
  cursor: string | null,
  limit = AUDIT_PAGE_SIZE,
): Promise<AuditPage> {
  if (!can(actor.role, "manage_access")) return { ok: false, reason: "forbidden" };
  const after = cursor === null ? null : decodeAuditCursor(cursor);
  if (cursor !== null && after === null) return { ok: false, reason: "invalid_cursor" };
  const size = Number.isSafeInteger(limit)
    ? Math.min(Math.max(limit, 1), AUDIT_PAGE_MAX)
    : AUDIT_PAGE_SIZE;
  const rows = await deps.audit.listAudit(after, size + 1);
  const entries = rows.slice(0, size);
  const last = entries.at(-1);
  return {
    ok: true,
    entries,
    next: rows.length > size && last ? encodeAuditCursor({ at: last.at, id: last.id }) : null,
  };
}
