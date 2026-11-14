import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { discoverSurface, type Files, readTree, surfaceOf } from "../../scripts/authz-surface.ts";
import { checkGuards } from "../authz/check.ts";
import { expectedOutcome, type Guard, MATRIX, type Row } from "../authz/matrix.ts";

const root = path.resolve(import.meta.dirname, "../..");
const fixture = (name: string) => path.join(root, "tests/authz/fixtures", name);

const AUTH = 'import { requireActor } from "@/server/auth";\n';
const row = (id: string, guard: Guard, covers: Row["covers"] = "static-only"): Row => ({
  id,
  guard,
  covers,
});

/** Problems for a synthetic tree and matrix (the fixture for each shape below). */
const run = (files: Files, matrix: Row[]) => checkGuards(surfaceOf(files), matrix);
const has = (problems: string[], text: string) =>
  assert.ok(
    problems.some((p) => p.includes(text)),
    `${text} not in ${JSON.stringify(problems)}`,
  );

describe("authz matrix against the real tree", () => {
  it("lists every server action, route handler and page, with every guard verified", () => {
    assert.deepEqual(checkGuards(discoverSurface(root), MATRIX, { root }), []);
  });

  it("derives expectations from the permission source", () => {
    const outcomes = (guard: Guard) =>
      (["owner", "viewer", "anonymous"] as const).map((caller) => expectedOutcome(guard, caller));
    assert.deepEqual(outcomes("manage_access"), [
      "allowed",
      "redirect:/panel",
      "redirect:/ingresar",
    ]);
    assert.deepEqual(outcomes("read_operations"), ["allowed", "allowed", "redirect:/ingresar"]);
  });

  it("negative fixture: an unlisted extra action and handler fail the check", () => {
    const problems = checkGuards(discoverSurface(fixture("extra-action")), MATRIX, { root });
    has(problems, "unlisted: action:src/app/panel/accesos/actions.ts#deleteEverythingAction");
    has(problems, "unlisted: action:src/app/panel/accesos/actions.ts#inlineExport");
    has(problems, "unlisted: route:src/app/x/route.ts#PUT");
    has(problems, "stale:");
  });

  it("dropping a row of the real matrix fails (an unlisted entry is reported)", () => {
    const problems = checkGuards(discoverSurface(root), MATRIX.slice(1), { root });
    has(problems, "unlisted: action:src/app/panel/accesos/actions.ts#inviteAction");
  });
});

describe("enumeration shapes", () => {
  it("scans every source extension and every app directory shape", () => {
    const files: Files = {
      "src/app/api/a/route.mjs": "export function POST() {}",
      "src/app/api/b/route.cjs": "export function DELETE() {}",
      "src/app/(group)/g/page.jsx": "export default function P() {}",
      "src/app/@slot/default.tsx": "export default function D() {}",
      "src/app/x/template.tsx": "export default function T() {}",
      "src/app/x/actions.mts": '"use server"; export async function a() {}',
      "src/pages/old.tsx": "export default function O() {}",
    };
    const ids = surfaceOf(files).map((e) => e.id);
    assert.deepEqual(ids, [
      "action:src/app/x/actions.mts#a",
      "page:src/app/(group)/g/page.jsx#default",
      "page:src/app/@slot/default.tsx#default",
      "page:src/app/x/template.tsx#default",
      "page:src/pages/old.tsx#pages-router",
      "route:src/app/api/a/route.mjs#POST",
      "route:src/app/api/b/route.cjs#DELETE",
    ]);
    has(run(files, []), "the pages router and a root app/");
  });

  it("emits every name of a destructured export", () => {
    const ids = surfaceOf({
      "src/app/a/route.ts": "export const { GET, POST } = handlers; export const [DELETE] = x;",
    }).map((e) => e.id);
    assert.deepEqual(ids, [
      "route:src/app/a/route.ts#DELETE",
      "route:src/app/a/route.ts#GET",
      "route:src/app/a/route.ts#POST",
    ]);
  });

  it("keeps names through re-exports, counts default re-exports, fails closed on export *", () => {
    const files: Files = {
      "src/app/a/route.ts":
        'export { GET, POST } from "./h.ts"; export { x as PUT } from "./h.ts";',
      "src/app/b/page.tsx": 'export { default } from "./p.tsx";',
      "src/app/c/route.ts": 'export * from "./h.ts";',
      "src/app/d/route.ts": 'export * as all from "./h.ts";',
    };
    const entries = surfaceOf(files);
    assert.deepEqual(
      entries.map((e) => e.id),
      [
        "page:src/app/b/page.tsx#default",
        "route:src/app/a/route.ts#GET",
        "route:src/app/a/route.ts#POST",
        "route:src/app/a/route.ts#PUT",
        "route:src/app/c/route.ts#*:./h.ts",
        "route:src/app/d/route.ts#*:./h.ts",
      ],
    );
    assert.ok(entries.every((e) => e.reexport));
    const guarded = run(
      files,
      entries.map((e) => row(e.id, "manage_access")),
    );
    has(guarded, "src/app/b/page.tsx#default: guard cannot be verified through a re-export");
    has(guarded, "`export *` cannot be enumerated");
  });

  it("enumerates special files, metadata routes, the proxy and forbidden routers", () => {
    const files: Files = {
      "src/app/not-found.tsx": "export default function N() {}",
      "src/app/error.tsx": "export default function E() {}",
      "src/app/loading.tsx": "export default function L() {}",
      "src/app/global-error.tsx": "export default function G() {}",
      "src/app/sitemap.ts": "export default function s() {}",
      "src/app/robots.ts": "export default function r() {}",
      "src/app/manifest.ts": "export default function m() {}",
      "src/app/opengraph-image.tsx": "export default function o() {}",
      "src/app/icon.tsx": "export default function i() {}",
      "src/proxy.ts": "export function proxy() {}",
      "src/middleware.ts": "export function middleware() {}",
      "proxy.ts": "export function proxy() {}",
      "app/page.tsx": "export default function A() {}",
      "pages/index.tsx": "export default function I() {}",
    };
    const entries = surfaceOf(files);
    assert.deepEqual(
      entries.map((e) => e.id),
      [
        "page:app/page.tsx#pages-router",
        "page:pages/index.tsx#pages-router",
        "page:src/app/error.tsx#default",
        "page:src/app/global-error.tsx#default",
        "page:src/app/icon.tsx#default",
        "page:src/app/loading.tsx#default",
        "page:src/app/manifest.ts#default",
        "page:src/app/not-found.tsx#default",
        "page:src/app/opengraph-image.tsx#default",
        "page:src/app/robots.ts#default",
        "page:src/app/sitemap.ts#default",
        "proxy:proxy.ts#proxy",
        "proxy:src/middleware.ts#proxy",
        "proxy:src/proxy.ts#proxy",
      ],
    );
    const problems = run(files, []);
    has(problems, "pages router and a root app/");
    has(problems, "proxy:proxy.ts#proxy: proxy/middleware must live in src/");
    has(problems, "unlisted: proxy:src/proxy.ts#proxy");
  });

  it("makes inline ids scope-qualified and unique", () => {
    const entries = surfaceOf({
      "src/app/a/page.tsx": `
        export default function Page() {
          async function save() { "use server"; }
          const other = async () => { "use server"; };
          return [async () => { "use server"; }, async () => { "use server"; }];
        }
        export function Second() { async function save() { "use server"; } }`,
    });
    const ids = entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, [
      "action:src/app/a/page.tsx#inline:Page>anon0",
      "action:src/app/a/page.tsx#inline:Page>anon1",
      "action:src/app/a/page.tsx#inline:Page>other",
      "action:src/app/a/page.tsx#inline:Page>save",
      "action:src/app/a/page.tsx#inline:Second>save",
      "page:src/app/a/page.tsx#default",
    ]);
  });
});

describe("guard verification", () => {
  const page = (body: string, extra = "") =>
    surfaceOf({
      "src/app/panel/p/page.tsx": `${AUTH}${extra}\nexport default async function P() {\n${body}\n}`,
    });
  const verify = (body: string, guard: Guard = "manage_access") =>
    checkGuards(page(body), [row("page:src/app/panel/p/page.tsx#default", guard)]);

  it("accepts an awaited top-level guard, bare or assigned", () => {
    assert.deepEqual(verify('await requireActor("manage_access"); return null;'), []);
    assert.deepEqual(
      verify('const actor = await requireActor("manage_access"); return actor;'),
      [],
    );
  });

  it("does not credit a parent layout to a page", () => {
    const files: Files = {
      "src/app/panel/layout.tsx": `${AUTH}export default async function L() { await requireActor("read_operations"); return null; }`,
      "src/app/panel/q/page.tsx": "export default function Q() { return null; }",
    };
    const problems = run(files, [
      row("page:src/app/panel/layout.tsx#default", "read_operations"),
      row("page:src/app/panel/q/page.tsx#default", "read_operations"),
    ]);
    assert.equal(problems.length, 1);
    has(problems, "page:src/app/panel/q/page.tsx#default: no verified requireActor guard: make");
  });

  it("rejects unreachable, conditional, unawaited and shadowed guards", () => {
    for (const body of [
      'if (false) { await requireActor("manage_access"); } return null;',
      'async function later() { await requireActor("manage_access"); } return null;',
      'const later = async () => { await requireActor("manage_access"); }; return later;',
      'requireActor("manage_access"); return null;',
      'if (process.env.X) return null; await requireActor("manage_access"); return null;',
      'return null; await requireActor("manage_access");',
      'try { await requireActor("manage_access"); } catch {} return null;',
      'await Promise.resolve(requireActor("manage_access")); return null;',
    ])
      has(verify(body), "no verified requireActor guard");
    const shadow = checkGuards(
      surfaceOf({
        "src/app/panel/p/page.tsx":
          'async function requireActor(a: string) {}\nexport default async function P() { await requireActor("manage_access"); }',
      }),
      [row("page:src/app/panel/p/page.tsx#default", "manage_access")],
    );
    has(shadow, "no verified requireActor guard");
  });

  it("credits a guard only as the first executable statement", () => {
    const actions = (body: string) =>
      checkGuards(
        surfaceOf({
          "src/app/a/actions.ts": `"use server";\n${AUTH}import { removeMember } from "@/x";\nexport async function go(id: string) {\n${body}\n}`,
        }),
        [row("action:src/app/a/actions.ts#go", "manage_access")],
      );
    has(actions('await removeMember(id); await requireActor("manage_access");'), "first statement");
    has(
      actions('const r = removeMember(id); await requireActor("manage_access");'),
      "first statement",
    );
    assert.deepEqual(
      actions('const LIMIT = 3; "directive"; await requireActor("manage_access");'),
      [],
    );
    has(
      actions('const x = compute(); await requireActor("manage_access");'),
      "no verified requireActor",
    );
    // The page shape is held to the same rule.
    has(
      verify('await sideEffect(); await requireActor("manage_access"); return null;'),
      "first statement",
    );
  });

  it("resolves requireActor to src/server/auth and rejects look-alikes and shadows", () => {
    const withImport = (line: string, body = 'await requireActor("manage_access");') =>
      checkGuards(
        surfaceOf({
          "src/app/panel/p/page.tsx": `${line}\nexport default async function P(${"{ requireActor }: { requireActor: (a: string) => void }"}) {\n${body}\n}`,
        }),
        [row("page:src/app/panel/p/page.tsx#default", "manage_access")],
      );
    const plain = (line: string, body: string) =>
      checkGuards(
        surfaceOf({
          "src/app/panel/p/page.tsx": `${line}\nexport default async function P() {\n${body}\n}`,
        }),
        [row("page:src/app/panel/p/page.tsx#default", "manage_access")],
      );
    const body = 'await requireActor("manage_access");';
    assert.deepEqual(plain('import { requireActor } from "@/server/auth";', body), []);
    assert.deepEqual(plain('import { requireActor } from "../../../server/auth.ts";', body), []);
    for (const spec of [
      "@/lib/auth",
      "@/server/other-auth",
      "./auth",
      "better-auth",
      "@/server/auth/extra",
    ])
      has(plain(`import { requireActor } from "${spec}";`, body), "no verified requireActor");
    const imp = 'import { requireActor } from "@/server/auth";';
    has(
      plain(imp, `const requireActor = async (a: string) => {}; ${body}`),
      "no verified requireActor",
    );
    has(plain(imp, `var requireActor = noop; ${body}`), "no verified requireActor");
    has(plain(imp, `function requireActor(a: string) {} ${body}`), "no verified requireActor");
    has(withImport(imp), "no verified requireActor"); // a parameter named requireActor shadows the import
    // A same-named declaration inside an unrelated nested function does not shadow.
    assert.deepEqual(plain(imp, `function unrelated() { const requireActor = 1; } ${body}`), []);
  });

  it("rejects a wrong or non-literal action", () => {
    has(
      verify('await requireActor("read_operations"); return null;'),
      "do not match manage_access",
    );
    has(verify("await requireActor(variable); return null;"), "needs a literal action");
  });

  it("verifies a helper one import level deep, and fails when its guard is removed", () => {
    const call = "const r = await readThing(); return r;";
    const helper = (body: string): Files => ({
      "src/app/panel/p/page.tsx": `import { readThing } from "@/server/thing";\nexport default async function P() { ${call} }`,
      "src/server/thing.ts": `${AUTH}export async function readThing() { ${body} return 1; }`,
    });
    const rows = [row("page:src/app/panel/p/page.tsx#default", "read_operations")];
    assert.deepEqual(run(helper('await requireActor("read_operations");'), rows), []);
    has(run(helper(""), rows), "no verified requireActor guard");
    has(
      run(helper('if (x) { await requireActor("read_operations"); }'), rows),
      "no verified requireActor guard",
    );
    has(run(helper('await requireActor("manage_access");'), rows), "do not match read_operations");
  });

  it("requires the real analytics page to be guarded through its helper", () => {
    const surface = discoverSurface(root);
    const entry = surface.find((e) => e.id === "page:src/app/panel/analitica/page.tsx#default");
    assert.deepEqual([entry?.guards, entry?.via], [["read_operations"], ["readAnalytics"]]);
  });

  it("fails when the real helper loses its guard, or an action loses its own", () => {
    const files = readTree(root);
    const strip = (file: string) => ({
      ...files,
      [file]: (files[file] ?? "").replace(/await requireActor\([^)]*\);/g, ""),
    });
    const analytics = checkGuards(surfaceOf(strip("src/server/analytics.ts")), MATRIX, { root });
    has(analytics, "page:src/app/panel/analitica/page.tsx#default: no verified requireActor guard");
    const actions = checkGuards(surfaceOf(strip("src/app/panel/accesos/actions.ts")), MATRIX, {
      root,
    });
    has(actions, "inviteAction: no verified requireActor guard");
  });

  it("re-checks actions exactly and lets a public row not hide a guard", () => {
    const files: Files = {
      "src/app/a/actions.ts": `"use server";\n${AUTH}export async function doIt() { await requireActor("read_operations"); }`,
      "src/app/a/page.tsx": `${AUTH}export default async function P() { await requireActor("read_operations"); }`,
    };
    const problems = run(files, [
      row("action:src/app/a/actions.ts#doIt", "manage_access"),
      row("page:src/app/a/page.tsx#default", "public"),
    ]);
    has(problems, "do not match manage_access");
    has(problems, "listed public but runs");
  });
});

describe("route guards and coverage", () => {
  const route = (source: string, guard: Guard) =>
    checkGuards(surfaceOf({ "src/app/r/route.ts": source }), [
      row("route:src/app/r/route.ts#POST", guard),
    ]);

  it("verifies session guards on routes", () => {
    const ok = `${AUTH}export async function POST() { await requireActor("manage_access"); return new Response(); }`;
    assert.deepEqual(route(ok, "manage_access"), []);
    has(
      route("export async function POST() { return new Response(); }", "manage_access"),
      "no verified requireActor",
    );
  });

  it("verifies a better-auth handler and a bearer check by their source", () => {
    const real =
      "export async function POST(r: Request) { return toNextJsHandler(auth()).POST(r); }";
    assert.deepEqual(route(real, "better-auth"), []);
    has(
      route("export async function POST() { return new Response(); }", "better-auth"),
      "no recognizable better-auth",
    );
    const bearer =
      'export async function POST(r: Request) { const a = source.authorize(r.headers.get("authorization")); if (a !== "allowed") return new Response(null, { status: 401 }); return new Response(); }';
    assert.deepEqual(route(bearer, "bearer-token"), []);
    has(
      route("export async function POST() { return new Response(); }", "bearer-token"),
      "no recognizable bearer-token",
    );
  });

  it("requires the covering test to mention the row", () => {
    const entry = surfaceOf({ "src/app/r/route.ts": "export function POST() {}" });
    const covered = (text: string | null) =>
      checkGuards(
        entry,
        [row("route:src/app/r/route.ts#POST", "public", { file: "t.ts", needle: "/r" })],
        {
          read: () => text,
        },
      );
    assert.deepEqual(covered("hits /r here"), []);
    has(covered("unrelated"), "never mentions /r");
    has(covered(null), "does not exist");
  });

  it("flags duplicate ids", () => {
    const entry = surfaceOf({ "src/app/r/route.ts": "export function POST() {}" })[0];
    assert.ok(entry);
    has(checkGuards([entry, entry], [row(entry.id, "public")]), "duplicate surface id");
  });
});
