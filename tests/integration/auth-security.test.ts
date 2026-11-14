// Real Better Auth + PostgreSQL + fake IdP: CSRF/Origin, callback-URL rejection, advisory
// regressions (GHSA-wxw3-q3m9-c3jr, GHSA-9h47-pqcx-hjr4), session expiry and revocation.
// Needs a disposable database: TEST_DATABASE_URL=postgres://… npm run test:integration
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { migrate } from "../../scripts/db-migrate.ts";
import { nodeSecrets } from "../../src/features/auth/adapters/node-secrets.ts";
import { PostgresAccessStore } from "../../src/features/auth/adapters/postgres-access-store.ts";
import {
  type AccessDeps,
  inviteMember,
  removeMember,
  resolveActor,
} from "../../src/features/auth/application/access.ts";
import { assertDisposableDatabase } from "../../src/server/fixture-safety.ts";

const rawUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const baseUrl = rawUrl ? assertDisposableDatabase(rawUrl, false) : undefined;
const { authOptions, createAuth, INVITATION_COOKIE } = await import(
  "../../src/features/auth/adapters/better-auth.ts"
);
const ORIGIN = "http://localhost:3297";
const IDP_PORT = 8297;
const IDP = `http://127.0.0.1:${IDP_PORT}`;
const SECRET = "integration-secret-1111111111111111111111";

describe("backoffice auth security (PostgreSQL, real handler)", {
  skip: !baseUrl && "TEST_DATABASE_URL not set",
}, () => {
  const database = `bo_test_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let pool: pg.Pool;
  let idp: ChildProcess;
  let deps: AccessDeps;
  let auth: ReturnType<typeof createAuth>;
  const settings = {
    origin: ORIGIN,
    secret: SECRET,
    secureCookies: false,
    sessionHours: 8,
    google: null,
    github: null,
    testIssuer: IDP,
    rateLimit: false,
  };

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
    auth = createAuth(settings, pool, deps);
    idp = spawn(process.execPath, ["scripts/fake-idp.ts"], {
      env: { ...process.env, FAKE_IDP_PORT: String(IDP_PORT) },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise<void>((resolve) => idp.stdout?.once("data", () => resolve()));
  });

  after(async () => {
    idp?.kill();
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin?.end();
  });

  type Jar = Map<string, string>;
  function keep(jar: Jar, response: Response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair?.indexOf("=") ?? -1;
      if (!pair || index < 0) continue;
      const value = pair.slice(index + 1);
      if (/max-age=0/i.test(line) || value === "") jar.delete(pair.slice(0, index));
      else jar.set(pair.slice(0, index), value);
    }
  }
  const cookies = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const SESSION_COOKIE = "pv_bo.session_token";

  function post(pathname: string, body: unknown, headers: Record<string, string>) {
    return auth.handler(
      new Request(`${ORIGIN}/api/auth${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
  }

  async function begin(jar: Jar, identity: { email: string; sub: string }) {
    await fetch(`${IDP}/__identity`, { method: "POST", body: JSON.stringify(identity) });
    const start = await post(
      "/sign-in/social",
      { provider: "test-idp", callbackURL: "/panel", errorCallbackURL: "/ingresar" },
      { origin: ORIGIN },
    );
    assert.equal(start.status, 200);
    keep(jar, start);
    const { url } = (await start.json()) as { url: string };
    const authorize = await fetch(url, { redirect: "manual" });
    return new URL(authorize.headers.get("location") ?? "");
  }

  async function signIn(identity: { email: string; sub: string }, jar: Jar = new Map()) {
    const callback = await begin(jar, identity);
    const done = await auth.handler(new Request(callback, { headers: { cookie: cookies(jar) } }));
    keep(jar, done);
    return { jar, location: done.headers.get("location") ?? "" };
  }

  const session = (jar: Jar) =>
    auth.api.getSession({ headers: new Headers({ cookie: cookies(jar) }) });

  async function owner() {
    const login = await signIn({ email: "owner@example.test", sub: "owner-s" });
    const current = await session(login.jar);
    assert.ok(current, "owner signs in");
    return {
      jar: login.jar,
      actor: { id: current.user.id, email: current.user.email, role: "owner" as const },
    };
  }

  describe("CSRF and Origin", () => {
    const states = [
      ["/sign-out", {}],
      ["/sign-in/social", { provider: "test-idp", callbackURL: "/panel" }],
      ["/link-social", { provider: "test-idp", callbackURL: "/panel" }],
    ] as const;

    it("refuses a foreign Origin on every state-changing Better Auth route, with and without a session", async () => {
      const { jar } = await owner();
      for (const [route, body] of states) {
        for (const cookie of [cookies(jar), ""]) {
          const response = await post(route, body, { origin: "https://evil.example", cookie });
          assert.equal(response.status, 403, `${route} cookie=${cookie !== ""}`);
        }
      }
      assert.ok(await session(jar), "no forged request ended the session");
    });

    it("refuses Origin: null, a look-alike origin and a cookie request without Origin", async () => {
      const { jar } = await owner();
      for (const origin of [
        "null",
        "http://localhost:3297.evil.example",
        "http://localhost:3298",
      ]) {
        const response = await post("/sign-out", {}, { origin, cookie: cookies(jar) });
        assert.equal(response.status, 403, origin);
      }
      const missing = await post("/sign-out", {}, { cookie: cookies(jar) });
      assert.equal(missing.status, 403, "cookie-bearing POST without Origin");
      assert.ok(await session(jar));
    });

    it("refuses cross-site fetch metadata even with the right Origin string absent", async () => {
      const { jar } = await owner();
      const response = await post(
        "/sign-out",
        {},
        { cookie: cookies(jar), "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" },
      );
      assert.equal(response.status, 403);
      assert.ok(await session(jar));
    });

    it("accepts the configured origin (control)", async () => {
      const login = await signIn({ email: "owner@example.test", sub: "owner-s" });
      const out = await post("/sign-out", {}, { origin: ORIGIN, cookie: cookies(login.jar) });
      assert.equal(out.status, 200);
      keep(login.jar, out);
      assert.equal(await session(login.jar), null);
    });
  });

  describe("callback URL rejection", () => {
    const hostile = [
      "https://evil.example/steal",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/%2f/evil.example",
      "/%5cevil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "/panel\r\nSet-Cookie: x=1",
      "http://localhost:3297@evil.example/",
      "http://localhost:3297.evil.example/",
    ];
    for (const field of ["callbackURL", "errorCallbackURL", "newUserCallbackURL"]) {
      it(`rejects hostile ${field} values`, async () => {
        for (const value of hostile) {
          const response = await post(
            "/sign-in/social",
            { provider: "test-idp", callbackURL: "/panel", [field]: value },
            { origin: ORIGIN },
          );
          assert.equal(response.status, 403, `${field}=${JSON.stringify(value)}`);
        }
      });
    }

    it("accepts same-origin relative and absolute callbacks (control)", async () => {
      for (const callbackURL of ["/panel", `${ORIGIN}/panel`]) {
        const response = await post(
          "/sign-in/social",
          { provider: "test-idp", callbackURL },
          { origin: ORIGIN },
        );
        assert.equal(response.status, 200, callbackURL);
      }
    });
  });

  describe("advisory GHSA-wxw3-q3m9-c3jr (OAuth callback state, login CSRF)", () => {
    const identity = { email: "owner@example.test", sub: "owner-s" };

    it("rejects a callback whose state is forged, missing, or whose state cookie is absent", async () => {
      for (const mutate of ["forged", "missing", "no-cookie"] as const) {
        const jar: Jar = new Map();
        const callback = await begin(jar, identity);
        if (mutate === "forged") callback.searchParams.set("state", "forged-state-value");
        if (mutate === "missing") callback.searchParams.delete("state");
        const headers: Record<string, string> =
          mutate === "no-cookie" ? {} : { cookie: cookies(jar) };
        const done = await auth.handler(new Request(callback, { headers }));
        keep(jar, done);
        assert.match(done.headers.get("location") ?? "", /error=|\/ingresar/, mutate);
        assert.equal(await session(jar), null, mutate);
      }
    });

    it("rejects a callback replayed after it succeeded, and a state taken from another flow", async () => {
      const jar: Jar = new Map();
      const callback = await begin(jar, identity);
      const first = await auth.handler(
        new Request(callback, { headers: { cookie: cookies(jar) } }),
      );
      keep(jar, first);
      assert.ok(await session(jar), "first use signs in");
      const replayJar: Jar = new Map();
      const replay = await auth.handler(
        new Request(callback, { headers: { cookie: cookies(replayJar) } }),
      );
      assert.match(replay.headers.get("location") ?? "", /error=|\/ingresar/);
      assert.equal(await session(replayJar), null, "a replayed callback creates no session");

      // Login CSRF: the attacker's callback (state A) must not complete in the victim's browser
      // (state cookie B).
      const attacker: Jar = new Map();
      const victim: Jar = new Map();
      const attackerCallback = await begin(attacker, identity);
      await begin(victim, identity);
      const crossed = await auth.handler(
        new Request(attackerCallback, { headers: { cookie: cookies(victim) } }),
      );
      keep(victim, crossed);
      assert.equal(await session(victim), null, "attacker callback is refused in the victim's jar");
    });
  });

  describe("advisory GHSA-9h47-pqcx-hjr4 (oidcProvider / MCP defaults)", () => {
    it("does not register any OIDC provider, OAuth provider, MCP or JWT plugin", () => {
      const options = authOptions(settings, pool, deps);
      const ids = options.plugins.map((plugin) => plugin.id);
      assert.deepEqual(ids.sort(), ["generic-oauth", "pequeverso-backoffice-access"]);
    });

    it("serves no discovery, JWKS, token, registration or MCP endpoint", async () => {
      const probes: [string, string][] = [
        ["GET", "/.well-known/openid-configuration"],
        ["GET", "/.well-known/oauth-authorization-server"],
        ["GET", "/.well-known/oauth-protected-resource"],
        ["GET", "/jwks"],
        ["GET", "/mcp/get-session"],
        ["POST", "/oauth2/token"],
        ["POST", "/oauth2/register"],
        ["GET", "/oauth2/authorize"],
        ["GET", "/oauth2/userinfo"],
      ];
      for (const [method, route] of probes) {
        const response = await auth.handler(
          new Request(`${ORIGIN}/api/auth${route}`, {
            method,
            headers: { origin: ORIGIN, "content-type": "application/json" },
            ...(method === "POST" ? { body: "{}" } : {}),
          }),
        );
        assert.ok([404, 405].includes(response.status), `${method} ${route} -> ${response.status}`);
      }
    });

    it("pins better-auth at or above the patched floor (1.6.11) and no advisory-prone plugin imports exist", () => {
      const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
        dependencies: Record<string, string>;
      };
      const pinned = manifest.dependencies["better-auth"] ?? "";
      const parts = pinned
        .replace(/^[^\d]*/, "")
        .split(".")
        .map(Number);
      const floor = [1, 6, 11];
      const ok =
        parts[0] !== floor[0]
          ? (parts[0] ?? 0) > (floor[0] ?? 0)
          : parts[1] !== floor[1]
            ? (parts[1] ?? 0) > (floor[1] ?? 0)
            : (parts[2] ?? 0) >= (floor[2] ?? 0);
      assert.ok(ok, `better-auth ${pinned} is below 1.6.11`);
      const source = readFileSync("src/features/auth/adapters/better-auth.ts", "utf8");
      assert.doesNotMatch(
        source,
        /oidc-provider|oauth-provider|plugins\/mcp|better-auth\/plugins\/jwt/,
      );
    });
  });

  describe("sessions: expiry and revocation", () => {
    it("ignores an expired session even though the cookie is intact", async () => {
      const { jar } = await owner();
      assert.ok(await session(jar));
      await pool.query(`UPDATE auth_session SET "expiresAt" = now() - interval '1 minute'`);
      assert.equal(await session(jar), null);
      await pool.query("DELETE FROM auth_session");
    });

    it("rejects a tampered signature, a cookie signed with another secret and a bare token", async () => {
      const { jar } = await owner();
      const value = jar.get(SESSION_COOKIE) ?? "";
      const flipped = `${value.slice(0, -3)}${value.endsWith("AAA") ? "BBB" : "AAA"}`;
      const other = createAuth(
        { ...settings, secret: "integration-secret-2222222222222222222222" },
        pool,
        deps,
      );
      const bare = decodeURIComponent(value).split(".")[0] ?? "";
      for (const cookie of [flipped, value, bare]) {
        const headers = new Headers({ cookie: `${SESSION_COOKIE}=${cookie}` });
        const target = cookie === value ? other : auth;
        assert.equal(await target.api.getSession({ headers }), null);
      }
      assert.ok(await session(jar), "the genuine cookie still works");
    });

    it("sign-out deletes the server-side session: the old cookie is dead afterwards", async () => {
      const login = await signIn({ email: "owner@example.test", sub: "owner-s" });
      const stolen = new Map(login.jar);
      const out = await post("/sign-out", {}, { origin: ORIGIN, cookie: cookies(login.jar) });
      assert.equal(out.status, 200);
      assert.equal(await session(stolen), null, "a copy of the cookie is revoked too");
    });

    it("removing a member deletes their sessions and leaves other members' sessions alone", async () => {
      const { jar, actor } = await owner();
      const invite = await inviteMember(deps, actor, "rev@example.test", "viewer");
      assert.ok(invite.ok);
      if (!invite.ok) return;
      const viewer = await signIn(
        { email: "rev@example.test", sub: "rev-1" },
        new Map([[INVITATION_COOKIE, invite.token]]),
      );
      const current = await session(viewer.jar);
      assert.ok(current);
      const second = await signIn({ email: "rev@example.test", sub: "rev-1" });
      assert.ok(await session(second.jar), "second device");
      const before = await deps.store.listMembers();
      assert.equal(before.find((m) => m.id === current.user.id)?.activeSessions, 2);
      const removed = await removeMember(deps, actor, current.user.id);
      assert.equal(removed.ok, true);
      assert.equal(await session(viewer.jar), null);
      assert.equal(await session(second.jar), null);
      assert.equal(
        await resolveActor(deps, {
          userId: current.user.id,
          email: "rev@example.test",
          emailVerified: true,
        }),
        null,
      );
      const { rows } = await pool.query('SELECT 1 FROM auth_session WHERE "userId" = $1', [
        current.user.id,
      ]);
      assert.equal(rows.length, 0);
      assert.ok(await session(jar), "the owner's own session survives");
    });

    it("a deleted session row kills its cookie at once (no cookie cache)", async () => {
      const login = await signIn({ email: "owner@example.test", sub: "owner-s" });
      const old = new Map(login.jar);
      const current = await session(old);
      assert.ok(current);
      await pool.query('DELETE FROM auth_session WHERE "userId" = $1', [current.user.id]);
      assert.equal(await session(old), null);
    });
  });

  describe("DTO leak check", () => {
    it("member and invitation DTOs expose only whitelisted keys and no secret values", async () => {
      const { actor } = await owner();
      const invite = await inviteMember(deps, actor, "dto@example.test", "viewer");
      assert.ok(invite.ok);
      if (!invite.ok) return;
      await pool.query(
        `UPDATE auth_account SET "accessToken" = 'SECRET-ACCESS', "refreshToken" = 'SECRET-REFRESH', "idToken" = 'SECRET-ID'`,
      );
      const members = await deps.store.listMembers();
      const invitations = await deps.store.listInvitations();
      assert.ok(members.length > 0 && invitations.length > 0);
      for (const member of members)
        assert.deepEqual(Object.keys(member).sort(), [
          "activeSessions",
          "createdAt",
          "email",
          "id",
          "providers",
          "role",
        ]);
      for (const item of invitations)
        assert.deepEqual(Object.keys(item).sort(), [
          "acceptedAt",
          "createdAt",
          "email",
          "expiresAt",
          "id",
          "revokedAt",
          "role",
        ]);
      const serialized = JSON.stringify({
        members,
        invitations,
        one: await deps.store.memberByEmail("owner@example.test"),
      });
      for (const secret of ["SECRET-ACCESS", "SECRET-REFRESH", "SECRET-ID", invite.token, SECRET])
        assert.ok(!serialized.includes(secret), "a secret value reached a DTO");
      assert.doesNotMatch(serialized, /token_?digest|tokenDigest/i);
      const view = await deps.store.invitationByDigest(deps.secrets.digest(invite.token));
      assert.ok(!JSON.stringify(view).includes(deps.secrets.digest(invite.token)));
    });
  });
});
