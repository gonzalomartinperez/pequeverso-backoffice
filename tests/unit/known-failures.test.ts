import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
type Entry = {
  id: string;
  file: string;
  test: string;
  reason: string;
  plan: string;
  owner: string;
};
const listed = (
  JSON.parse(readFileSync(new URL("quality/ratchets/known-failures.json", root), "utf8")) as {
    failures: Entry[];
  }
).failures;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("known-failures entries are well formed and unique", () => {
  assert.ok(Array.isArray(listed));
  assert.equal(new Set(listed.map((entry) => entry.id)).size, listed.length);
  for (const entry of listed) {
    for (const key of ["id", "file", "test", "reason", "plan", "owner"] as const)
      assert.ok(typeof entry[key] === "string" && entry[key].length > 0, `${entry.id}: ${key}`);
    assert.match(entry.plan, /^M\d+\.\d+$/);
    assert.match(entry.file, /^tests\/unit\/[\w.-]+\.test\.ts$/);
  }
});

test("every listed test exists and is still marked todo", () => {
  for (const entry of listed) {
    const source = readFileSync(new URL(entry.file, root), "utf8");
    const declaration = new RegExp(
      `\\btest\\(\\s*"${escapeRegex(entry.test)}",\\s*\\{\\s*todo:\\s*"${escapeRegex(entry.plan)}[:\\s]`,
    );
    assert.match(source, declaration, `${entry.id}: not found as a todo test naming ${entry.plan}`);
  }
});

test("every todo test in tests/unit is listed", () => {
  const expected = new Set(listed.map((entry) => `${entry.file}::${entry.test}`));
  const todo = /\btest\(\s*"((?:[^"\\]|\\.)*)",\s*\{\s*todo:/g;
  for (const name of readdirSync(new URL("tests/unit/", root)).filter((n) =>
    n.endsWith(".test.ts"),
  )) {
    const source = readFileSync(new URL(`tests/unit/${name}`, root), "utf8");
    if (name === "known-failures.test.ts") continue;
    for (const match of source.matchAll(todo))
      assert.ok(expected.has(`tests/unit/${name}::${match[1]}`), `unlisted todo test: ${match[1]}`);
  }
});
