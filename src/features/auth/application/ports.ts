import type { InvitationRecord, Role } from "../domain/access.ts";
import type { AuditCursor } from "../domain/sessions.ts";

/** A backoffice account as the access screens show it. Never includes tokens or provider data. */
export type Member = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  providers: string[];
  activeSessions: number;
};

export type NewInvitation = {
  id: string;
  email: string;
  role: Role;
  tokenDigest: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * Persistence of invitations, members and the access audit. Every mutation re-verifies inside its
 * own transaction that the actor is still an owner (locking the actor's row) and writes its audit
 * entry (actor id, action, subject id, time) in that same transaction.
 */
export interface AccessStore {
  /**
   * Supersedes earlier open invitations for the e-mail. `forbidden` when the actor is no longer an
   * owner; `conflict` when a concurrent invitation for the same e-mail won the race.
   */
  createInvitation(invitation: NewInvitation): Promise<"created" | "forbidden" | "conflict">;
  invitationByDigest(digest: string): Promise<InvitationRecord | null>;
  revokeInvitation(id: string, actorId: string, now: Date): Promise<boolean>;
  listInvitations(): Promise<InvitationRecord[]>;
  listMembers(): Promise<Member[]>;
  memberByEmail(email: string): Promise<Member | null>;
  memberRole(userId: string): Promise<Role | null>;
  /** Deletes the account (its sessions and linked identities cascade). Null when not allowed. */
  removeMember(userId: string, actorId: string, now: Date): Promise<Member | null>;
}

/**
 * Consumes an invitation during account creation. Bound to the sign-up's own database transaction,
 * so a rolled-back sign-up never spends the invitation and no second connection is needed.
 */
export interface InvitationConsumer {
  /** Atomically accepts a pending, unexpired invitation for `email` (audited as the system). */
  consumeInvitation(
    digest: string,
    email: string,
    now: Date,
  ): Promise<{ id: string; role: Role } | null>;
}

export interface Secrets {
  /** 32 random bytes, base64url (43 chars). */
  token(): string;
  digest(token: string): string;
  id(): string;
}

export interface Clock {
  now(): Date;
}

/** An active session of one account, as stored (raw network data never leaves the server). */
export type SessionRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

/** The account's own sessions (Better Auth's session table). Never exposes the session token. */
export interface SessionStore {
  /** Unexpired sessions of `userId`, newest first. */
  listSessions(userId: string, now: Date): Promise<SessionRecord[]>;
  /** Deletes one session of `userId`; false when it is not theirs or no longer exists. */
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  /** Deletes every session of `userId` except `keepSessionId`; returns how many ended. */
  revokeOtherSessions(userId: string, keepSessionId: string): Promise<number>;
}

type AuditAction =
  | "invitation_created"
  | "invitation_revoked"
  | "invitation_accepted"
  | "member_removed";

/**
 * One audit entry with names resolved at read time (live join): the stored row keeps ids only,
 * so a removed account or an unknown subject reads as null rather than a stale copy.
 */
export type AuditEntry = {
  id: string;
  action: AuditAction;
  at: Date;
  actorId: string | null;
  actorEmail: string | null;
  subjectId: string;
  subjectEmail: string | null;
};

export interface AuditStore {
  /** Up to `limit` entries, newest first (`at` then `id` descending), strictly after `cursor`. */
  listAudit(cursor: AuditCursor | null, limit: number): Promise<AuditEntry[]>;
}
