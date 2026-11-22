// Own sessions and the audit trail against real PostgreSQL (roadmap M4.6, ADR 0017).
// Needs a disposable database: TEST_DATABASE_URL=postgres://… npm run test:integration
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { migrate } from "../../scripts/db-migrate.ts";
import { PostgresAccessStore } from "../../src/features/auth/adapters/postgres-access-store.ts";
import type { Actor } from "../../src/features/auth/application/access.ts";
import {
  listAudit,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "../../src/features/auth/application/account.ts";
import { assertDisposableDatabase } from "../../src/server/fixture-safety.ts";

const rawUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const baseUrl = rawUrl ? assertDisposableDatabase(rawUrl, false) : undefined;
const NOW = new Date("2026-11-22T12:00:00Z");
const owner: Actor = { id: "u-owner", email: "owner@example.test", role: "owner" };
const viewer: Actor = { id: "u-viewer", email: "viewer@example.test", role: "viewer" };

describe("account sessions and audit (PostgreSQL)", {
  skip: !baseUrl && "TEST_DATABASE_URL not set",
}, () => {
  const database = `bo_test_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let pool: pg.Pool;
  let store: PostgresAccessStore;
  const clock = { now: () => NOW };

  before(async () => {
    admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(baseUrl ?? "");
    url.pathname = `/${database}`;
    await migrate(url.toString(), path.resolve(import.meta.dirname, "../../migrations"));
    pool = new pg.Pool({ connectionString: url.toString() });
    pool.on("error", () => undefined);
    store = new PostgresAccessStore(pool);
    for (const user of [owner, viewer])
      await pool.query(
        `INSERT INTO auth_user (id, name, email, "emailVerified", role) VALUES ($1, 'Synthetic', $2, true, $3)`,
        [user.id, user.email, user.role],
      );
  });

  after(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin?.end();
  });

  async function session(
    id: string,
    userId: string,
    updatedAt: string,
    expiresAt = "2026-11-22T20:00:00Z",
  ) {
    await pool.query(
      `INSERT INTO auth_session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
         VALUES ($1, $2, $3, '2026-11-20T08:00:00Z', $4, $5, $6, $7)`,
      [
        id,
        expiresAt,
        `synthetic-token-${id}`,
        updatedAt,
        "2001:db8:85a3:8d3::7348",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Version/18.1 Safari/605.1.15",
        userId,
      ],
    );
  }

  it("lists the actor's live sessions newest first, reduced and without tokens", async () => {
    await session("s-owner-a", owner.id, "2026-11-22T09:00:00Z");
    await session("s-owner-b", owner.id, "2026-11-22T11:00:00Z");
    await session("s-owner-old", owner.id, "2026-11-21T09:00:00Z", "2026-11-22T11:59:59Z");
    await session("s-viewer", viewer.id, "2026-11-22T10:00:00Z");
    const views = await listSessions({ sessions: store, clock }, owner, "s-owner-a");
    assert.deepEqual(
      views.map((view) => [view.id, view.current, view.network, view.browser, view.system]),
      [
        ["s-owner-b", false, "2001:db8:85a3::/48", "Safari", "macOS"],
        ["s-owner-a", true, "2001:db8:85a3::/48", "Safari", "macOS"],
      ],
    );
    const text = JSON.stringify(views);
    assert.ok(
      !text.includes("synthetic-token") && !text.includes("7348") && !text.includes("14_6"),
    );
  });

  it("revokes only the actor's own other sessions", async () => {
    const deps = { sessions: store, clock };
    assert.equal(await revokeSession(deps, owner, "s-viewer", "s-owner-a"), "not_found");
    assert.equal(await revokeSession(deps, owner, "s-owner-a", "s-owner-a"), "current");
    assert.deepEqual(await revokeOtherSessions(deps, owner, "s-viewer"), {
      ok: false,
      reason: "unknown_current",
    });
    assert.deepEqual(await revokeOtherSessions(deps, owner, "s-owner-a"), { ok: true, ended: 2 });
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM auth_session ORDER BY id");
    assert.deepEqual(
      rows.map((row) => row.id),
      ["s-owner-a", "s-viewer"],
    );
    assert.equal(await revokeSession(deps, viewer, "s-viewer", "other"), "revoked");
  });

  it("pages the audit newest first with live names, ties and sub-millisecond times", async () => {
    await pool.query(
      `INSERT INTO backoffice_invitation (id, email, role, token_digest, created_by, created_at, expires_at)
         VALUES ('inv-1', 'new@example.test', 'viewer', $1, $2, '2026-11-20T10:00:00Z', '2026-11-22T10:00:00Z')`,
      ["a".repeat(64), owner.id],
    );
    const rows: [string, string, string | null, string, string][] = [
      [
        "00000000-0000-4000-8000-000000000001",
        "invitation_created",
        owner.id,
        "inv-1",
        "2026-11-20T10:00:00.000Z",
      ],
      [
        "00000000-0000-4000-8000-000000000002",
        "invitation_accepted",
        null,
        "inv-1",
        "2026-11-21T10:00:00.123456Z",
      ],
      [
        "00000000-0000-4000-8000-000000000003",
        "member_removed",
        owner.id,
        "u-gone",
        "2026-11-21T10:00:00.123999Z",
      ],
      [
        "00000000-0000-4000-8000-000000000004",
        "invitation_revoked",
        "u-gone",
        "inv-1",
        "2026-11-22T10:00:00.000Z",
      ],
      [
        "00000000-0000-4000-8000-000000000005",
        "member_removed",
        owner.id,
        viewer.id,
        "2026-11-22T10:00:00.000Z",
      ],
    ];
    for (const [id, action, actor, subject, at] of rows)
      await pool.query(
        "INSERT INTO backoffice_access_audit (id, action, actor_id, subject_id, at) VALUES ($1, $2, $3, $4, $5)",
        [id, action, actor, subject, at],
      );
    const seen: string[] = [];
    let cursor: string | null = null;
    const pages: number[] = [];
    do {
      const page = await listAudit({ audit: store }, owner, cursor, 2);
      assert.ok(page.ok);
      pages.push(page.entries.length);
      seen.push(...page.entries.map((entry) => entry.id.slice(-1)));
      cursor = page.next;
    } while (cursor);
    // Ties order by id; the two 10:00:00.123xxx entries share one millisecond.
    assert.deepEqual(seen, ["5", "4", "3", "2", "1"]);
    assert.deepEqual(pages, [2, 2, 1]);
    const first = await listAudit({ audit: store }, owner, null, 5);
    assert.ok(first.ok);
    const byId = new Map(first.entries.map((entry) => [entry.id.slice(-1), entry]));
    assert.equal(byId.get("1")?.actorEmail, owner.email);
    assert.equal(byId.get("1")?.subjectEmail, "new@example.test");
    assert.equal(byId.get("2")?.actorId, null);
    assert.equal(byId.get("4")?.actorEmail, null, "a removed actor has no name");
    assert.equal(byId.get("3")?.subjectEmail, null, "a removed member has no name");
    assert.equal(byId.get("5")?.subjectEmail, viewer.email);
    assert.equal(byId.get("2")?.at.toISOString(), "2026-11-21T10:00:00.123Z");
    assert.deepEqual(await listAudit({ audit: store }, viewer, null), {
      ok: false,
      reason: "forbidden",
    });
  });

  it("refuses an unknown audit action instead of passing it through", async () => {
    await pool.query(
      "ALTER TABLE backoffice_access_audit DROP CONSTRAINT backoffice_access_audit_action_check",
    );
    await pool.query(
      "INSERT INTO backoffice_access_audit (action, subject_id, at) VALUES ('unexpected', 'x', '2026-11-23T00:00:00Z')",
    );
    await assert.rejects(store.listAudit(null, 1), /invalid audit action/);
  });
});
