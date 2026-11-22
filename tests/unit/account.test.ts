import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import type { Actor } from "../../src/features/auth/application/access.ts";
import {
  AUDIT_PAGE_SIZE,
  listAudit,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "../../src/features/auth/application/account.ts";
import type {
  AuditEntry,
  AuditStore,
  SessionRecord,
  SessionStore,
} from "../../src/features/auth/application/ports.ts";
import {
  type AuditCursor,
  agentSummary,
  decodeAuditCursor,
  encodeAuditCursor,
  ipPrefix,
} from "../../src/features/auth/domain/sessions.ts";
import { propertyOptions } from "./support/property.ts";

const owner: Actor = { id: "u-owner", email: "owner@example.test", role: "owner" };
const viewer: Actor = { id: "u-viewer", email: "viewer@example.test", role: "viewer" };
const NOW = new Date("2026-11-22T12:00:00Z");

describe("session privacy reductions", () => {
  it("cuts IPv4 to /24 and IPv6 to /48, and shows mapped IPv4 as IPv4", () => {
    assert.equal(ipPrefix("203.0.113.77"), "203.0.113.0/24");
    assert.equal(ipPrefix(" 10.1.2.3 "), "10.1.2.0/24");
    assert.equal(ipPrefix("2001:db8:85a3:8d3:1319:8a2e:370:7348"), "2001:db8:85a3::/48");
    assert.equal(ipPrefix("2001:DB8::1"), "2001:db8:0::/48");
    assert.equal(ipPrefix("::1"), "0:0:0::/48");
    assert.equal(ipPrefix("::"), "0:0:0::/48");
    assert.equal(ipPrefix("::ffff:198.51.100.9"), "198.51.100.0/24");
    assert.equal(ipPrefix("::ffff:c633:6409"), "198.51.100.0/24");
    assert.equal(ipPrefix("64:ff9b::198.51.100.9"), "64:ff9b:0::/48");
  });

  it("withholds anything that is not an address", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "256.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "01.2.3.4",
      "1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:8:9",
      "1::2::3",
      "12345::",
      "1:2:3:4:5:6:7::8",
      "::ffff:300.1.1.1",
      "example.test",
      "203.0.113.7, 10.0.0.1",
    ])
      assert.equal(ipPrefix(bad), null, String(bad));
  });

  it("summarizes the agent to browser and system families only", () => {
    const cases: [string | null, string | null, string | null][] = [
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
        "Edge",
        "Windows",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
        "Safari",
        "macOS",
      ],
      [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
        "Chrome",
        "iOS",
      ],
      [
        "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Firefox",
        "Linux",
      ],
      [
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 OPR/85.0",
        "Opera",
        "Android",
      ],
      ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/131.0 Safari/537.36", "Chrome", "ChromeOS"],
      ["curl/8.5.0", null, null],
      [null, null, null],
    ];
    for (const [agent, browser, system] of cases)
      assert.deepEqual(agentSummary(agent), { browser, system }, String(agent));
  });

  it("round-trips audit cursors and rejects foreign ones", () => {
    const cursor = { at: new Date("2026-11-22T10:00:00.123Z"), id: "9b2f-uuid-1" };
    assert.deepEqual(decodeAuditCursor(encodeAuditCursor(cursor)), cursor);
    for (const bad of [
      null,
      undefined,
      "",
      "abc",
      "1.",
      ".id",
      "1.id with space",
      "1.a/b",
      "-1.id",
    ])
      assert.equal(decodeAuditCursor(bad), null, String(bad));
    assert.equal(decodeAuditCursor(`1.${"a".repeat(65)}`), null);
    assert.equal(decodeAuditCursor("9999999999999999.id"), null);
  });

  it("cursor round trip holds for any valid position (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8_640_000_000_000 }),
        fc.stringMatching(/^[0-9A-Za-z-]{1,64}$/),
        (ms, id) => {
          const cursor = { at: new Date(ms), id };
          assert.deepEqual(decodeAuditCursor(encodeAuditCursor(cursor)), cursor);
        },
      ),
      propertyOptions("property"),
    );
  });
});

class MemorySessions implements SessionStore {
  calls: string[] = [];
  records: (SessionRecord & { userId: string })[];
  constructor(records: (SessionRecord & { userId: string })[]) {
    this.records = records;
  }
  async listSessions(userId: string, now: Date) {
    this.calls.push(`list:${userId}:${now.toISOString()}`);
    return this.records.filter((r) => r.userId === userId && r.expiresAt > now);
  }
  async revokeSession(userId: string, sessionId: string) {
    const before = this.records.length;
    this.records = this.records.filter((r) => !(r.userId === userId && r.id === sessionId));
    return this.records.length < before;
  }
  async revokeOtherSessions(userId: string, keep: string) {
    const before = this.records.length;
    this.records = this.records.filter((r) => r.userId !== userId || r.id === keep);
    return before - this.records.length;
  }
}

const session = (id: string, userId: string, extra: Partial<SessionRecord> = {}) => ({
  id,
  userId,
  createdAt: new Date("2026-11-20T08:00:00Z"),
  updatedAt: new Date("2026-11-22T11:00:00Z"),
  expiresAt: new Date("2026-11-22T16:00:00Z"),
  ipAddress: "203.0.113.77",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  ...extra,
});

describe("own sessions", () => {
  it("lists only the actor's live sessions, reduced, and marks the current one", async () => {
    const sessions = new MemorySessions([
      session("s1", owner.id),
      session("s2", owner.id, { ipAddress: null, userAgent: null }),
      session("s3", viewer.id),
      session("s4", owner.id, { expiresAt: new Date("2026-11-22T11:59:59Z") }),
    ]);
    const views = await listSessions({ sessions, clock: { now: () => NOW } }, owner, "s2");
    assert.deepEqual(sessions.calls, [`list:${owner.id}:${NOW.toISOString()}`]);
    assert.deepEqual(views, [
      {
        id: "s1",
        createdAt: new Date("2026-11-20T08:00:00Z"),
        lastSeenAt: new Date("2026-11-22T11:00:00Z"),
        expiresAt: new Date("2026-11-22T16:00:00Z"),
        network: "203.0.113.0/24",
        browser: "Firefox",
        system: "Linux",
        current: false,
      },
      {
        id: "s2",
        createdAt: new Date("2026-11-20T08:00:00Z"),
        lastSeenAt: new Date("2026-11-22T11:00:00Z"),
        expiresAt: new Date("2026-11-22T16:00:00Z"),
        network: null,
        browser: null,
        system: null,
        current: true,
      },
    ]);
    assert.ok(!JSON.stringify(views).includes("203.0.113.77"));
  });

  it("revokes another own session, never the current one or someone else's", async () => {
    const sessions = new MemorySessions([
      session("s1", owner.id),
      session("s2", owner.id),
      session("s3", viewer.id),
    ]);
    assert.equal(await revokeSession({ sessions }, owner, "s2", "s2"), "current");
    assert.equal(await revokeSession({ sessions }, owner, "s3", "s2"), "not_found");
    assert.equal(await revokeSession({ sessions }, owner, "s1", "s2"), "revoked");
    assert.equal(await revokeSession({ sessions }, owner, "s1", "s2"), "not_found");
    assert.deepEqual(
      sessions.records.map((r) => r.id),
      ["s2", "s3"],
    );
  });

  it("revokes every other own session and keeps the current one", async () => {
    const sessions = new MemorySessions([
      session("s1", owner.id),
      session("s2", owner.id),
      session("s5", owner.id),
      session("s3", viewer.id),
    ]);
    assert.equal(await revokeOtherSessions({ sessions }, owner, "s2"), 2);
    assert.deepEqual(
      sessions.records.map((r) => r.id),
      ["s2", "s3"],
    );
    assert.equal(await revokeOtherSessions({ sessions }, owner, "s2"), 0);
  });
});

/** Newest-first keyset reads with the same ordering contract as the PostgreSQL adapter. */
class MemoryAudit implements AuditStore {
  limits: number[] = [];
  entries: AuditEntry[];
  constructor(entries: AuditEntry[]) {
    this.entries = entries;
  }
  async listAudit(cursor: AuditCursor | null, limit: number) {
    this.limits.push(limit);
    const before = (e: AuditEntry) =>
      !cursor ||
      e.at.getTime() < cursor.at.getTime() ||
      (e.at.getTime() === cursor.at.getTime() && e.id < cursor.id);
    return [...this.entries]
      .sort((a, b) => b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : -1))
      .filter(before)
      .slice(0, limit);
  }
}

const entry = (id: string, ms: number): AuditEntry => ({
  id,
  action: "invitation_created",
  at: new Date(ms),
  actorId: owner.id,
  actorEmail: owner.email,
  subjectId: `inv-${id}`,
  subjectEmail: "new@example.test",
});

describe("audit trail", () => {
  it("is for owners only and rejects a foreign cursor before reading", async () => {
    const audit = new MemoryAudit([entry("a", 1)]);
    assert.deepEqual(await listAudit({ audit }, viewer, null), { ok: false, reason: "forbidden" });
    assert.deepEqual(await listAudit({ audit }, owner, "not-a-cursor"), {
      ok: false,
      reason: "invalid_cursor",
    });
    assert.deepEqual(audit.limits, []);
  });

  it("pages newest first with a next cursor until the last page", async () => {
    const audit = new MemoryAudit([entry("a", 1), entry("b", 2), entry("c", 2), entry("d", 3)]);
    const first = await listAudit({ audit }, owner, null, 2);
    assert.ok(first.ok);
    assert.deepEqual(
      first.entries.map((e) => e.id),
      ["d", "c"],
    );
    assert.equal(first.next, encodeAuditCursor({ at: new Date(2), id: "c" }));
    const second = await listAudit({ audit }, owner, first.next, 2);
    assert.ok(second.ok);
    assert.deepEqual(
      second.entries.map((e) => e.id),
      ["b", "a"],
    );
    assert.equal(second.next, null);
    assert.deepEqual(audit.limits, [3, 3]);
  });

  it("clamps the page size", async () => {
    const audit = new MemoryAudit([]);
    for (const limit of [0, -5, 1, 100, 1000, Number.NaN, 2.5])
      assert.deepEqual(await listAudit({ audit }, owner, null, limit), {
        ok: true,
        entries: [],
        next: null,
      });
    assert.deepEqual(audit.limits, [2, 2, 2, 101, 101, AUDIT_PAGE_SIZE + 1, AUDIT_PAGE_SIZE + 1]);
    await listAudit({ audit }, owner, null);
    assert.equal(audit.limits.at(-1), AUDIT_PAGE_SIZE + 1);
  });

  it("walking every page yields each entry exactly once, in order (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.tuple(fc.stringMatching(/^[0-9a-f]{1,8}$/), fc.integer({ min: 0, max: 20 })),
          {
            selector: ([id]) => id,
            maxLength: 40,
          },
        ),
        fc.integer({ min: 1, max: 7 }),
        async (rows, size) => {
          const audit = new MemoryAudit(rows.map(([id, ms]) => entry(id, ms)));
          const seen: string[] = [];
          let cursor: string | null = null;
          for (let page = 0; page <= rows.length; page++) {
            const result = await listAudit({ audit }, owner, cursor, size);
            assert.ok(result.ok);
            seen.push(...result.entries.map((e) => e.id));
            cursor = result.next;
            if (cursor === null) break;
          }
          const expected = (await new MemoryAudit(audit.entries).listAudit(null, 1000)).map(
            (e) => e.id,
          );
          assert.deepEqual(seen, expected);
        },
      ),
      propertyOptions("property"),
    );
  });
});
