import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PERMISSIONS_DOC, renderPermissions } from "../../scripts/generate-permissions.ts";

describe("docs/reference/permissions.md", () => {
  it("is up to date with the authz matrix (run: node scripts/generate-permissions.ts)", () => {
    const committed = readFileSync(
      path.resolve(import.meta.dirname, "../..", PERMISSIONS_DOC),
      "utf8",
    );
    assert.equal(committed, renderPermissions());
  });
});
