import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { it } from "node:test";
import { healthBody, SCHEMA_VERSION } from "../../src/server/health.ts";

it("reports the newest migration as the expected schema version", () => {
  const newest = readdirSync("migrations")
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort()
    .at(-1);
  assert.equal(SCHEMA_VERSION, newest?.slice(0, 4));
});

it("adds version and schema_version to the status body (expand only)", () => {
  assert.deepEqual(healthBody("ok", "1.2.3"), {
    status: "ok",
    version: "1.2.3",
    schema_version: SCHEMA_VERSION,
  });
});
