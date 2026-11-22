import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

// Characterization of the composition root (src/server/container.ts) and the environment module
// (src/server/env.ts), run in a child process because both carry the `server-only` marker.
// Synthetic, test-mode settings only; fetch is stubbed, so no network is used.
const SYNTHETIC = {
  BACKOFFICE_ENVIRONMENT: "test",
  AUTH_TEST_ISSUER: "http://127.0.0.1:8218",
  DATABASE_URL: "postgres://u:p@127.0.0.1:5432/bo_test_unit",
  OPS_API_URL: "http://127.0.0.1:8217/",
  OPS_READ_TOKEN: "t".repeat(40),
};

function probe(origin: string, nodeEnv: "test" | "development" = "test") {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    ...SYNTHETIC,
    BACKOFFICE_ORIGIN: origin,
    NODE_ENV: nodeEnv,
  };
  // Keep merged coverage (scripts/coverage.ts) for the child.
  if (process.env.NODE_V8_COVERAGE) env.NODE_V8_COVERAGE = process.env.NODE_V8_COVERAGE;
  const result = spawnSync(
    process.execPath,
    ["--import", "./tests/unit/support/server-modules.ts", "tests/unit/support/container-probe.ts"],
    { encoding: "utf8", env, timeout: 20_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}");
}

describe("server composition root", () => {
  const local = probe("http://127.0.0.1:3221");
  const secure = probe("https://127.0.0.1:3221", "development");

  it("reads operations fresh per call through the HTTP adapter, with the bearer server-side", () => {
    const out = local;
    assert.equal(out.ok, "ok");
    assert.equal(out.down, "unavailable");
    assert.deepEqual(
      out.calls.map((call: { url: string }) => call.url),
      [
        "http://127.0.0.1:8217/internal/v1/ops/summary",
        "http://127.0.0.1:8217/internal/v1/ops/summary",
      ],
    );
    assert.ok(
      out.calls.every((call: { authorization: string }) => call.authorization === "present"),
    );
  });

  it("does not call the telemetry endpoint while telemetry is disabled", () => {
    const out = local;
    assert.equal(out.telemetry, "disabled");
    assert.equal(out.calls.length, 2);
  });

  it("authorizes before any analytics read (no request scope here, so it rejects)", () => {
    assert.equal(local.analytics, "rejected");
  });

  it("derives the proxy's raw checks from the environment", () => {
    assert.deepEqual([local.developmentBuild, local.httpsOrigin], [false, false]);
    assert.deepEqual([secure.developmentBuild, secure.httpsOrigin], [true, true]);
  });
});
