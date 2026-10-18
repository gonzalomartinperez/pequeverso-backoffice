import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { it } from "node:test";
import { checkBoundaries } from "../../scripts/check-boundaries.ts";

it("keeps the feature architecture boundaries", () => {
  const output = execFileSync(process.execPath, ["scripts/check-boundaries.ts"], {
    encoding: "utf8",
  });
  assert.match(output, /0 violations/);
});

// Virtual modules exercise the checker without importing/executing fixture code or touching src/.
const fixtureRoot = path.resolve("/virtual-backoffice");
function inspect(files: Record<string, string>): string[] {
  return checkBoundaries(
    new Map(
      Object.entries({
        "server/observability.ts": "export const register = () => {};",
        "features/auth/application/access.ts": "export const inviteMember = () => {};",
        "features/auth/application/ports.ts": "export interface Actor {}",
        "features/auth/adapters/store.ts": "export const store = {};",
        "features/operations/application/ports.ts": "export interface Port {}",
        ...files,
      }).map(([file, text]) => [path.join(fixtureRoot, "src", file), text]),
    ),
    fixtureRoot,
  );
}

it("rejects IO globals in application and domain, including after a quoted URL", () => {
  for (const layer of ["domain", "application"]) {
    for (const expression of ["fetch(url)", "process.env", "setTimeout(() => {}, 1)"]) {
      const problems = inspect({
        [`features/auth/${layer}/probe.ts`]: `const url = "https://example.invalid"; export const probe = () => ${expression};`,
      });
      assert.match(problems.join("\n"), new RegExp(`${layer} must stay pure`));
    }
  }
});

it("rejects runtime application dependencies from presentation through aliases and relative paths", () => {
  for (const statement of [
    'import { inviteMember } from "../application/access";',
    'export { inviteMember } from "@/features/auth/application/access";',
    'export const load = () => import("../application/access");',
    'export const load = () => import("../application/access", {});',
    "export const load = () => import (`../application/access`);",
    'import "../application/access";',
  ]) {
    assert.match(
      inspect({ "features/auth/presentation/probe.ts": statement }).join("\n"),
      /presentation may only import application types/,
    );
  }
});

it("allows explicit type-only imports and re-exports from the same application's ports", () => {
  assert.deepEqual(
    inspect({
      "features/auth/presentation/probe.ts":
        'import type { Actor } from "../application/ports";\nexport type { Actor } from "../application/ports";',
    }),
    [],
  );
});

it("rejects mixed type/value imports and unknown feature placement, even without imports", () => {
  assert.match(
    inspect({
      "features/auth/presentation/probe.ts":
        'import { type Actor, inviteMember } from "../application/access";',
    }).join("\n"),
    /presentation may only import application types/,
  );
  for (const file of ["features/auth/probe.ts", "features/auth/infrastructure/probe.ts"]) {
    assert.match(
      inspect({ [file]: 'import { Pool } from "pg";' }).join("\n"),
      /feature modules must belong to a recognized layer/,
    );
    assert.match(
      inspect({ [file]: "export const probe = 1;" }).join("\n"),
      /feature modules must belong to a recognized layer/,
    );
  }
});

it("preserves legitimate outer composition and pure injected application dependencies", () => {
  assert.deepEqual(
    inspect({
      "proxy.ts": 'import { NextResponse } from "next/server";',
      "instrumentation.ts": 'export const register = () => import("./server/observability");',
      "server/auth.ts":
        'import { inviteMember } from "@/features/auth/application/access";\nimport { Pool } from "pg";',
      "features/auth/adapters/store.ts": 'import { Pool } from "pg";',
      "features/auth/application/access.ts":
        'import type { Clock } from "./ports";\nexport const now = (clock: Clock) => clock.now();',
      "features/auth/application/ports.ts": "export interface Clock { now(): Date; }",
    }),
    [],
  );
});

it("keeps existing cross-feature, package, outside-src and adapter restrictions", () => {
  const cases = [
    [
      "features/auth/domain/probe.ts",
      'import { readFileSync } from "node:fs";',
      /may not import package/,
    ],
    ["features/auth/application/probe.ts", 'import { Pool } from "pg";', /may not import package/],
    [
      "features/auth/presentation/probe.ts",
      'import { store } from "../adapters/store";',
      /may not import adapters/,
    ],
    [
      "features/auth/presentation/probe.ts",
      'import type { Port } from "@/features/operations/application/ports";',
      /may not import feature operations/,
    ],
    ["server/probe.ts", 'import { external } from "@/../../external";', /imports outside src/],
  ] as const;
  for (const [file, source, expected] of cases) {
    assert.match(inspect({ [file]: source }).join("\n"), expected);
  }
});

it("ignores commented-out imports and impurity examples", () => {
  assert.deepEqual(
    inspect({
      "features/auth/application/probe.ts":
        '// fetch("https://example.invalid");\n/* import { Pool } from "pg"; */\nexport const probe = 1;',
    }),
    [],
  );
});

it("rejects static template and import-options adapter dependencies from presentation", () => {
  for (const statement of [
    "export const load = () => import(`../adapters/store`);",
    "export const load = () => import (`@/features/auth/adapters/store`, {});",
    'export const load = () => import("../adapters/store", { with: { type: "json" } });',
  ]) {
    assert.match(
      inspect({ "features/auth/presentation/probe.ts": statement }).join("\n"),
      /presentation may not import adapters/,
    );
  }
});

it("rejects every unclassified/importless root and feature, computed imports and parse errors", () => {
  for (const [file, source] of [
    ["stray.ts", "export const x = 1;"],
    ["unknown/x.ts", "export const x = 1;"],
    ["features/new/domain/x.ts", "export const x = 1;"],
    ["features/auth/presentation/probe.ts", "const name = './x'; import(name);"],
    ["features/auth/presentation/probe.ts", "export const = ;"],
  ])
    assert.ok(inspect({ [file as string]: source as string }).length > 0);
});

it("parses escaped strings, require, import-equals and type-imports without bypassing layers", () => {
  for (const statement of [
    String.raw`import {store} from "\u002e\u002e/adapters/store";`,
    "const store = require('../adapters/store');",
    "import store = require('../adapters/store');",
    "type Store = import('../adapters/store').Store;",
    "export * from '../adapters/store';",
  ])
    assert.match(
      inspect({ "features/auth/presentation/probe.ts": statement }).join("\n"),
      /may not import adapters/,
    );
});

it("allows inline type-only syntax and ignores strings/property names or injected bindings", () => {
  assert.deepEqual(
    inspect({
      "features/auth/presentation/probe.ts":
        "import {type Actor} from '../application/ports'; export type P=Actor;",
      "features/auth/domain/document.ts":
        'export const text="fetch() process.env"; export const named={fetch:1}; export const use=(fetch:()=>number)=>fetch();',
    }),
    [],
  );
  assert.match(
    inspect({
      "features/auth/domain/probe.ts": "export const run=()=>globalThis.fetch('/');",
    }).join("\n"),
    /must stay pure/,
  );
});

it("rejects runtime and type-only dependency cycles", () => {
  for (const prefix of ["", "type "])
    assert.match(
      inspect({
        "features/auth/domain/a.ts": `import ${prefix}{B} from './b'; export type A=typeof B;`,
        "features/auth/domain/b.ts": `import ${prefix}{A} from './a'; export type B=typeof A;`,
      }).join("\n"),
      /dependency cycle/,
    );
});

it("rejects unresolved and ambiguous local targets while accepting existing public JSON leaves", () => {
  assert.match(
    inspect({ "shared/ui/a.ts": "import './missing';" }).join("\n"),
    /unresolved local target/,
  );
  assert.match(
    inspect({
      "shared/ui/a.ts": "import './b';",
      "shared/ui/b.ts": "export {};",
      "shared/ui/b.tsx": "export {};",
    }).join("\n"),
    /ambiguous local target/,
  );
  assert.deepEqual(
    inspect({
      "shared/ui/public-wire.json": '{"schema_version":"1"}',
      "shared/ui/validator.ts":
        'import schema from "./public-wire.json"; export const valid=(value:unknown)=>typeof value==="object" && schema.schema_version==="1";',
      "app/client.tsx":
        '"use client"; import {valid} from "@/shared/ui/validator"; export const result=valid({schema_version:"1"});',
    }),
    [],
  );
});

it("follows client barrels transitively to private server and builtin dependencies", () => {
  for (const target of ["@/server/config", "node:fs"])
    assert.match(
      inspect({
        "app/client.tsx":
          '"use client"; import {config} from "@/shared/ui/barrel"; export const x=config;',
        "shared/ui/barrel.ts": `export {config} from "${target}";`,
        "server/config.ts": "import 'server-only'; export const config={};",
      }).join("\n"),
      /client runtime reaches/,
    );
});

it("accepts explicit async Server Action RPC and serializable composition without exposing server modules", () => {
  assert.deepEqual(
    inspect({
      "app/panel/actions.ts":
        '"use server"; import {config} from "@/server/config"; export async function save(){return {ok:Boolean(config)}}',
      "server/config.ts": "import 'server-only'; export const config={};",
      "features/auth/presentation/form.tsx":
        '"use client"; import {save} from "@/app/panel/actions"; export const run=()=>save();',
      "app/panel/page.tsx":
        'import {save} from "./actions"; export default function Page(){return <Form action={save} label="Enviar" data={{ok:true}}/>}',
    }),
    [],
  );
});

it("rejects fake actions, private re-exports and core-to-action dependencies", () => {
  for (const action of [
    '"use server"; export {config as save} from "@/server/config";',
    '"use server"; export const save={private:true};',
    "export async function save(){return {};}",
  ])
    assert.ok(
      inspect({
        "app/panel/actions.ts": action,
        "server/config.ts": "import 'server-only'; export const config={};",
        "features/auth/presentation/form.tsx":
          '"use client"; import {save} from "@/app/panel/actions"; export const run=()=>save();',
      }).length > 0,
    );
  assert.match(
    inspect({
      "app/panel/actions.ts": '"use server"; export async function save(){return {};}',
      "features/auth/domain/probe.ts": 'import {save} from "@/app/panel/actions";',
    }).join("\n"),
    /domain may not import app/,
  );
});

it("does not confuse public schema leaves with private server resource paths", () => {
  assert.match(
    inspect({
      "app/client.tsx":
        '"use client"; import config from "@/server/config.json"; export const x=config;',
      "server/config.json": '{"syntheticPrivateConfig":true}',
    }).join("\n"),
    /client runtime reaches private server module/,
  );
});

it("rejects ambient clock/randomness in pure layers and private environments in client graphs", () => {
  for (const expression of ["Date.now()", "new Date()", "performance.now()", "Math.random()"]) {
    assert.match(
      inspect({ "features/auth/domain/probe.ts": `export const now=()=>${expression};` }).join(
        "\n",
      ),
      /must stay pure/,
    );
  }
  assert.deepEqual(
    inspect({
      "features/auth/domain/probe.ts": "export const time=(Date:{now():number})=>Date.now();",
    }),
    [],
  );
  assert.match(
    inspect({
      "app/client.tsx":
        '"use client"; import {value} from "@/shared/ui/read"; export const x=value;',
      "shared/ui/read.ts": "export const value=process.env.PRIVATE_TEST_TOKEN;",
    }).join("\n"),
    /client runtime accesses process/,
  );
});

it("rejects ambient clock and randomness extraction before alias invocation", () => {
  const sources = [
    "const now = Date.now; export const expires = () => now();",
    "const now = performance.now; export const elapsed = () => now();",
    "const random = Math.random; export const choose = () => random();",
    'const now = Date["now"]; export const expires = () => now();',
    "const { now } = Date; export const expires = () => now();",
    "const { now: clock } = performance; export const elapsed = () => clock();",
    'const { ["random"]: draw } = Math; export const choose = () => draw();',
    "export const expires = ({now} = Date) => now();",
    "export const choose = ({random: draw} = Math) => draw();",
  ];
  for (const layer of ["domain", "application"]) {
    for (const source of sources) {
      assert.match(
        inspect({ [`features/auth/${layer}/probe.ts`]: source }).join("\n"),
        /must stay pure \(ambient clock or randomness\)/,
        source,
      );
    }
  }
});

it("preserves statically extracted methods from injected shadowed clock and randomness ports", () => {
  for (const layer of ["domain", "application"]) {
    for (const source of [
      "export const expires = (Date: {now(): number}) => { const now = Date.now; return now(); };",
      'export const expires = (Date: {now(): number}) => { const now = Date["now"]; return now(); };',
      "export const elapsed = (performance: {now(): number}) => { const {now} = performance; return now(); };",
      "export const choose = (Math: {random(): number}) => { const {random: draw} = Math; return draw(); };",
      "export const expires = () => { const Date = {now: () => 42}; const {now} = Date; return now(); };",
      'export const docs = "Date.now and const {random}=Math are examples";',
      'export const parsed = Date.parse("2026-10-18T00:00:00Z");',
    ]) {
      assert.deepEqual(inspect({ [`features/auth/${layer}/probe.ts`]: source }), [], source);
    }
  }
});

it("keeps server-only packages out of pure layers", () => {
  assert.match(
    inspect({ "features/auth/domain/probe.ts": "import 'server-only';" }).join("\n"),
    /may not import package/,
  );
});

it("blocks private package subpaths through both direct client imports and public barrels", () => {
  for (const specifier of ["pg/lib/client.js", "server-only/index.js"]) {
    for (const files of [
      {
        "app/client.tsx": `"use client"; import Client from "${specifier}"; export const x=Client;`,
      },
      {
        "app/client.tsx":
          '"use client"; import {value} from "@/shared/ui/barrel"; export const x=value;',
        "shared/ui/barrel.ts": `export {default as value} from "${specifier}";`,
      },
      {
        "features/auth/presentation/probe.ts": `import Client from "${specifier}"; export const x=Client;`,
      },
    ])
      assert.match(
        inspect(files).join("\n"),
        /client runtime reaches server package|presentation may not import/,
      );
  }
});
