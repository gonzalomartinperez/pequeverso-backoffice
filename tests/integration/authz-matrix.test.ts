// Authorization matrix against real PostgreSQL: every server action in tests/authz/matrix.ts is
// exercised per caller (owner, second owner, viewer, second viewer, anonymous). The gate under
// test is the production decision (`authorize`, which `requireActor` also applies); the use cases are then called
// with a forged owner role to prove the store re-verifies the role itself (defense in depth).
// Needs a disposable database: TEST_DATABASE_URL=postgres://… npm run test:integration
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { migrate } from "../../scripts/db-migrate.ts";
import { nodeSecrets } from "../../src/features/auth/adapters/node-secrets.ts";
import { PostgresAccessStore } from "../../src/features/auth/adapters/postgres-access-store.ts";
import {
  type AccessDeps,
  type Actor,
  authorize,
  DENIAL_REDIRECT,
  inviteMember,
  removeMember,
  resolveActor,
  revokeInvitation,
} from "../../src/features/auth/application/access.ts";
import { can, type Role } from "../../src/features/auth/domain/access.ts";
import { assertDisposableDatabase } from "../../src/server/fixture-safety.ts";
import { type Caller, expectedOutcome, MATRIX, type Outcome } from "../authz/matrix.ts";

const rawUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const baseUrl = rawUrl ? assertDisposableDatabase(rawUrl, false) : undefined;

type Seed = { id: string; email: string; role: Role };

describe("authorization matrix (PostgreSQL)", {
  skip: !baseUrl && "TEST_DATABASE_URL not set",
}, () => {
  const database = `bo_test_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let pool: pg.Pool;
  let deps: AccessDeps;
  const people: Record<string, Seed> = {};

  async function seed(key: string, email: string, role: Role, verified = true): Promise<Seed> {
    const id = `u-${key}-${randomBytes(3).toString("hex")}`;
    await pool.query(
      `INSERT INTO auth_user (id, name, email, "emailVerified", role) VALUES ($1, $1, $2, $3, $4)`,
      [id, email, verified, role],
    );
    return { id, email, role };
  }

  async function snapshot() {
    const { rows } = await pool.query<Record<string, string>>(`
      SELECT (SELECT count(*) FROM auth_user) AS users,
             (SELECT count(*) FROM backoffice_invitation WHERE revoked_at IS NULL) AS open,
             (SELECT count(*) FROM backoffice_invitation) AS invitations,
             (SELECT count(*) FROM backoffice_access_audit) AS audit`);
    return rows[0];
  }

  before(async () => {
    admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(baseUrl ?? "");
    url.pathname = `/${database}`;
    await migrate(url.toString(), path.resolve(import.meta.dirname, "../../migrations"));
    pool = new pg.Pool({ connectionString: url.toString() });
    pool.on("error", () => undefined);
    deps = {
      store: new PostgresAccessStore(pool),
      secrets: nodeSecrets,
      clock: { now: () => new Date() },
      ownerEmail: "owner@example.test",
    };
    people.owner = await seed("owner", "owner@example.test", "owner");
    people.owner2 = await seed("owner2", "owner2@example.test", "owner");
    people.viewer = await seed("viewer", "viewer@example.test", "viewer");
    people.viewer2 = await seed("viewer2", "viewer2@example.test", "viewer");
  });

  after(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin?.end();
  });

  const callers: { name: Caller; person: string | null }[] = [
    { name: "owner", person: "owner" },
    { name: "owner", person: "owner2" },
    { name: "viewer", person: "viewer" },
    { name: "viewer", person: "viewer2" },
    { name: "anonymous", person: null },
  ];

  /** The production decision (`decide`, the one `requireActor` applies) for a person's session. */
  async function gate(guard: Parameters<typeof can>[1], person: string | null): Promise<Outcome> {
    const who = person ? people[person] : null;
    const decision = await authorize(
      deps,
      who ? { userId: who.id, email: who.email, emailVerified: true } : null,
      guard,
    );
    if (decision.allowed) return "allowed";
    return `redirect:${DENIAL_REDIRECT[decision.reason]}`;
  }

  /** One driver per server action: creates a fresh target, then runs the use case behind it. */
  type Driver = {
    target(): Promise<string>;
    /** `ok`, or the refusal the use case reports. */
    run(actor: Actor, target: string): Promise<string>;
    /** What a refusal of an owner-only call looks like for this action. */
    denied: string;
    /** The same refusal when a stale owner role reaches the store, which then finds no row to act on. */
    deniedStale: string;
  };
  const prefix = "action:src/app/panel/accesos/actions.ts#";
  const drivers: Record<string, Driver> = {
    [`${prefix}inviteAction`]: {
      target: async () => `invitee-${randomBytes(3).toString("hex")}@example.test`,
      run: async (actor, email) => {
        const result = await inviteMember(deps, actor, email, "viewer");
        return result.ok ? "ok" : result.reason;
      },
      denied: "forbidden",
      deniedStale: "forbidden",
    },
    [`${prefix}revokeInvitationAction`]: {
      target: async () => {
        const email = `pending-${randomBytes(3).toString("hex")}@example.test`;
        const made = await inviteMember(deps, people.owner as Actor, email, "viewer");
        if (!made.ok) throw new Error("setup invitation failed");
        return made.invitation.id;
      },
      run: async (actor, id) => ((await revokeInvitation(deps, actor, id)) ? "ok" : "refused"),
      denied: "refused",
      deniedStale: "refused",
    },
    [`${prefix}removeMemberAction`]: {
      target: async () =>
        (await seed("victim", `victim-${randomBytes(3).toString("hex")}@example.test`, "viewer"))
          .id,
      run: async (actor, id) => {
        const result = await removeMember(deps, actor, id);
        return result.ok ? "ok" : result.reason;
      },
      denied: "forbidden",
      deniedStale: "not_found",
    },
  };

  it("has a driver for exactly the server actions listed in the matrix", () => {
    const listed = MATRIX.filter((row) => row.id.startsWith("action:")).map((row) => row.id);
    assert.deepEqual(Object.keys(drivers).sort(), listed.sort());
  });

  for (const row of MATRIX.filter((item) => item.id.startsWith("action:"))) {
    for (const caller of callers) {
      const label = `${row.id.split("#")[1]} as ${caller.person ?? "anonymous"}`;
      it(`${label}: ${expectedOutcome(row.guard, caller.name)}`, async () => {
        const driver = drivers[row.id];
        assert.ok(driver);
        const expected = expectedOutcome(row.guard, caller.name);
        assert.equal(await gate(row.guard as "manage_access", caller.person), expected);
        const target = await driver.target();
        const before = await snapshot();
        const who = caller.person ? people[caller.person] : null;
        if (expected === "allowed") {
          assert.ok(who);
          assert.equal(await driver.run(who, target), "ok");
          assert.notDeepEqual(await snapshot(), before, "an allowed action changes state");
          return;
        }
        // Denied at the gate; even if a stale or forged "owner" actor reached the use case, the
        // store re-checks the role in its transaction and changes nothing.
        const forged: Actor = who
          ? { id: who.id, email: who.email, role: "owner" }
          : { id: "ghost", email: "ghost@example.test", role: "owner" };
        assert.equal(await driver.run(forged, target), driver.deniedStale);
        assert.deepEqual(await snapshot(), before, "a refused action leaves no trace");
        if (who) {
          const honest: Actor = { id: who.id, email: who.email, role: who.role };
          assert.equal(await driver.run(honest, target), driver.denied);
          assert.deepEqual(await snapshot(), before);
        }
      });
    }
  }

  it("re-reads the role on every request: a demoted owner loses access at once", async () => {
    const temp = await seed("temp", "temp@example.test", "owner");
    const session = { userId: temp.id, email: temp.email, emailVerified: true };
    assert.equal((await resolveActor(deps, session))?.role, "owner");
    await pool.query("UPDATE auth_user SET role = 'viewer' WHERE id = $1", [temp.id]);
    const demoted = await resolveActor(deps, session);
    assert.equal(demoted?.role, "viewer");
    assert.equal(can(demoted?.role, "manage_access"), false);
    const before = await snapshot();
    assert.equal(
      (await inviteMember(deps, { ...temp, role: "owner" }, "late@example.test", "viewer")).ok,
      false,
    );
    assert.deepEqual(await snapshot(), before);
  });

  it("refuses sessions of unverified or deleted accounts", async () => {
    const unverified = await seed("unverified", "unverified@example.test", "owner", false);
    assert.equal(
      await resolveActor(deps, {
        userId: unverified.id,
        email: unverified.email,
        emailVerified: false,
      }),
      null,
    );
    assert.equal(
      await resolveActor(deps, { userId: "missing", email: "x@example.test", emailVerified: true }),
      null,
    );
  });

  describe("object-id swaps", () => {
    it("a viewer cannot remove an owner or another viewer by id", async () => {
      const before = await snapshot();
      for (const targetKey of ["owner", "owner2", "viewer2"]) {
        const result = await removeMember(
          deps,
          people.viewer as Actor,
          (people[targetKey] as Seed).id,
        );
        assert.deepEqual(result, { ok: false, reason: "forbidden" }, targetKey);
      }
      assert.deepEqual(await snapshot(), before);
    });

    it("a viewer cannot revoke an invitation by id", async () => {
      const made = await inviteMember(deps, people.owner as Actor, "swap@example.test", "viewer");
      assert.ok(made.ok);
      if (!made.ok) return;
      assert.equal(
        await revokeInvitation(deps, people.viewer2 as Actor, made.invitation.id),
        false,
      );
      assert.equal(await revokeInvitation(deps, people.viewer as Actor, made.invitation.id), false);
      const { rows } = await pool.query(
        "SELECT revoked_at FROM backoffice_invitation WHERE id = $1",
        [made.invitation.id],
      );
      assert.equal(rows[0].revoked_at, null);
    });

    it("ids of the wrong kind or unknown ids resolve to nothing", async () => {
      const made = await inviteMember(deps, people.owner as Actor, "kind@example.test", "viewer");
      assert.ok(made.ok);
      if (!made.ok) return;
      const before = await snapshot();
      const owner = people.owner as Actor;
      assert.deepEqual(await removeMember(deps, owner, made.invitation.id), {
        ok: false,
        reason: "not_found",
      });
      assert.equal(await revokeInvitation(deps, owner, (people.viewer as Seed).id), false);
      for (const junk of ["", "' OR '1'='1", "../../etc/passwd", "x".repeat(5000)]) {
        assert.equal((await removeMember(deps, owner, junk)).ok, false);
        assert.equal(await revokeInvitation(deps, owner, junk), false);
      }
      assert.deepEqual(await snapshot(), before);
    });

    it("an owner cannot remove themselves or the configured owner, even as another owner", async () => {
      const before = await snapshot();
      assert.deepEqual(
        await removeMember(deps, people.owner2 as Actor, (people.owner2 as Seed).id),
        {
          ok: false,
          reason: "self",
        },
      );
      assert.deepEqual(
        await removeMember(deps, people.owner2 as Actor, (people.owner as Seed).id),
        {
          ok: false,
          reason: "configured_owner",
        },
      );
      assert.deepEqual(await snapshot(), before);
    });

    it("a spent invitation cannot be revoked again", async () => {
      const made = await inviteMember(deps, people.owner as Actor, "twice@example.test", "viewer");
      assert.ok(made.ok);
      if (!made.ok) return;
      assert.equal(await revokeInvitation(deps, people.owner2 as Actor, made.invitation.id), true);
      assert.equal(await revokeInvitation(deps, people.owner as Actor, made.invitation.id), false);
    });

    it("the audit trail records the actor id of each allowed mutation and none of the refused", async () => {
      const marker = `audit-${randomBytes(3).toString("hex")}@example.test`;
      assert.equal((await inviteMember(deps, people.viewer as Actor, marker, "viewer")).ok, false);
      const allowed = await inviteMember(deps, people.owner2 as Actor, marker, "viewer");
      assert.ok(allowed.ok);
      if (!allowed.ok) return;
      const { rows } = await pool.query<{ actor_id: string }>(
        "SELECT actor_id FROM backoffice_access_audit WHERE subject_id = $1",
        [allowed.invitation.id],
      );
      assert.deepEqual(
        rows.map((row) => row.actor_id),
        [(people.owner2 as Seed).id],
      );
      const refused = await pool.query(
        "SELECT 1 FROM backoffice_access_audit WHERE actor_id = ANY($1)",
        [[(people.viewer as Seed).id, (people.viewer2 as Seed).id]],
      );
      assert.equal(refused.rowCount, 0);
    });
  });
});
