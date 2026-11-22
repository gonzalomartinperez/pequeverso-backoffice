import type { Pool, PoolClient } from "pg";
import type {
  AccessStore,
  AuditEntry,
  AuditStore,
  Member,
  NewInvitation,
  SessionRecord,
  SessionStore,
} from "../application/ports.ts";
import { type InvitationRecord, isRole, type Role } from "../domain/access.ts";
import type { AuditCursor } from "../domain/sessions.ts";

/**
 * PostgreSQL persistence for invitations, members (Better Auth's `auth_user` table plus its
 * `role` column) and the access audit trail. Schema: migrations/*.sql.
 */
type InvitationRow = {
  id: string;
  email: string;
  role: string;
  created_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
};

function invitation(row: InvitationRow): InvitationRecord {
  if (!isRole(row.role)) throw new Error("invalid role in storage");
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  };
}

type MemberRow = {
  id: string;
  email: string;
  role: string;
  created_at: Date;
  providers: string[] | null;
  active_sessions: string | number;
};

function member(row: MemberRow): Member {
  if (!isRole(row.role)) throw new Error("invalid role in storage");
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    providers: (row.providers ?? []).filter(Boolean).sort(),
    activeSessions: Number(row.active_sessions),
  };
}

const MEMBER_SELECT = `
  SELECT u.id, lower(u.email) AS email, u.role, u."createdAt" AS created_at,
         array_remove(array_agg(DISTINCT a."providerId"), NULL) AS providers,
         (SELECT count(*) FROM auth_session s WHERE s."userId" = u.id AND s."expiresAt" > now())
           AS active_sessions
    FROM auth_user u
    LEFT JOIN auth_account a ON a."userId" = u.id`;

const INVITATION_COLUMNS = "id, email, role, created_at, expires_at, accepted_at, revoked_at";

// Never the session token: only what the account's own session list may show (ADR 0017).
const SESSION_SELECT = `
  SELECT id, "createdAt" AS created_at, "updatedAt" AS updated_at, "expiresAt" AS expires_at,
         "ipAddress" AS ip_address, "userAgent" AS user_agent
    FROM auth_session`;

type SessionRow = {
  id: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
};

const AUDIT_ACTIONS = [
  "invitation_created",
  "invitation_revoked",
  "invitation_accepted",
  "member_removed",
] as const;

type AuditRow = {
  id: string;
  action: string;
  at: Date;
  actor_id: string | null;
  actor_email: string | null;
  subject_id: string;
  subject_email: string | null;
};

/**
 * Audit page with names resolved now (live join): the actor's current e-mail, the invitation's
 * e-mail for invitation entries, the member's e-mail for member entries (null once removed).
 * Ordered and compared at millisecond precision, the precision of the cursor.
 */
const AUDIT_SELECT = `
  SELECT a.id, a.action, date_trunc('milliseconds', a.at) AS at, a.actor_id,
         lower(actor.email) AS actor_email, a.subject_id,
         CASE WHEN a.action = 'member_removed' THEN lower(member.email) ELSE invitation.email END
           AS subject_email
    FROM backoffice_access_audit a
    LEFT JOIN auth_user actor ON actor.id = a.actor_id
    LEFT JOIN auth_user member ON member.id = a.subject_id
    LEFT JOIN backoffice_invitation invitation ON invitation.id = a.subject_id
   WHERE $1::timestamptz IS NULL
      OR (date_trunc('milliseconds', a.at), a.id) < ($1::timestamptz, $2::text)
   ORDER BY date_trunc('milliseconds', a.at) DESC, a.id DESC
   LIMIT $3`;

function auditEntry(row: AuditRow): AuditEntry {
  const action = AUDIT_ACTIONS.find((known) => known === row.action);
  if (!action) throw new Error("invalid audit action in storage");
  return {
    id: row.id,
    action,
    at: row.at,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    subjectId: row.subject_id,
    subjectEmail: row.subject_email,
  };
}

export class PostgresAccessStore implements AccessStore, SessionStore, AuditStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Locks the actor's row and confirms it is still an owner; part of every owner mutation. */
  private async lockOwner(client: PoolClient, actorId: string): Promise<boolean> {
    const { rowCount } = await client.query(
      "SELECT 1 FROM auth_user WHERE id = $1 AND role = 'owner' FOR UPDATE",
      [actorId],
    );
    return rowCount === 1;
  }

  private audit(
    client: PoolClient,
    action: string,
    actorId: string | null,
    subjectId: string,
    at: Date,
  ) {
    return client.query(
      "INSERT INTO backoffice_access_audit (action, actor_id, subject_id, at) VALUES ($1, $2, $3, $4)",
      [action, actorId, subjectId, at],
    );
  }

  async createInvitation(input: NewInvitation): Promise<"created" | "forbidden" | "conflict"> {
    try {
      return await this.transaction(async (client) => this.insertInvitation(client, input));
    } catch (error) {
      // Two owners inviting the same e-mail at once: the one-open-invitation index rejects one.
      if ((error as { code?: unknown } | null)?.code === "23505") return "conflict";
      throw error;
    }
  }

  private async insertInvitation(
    client: PoolClient,
    input: NewInvitation,
  ): Promise<"created" | "forbidden"> {
    if (!(await this.lockOwner(client, input.createdBy))) return "forbidden";
    // At most one open invitation per e-mail: a new one supersedes earlier pending ones.
    await client.query(
      "UPDATE backoffice_invitation SET revoked_at = $2 WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL",
      [input.email, input.createdAt],
    );
    await client.query(
      `INSERT INTO backoffice_invitation (id, email, role, token_digest, created_by, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.id,
        input.email,
        input.role,
        input.tokenDigest,
        input.createdBy,
        input.createdAt,
        input.expiresAt,
      ],
    );
    await this.audit(client, "invitation_created", input.createdBy, input.id, input.createdAt);
    return "created";
  }

  async invitationByDigest(digest: string): Promise<InvitationRecord | null> {
    const { rows } = await this.pool.query<InvitationRow>(
      `SELECT ${INVITATION_COLUMNS} FROM backoffice_invitation WHERE token_digest = $1`,
      [digest],
    );
    return rows[0] ? invitation(rows[0]) : null;
  }

  async revokeInvitation(id: string, actorId: string, now: Date): Promise<boolean> {
    return this.transaction(async (client) => {
      if (!(await this.lockOwner(client, actorId))) return false;
      const result = await client.query(
        "UPDATE backoffice_invitation SET revoked_at = $2 WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL",
        [id, now],
      );
      if (result.rowCount !== 1) return false;
      await this.audit(client, "invitation_revoked", actorId, id, now);
      return true;
    });
  }

  async listInvitations(): Promise<InvitationRecord[]> {
    const { rows } = await this.pool.query<InvitationRow>(
      `SELECT ${INVITATION_COLUMNS} FROM backoffice_invitation ORDER BY created_at DESC LIMIT 100`,
    );
    return rows.map(invitation);
  }

  async listMembers(): Promise<Member[]> {
    const { rows } = await this.pool.query<MemberRow>(
      `${MEMBER_SELECT} GROUP BY u.id ORDER BY u."createdAt"`,
    );
    return rows.map(member);
  }

  async memberByEmail(email: string): Promise<Member | null> {
    const { rows } = await this.pool.query<MemberRow>(
      `${MEMBER_SELECT} WHERE lower(u.email) = $1 GROUP BY u.id`,
      [email],
    );
    return rows[0] ? member(rows[0]) : null;
  }

  async memberRole(userId: string): Promise<Role | null> {
    const { rows } = await this.pool.query<{ role: string }>(
      "SELECT role FROM auth_user WHERE id = $1",
      [userId],
    );
    const role = rows[0]?.role;
    return isRole(role) ? role : null;
  }

  async removeMember(userId: string, actorId: string, now: Date): Promise<Member | null> {
    return this.transaction(async (client) => {
      if (!(await this.lockOwner(client, actorId))) return null;
      const { rows } = await client.query<MemberRow>(
        `${MEMBER_SELECT} WHERE u.id = $1 GROUP BY u.id`,
        [userId],
      );
      if (!rows[0]) return null;
      // Sessions and linked accounts reference the user with ON DELETE CASCADE.
      await client.query("DELETE FROM auth_user WHERE id = $1", [userId]);
      await this.audit(client, "member_removed", actorId, userId, now);
      return member(rows[0]);
    });
  }

  async listSessions(userId: string, now: Date): Promise<SessionRecord[]> {
    const { rows } = await this.pool.query<SessionRow>(
      `${SESSION_SELECT} WHERE "userId" = $1 AND "expiresAt" > $2 ORDER BY "updatedAt" DESC, id DESC`,
      [userId, now],
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM auth_session WHERE id = $1 AND "userId" = $2',
      [sessionId, userId],
    );
    return result.rowCount === 1;
  }

  async revokeOtherSessions(userId: string, keepSessionId: string, now: Date): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM auth_session WHERE "userId" = $1 AND id <> $2 AND "expiresAt" > $3',
      [userId, keepSessionId, now],
    );
    return result.rowCount ?? 0;
  }

  async listAudit(cursor: AuditCursor | null, limit: number): Promise<AuditEntry[]> {
    const { rows } = await this.pool.query<AuditRow>(AUDIT_SELECT, [
      cursor?.at ?? null,
      cursor?.id ?? null,
      limit,
    ]);
    return rows.map(auditEntry);
  }
}
