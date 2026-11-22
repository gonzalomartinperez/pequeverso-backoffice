import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { it } from "node:test";

// Every server entry module (route handlers, server actions, proxy, instrumentation) loads under
// plain Node with its package.json subpath imports, outside Next.js: a broken `#…` specifier or
// a module that touches the environment at import time fails here, not at the first request.
// The child inherits NODE_V8_COVERAGE so merged coverage counts the loaded lines.
const root = path.resolve(import.meta.dirname, "../..");
const entries = [
  ...readdirSync(path.join(root, "src/app"), { recursive: true, encoding: "utf8" })
    .filter((file) => /(?:^|\/)(?:route|actions)\.ts$/.test(file))
    .map((file) => `src/app/${file}`),
  "src/proxy.ts",
  "src/instrumentation.ts",
].sort();

it("finds the route handlers and server actions", () => {
  assert.ok(entries.includes("src/app/readyz/route.ts"));
  assert.ok(entries.includes("src/app/panel/accesos/actions.ts"));
  assert.ok(entries.length >= 8, entries.join(", "));
});

it("loads every server entry module outside Next.js without configuration", () => {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? "", NODE_ENV: "test" };
  if (process.env.NODE_V8_COVERAGE) env.NODE_V8_COVERAGE = process.env.NODE_V8_COVERAGE;
  const script = `for (const file of ${JSON.stringify(entries)}) await import(new URL(file, ${JSON.stringify(`file://${root}/`)}).href); console.log("loaded");`;
  const result = spawnSync(
    process.execPath,
    ["--import", "./tests/unit/support/server-modules.ts", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8", env, timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /loaded/);
});
