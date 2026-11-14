import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  discoverSurface,
  inheritedGuards,
  type SurfaceEntry,
} from "../../scripts/authz-surface.ts";
import { can } from "../../src/features/auth/domain/access.ts";
import { expectedOutcome, type Guard, MATRIX } from "../authz/matrix.ts";

const root = path.resolve(import.meta.dirname, "../..");
const fixture = (name: string) => path.join(root, "tests/authz/fixtures", name);

/** Differences between the enumerated surface and the committed matrix (empty when in sync). */
function drift(surface: SurfaceEntry[]) {
  const listed = new Set(MATRIX.map((row) => row.id));
  const found = new Set(surface.map((entry) => entry.id));
  return {
    unlisted: [...found].filter((id) => !listed.has(id)),
    stale: [...listed].filter((id) => !found.has(id)),
  };
}

const ROLES = ["owner", "viewer"] as const;
const permitted = (guard: string) => ROLES.filter((role) => can(role, guard as never));

describe("authz matrix", () => {
  const surface = discoverSurface(root);

  it("lists every server action, route handler and panel page, with no stale row", () => {
    assert.deepEqual(drift(surface), { unlisted: [], stale: [] });
    assert.equal(new Set(MATRIX.map((row) => row.id)).size, MATRIX.length, "duplicate row");
  });

  it("covers every mutating entry (all actions, every non-GET handler)", () => {
    const mutating = surface.filter((entry) => entry.mutating);
    assert.ok(mutating.some((entry) => entry.kind === "action"));
    assert.ok(mutating.some((entry) => entry.kind === "route"));
    const listed = new Set(MATRIX.map((row) => row.id));
    for (const entry of mutating) assert.ok(listed.has(entry.id), `unlisted: ${entry.id}`);
  });

  it("matches each session guard in the matrix to the requireActor call in the source", () => {
    for (const row of MATRIX) {
      const entry = surface.find((item) => item.id === row.id);
      assert.ok(entry, row.id);
      if (entry.kind === "route") {
        assert.deepEqual(entry.guards, [], `${row.id}: route handlers do not use requireActor`);
        assert.ok(!["manage_access", "read_operations"].includes(row.guard), row.id);
        continue;
      }
      const chain = inheritedGuards(surface, entry);
      assert.ok(!chain.includes("?"), `${row.id}: requireActor needs a literal action`);
      assert.ok(chain.length > 0, `${row.id}: no requireActor guard`);
      // Every guard in the chain must hold for the roles the row allows (and nothing wider).
      const allowed = permitted(row.guard);
      const effective = ROLES.filter((role) => chain.every((guard) => can(role, guard as never)));
      assert.deepEqual(effective, allowed, `${row.id}: source guards ${chain} vs ${row.guard}`);
      if (entry.kind === "action")
        assert.deepEqual(entry.guards, [row.guard], `${row.id}: actions re-check their own role`);
    }
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

  it("points each row at an existing covering test", () => {
    for (const row of MATRIX) assert.ok(existsSync(path.join(root, row.coveredBy)), row.coveredBy);
  });

  it("negative fixture: an unlisted extra action fails the comparison", () => {
    const extra = discoverSurface(fixture("extra-action"));
    const result = drift(extra);
    assert.ok(
      result.unlisted.includes("action:src/app/panel/accesos/actions.ts#deleteEverythingAction"),
      JSON.stringify(result),
    );
    assert.ok(result.unlisted.includes("action:src/app/panel/accesos/actions.ts#inlineExport"));
    assert.ok(
      result.unlisted.some((id) => id.endsWith("#PUT")),
      "non-GET handler is enumerated",
    );
    assert.ok(result.stale.length > 0, "a fixture that lacks the real surface reports stale rows");
    assert.notDeepEqual(result, { unlisted: [], stale: [] });
  });

  it("enumerates re-exports, inline directives and unusual export shapes", () => {
    const ids = discoverSurface(fixture("shapes")).map((entry) => entry.id);
    assert.deepEqual(ids, [
      "action:src/a/inline.ts#inline:doIt",
      "action:src/a/listed.ts#first",
      "action:src/a/listed.ts#renamed",
      "action:src/a/listed.ts#second",
      "action:src/a/star.ts#*:./listed.ts",
      "route:src/app/x/route.ts#DELETE",
      "route:src/app/x/route.ts#GET",
      "route:src/app/x/route.ts#POST",
    ]);
  });
});
