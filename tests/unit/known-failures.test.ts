import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

type Todo = { name: string; options: string };
/** Tests marked todo in a source file: test/it with a todo option (any order, any quotes) or `.todo(`. */
function todoTests(source: string): Todo[] {
  const found: Todo[] = [];
  const named =
    /\b(?:test|it)(\.todo)?\(\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2\s*(?:,\s*(\{[^}]*\}))?/g;
  for (const match of source.matchAll(named)) {
    const [, dotTodo, , name, options = ""] = match;
    if (dotTodo || /\btodo\b/.test(options)) found.push({ name: name ?? "", options });
  }
  return found;
}

const SUITES = ["unit", "integration", "browser"];
const files = SUITES.flatMap((suite) =>
  readdirSync(new URL(`tests/${suite}/`, root))
    .filter((name) => /\.(test|spec)\.ts$/.test(name))
    .map((name) => `tests/${suite}/${name}`),
);

test("known-failures entries are well formed and unique", () => {
  assert.ok(Array.isArray(listed));
  assert.equal(new Set(listed.map((entry) => entry.id)).size, listed.length);
  for (const entry of listed) {
    for (const key of ["id", "file", "test", "reason", "plan", "owner"] as const)
      assert.ok(typeof entry[key] === "string" && entry[key].length > 0, `${entry.id}: ${key}`);
    assert.match(entry.plan, /^M\d+\.\d+$/);
    assert.match(entry.file, /^tests\/(unit|integration|browser)\/[\w.-]+\.(test|spec)\.ts$/);
  }
});

test("every listed test exists and is still marked todo for its plan item", () => {
  for (const entry of listed) {
    const todo = todoTests(readFileSync(new URL(entry.file, root), "utf8")).find(
      (candidate) => candidate.name === entry.test,
    );
    assert.ok(todo, `${entry.id}: not found as a todo test`);
    assert.ok(todo.options.includes(entry.plan), `${entry.id}: todo text must name ${entry.plan}`);
  }
});

test("every todo test in tests/ is listed", () => {
  const expected = new Set(listed.map((entry) => `${entry.file}::${entry.test}`));
  for (const file of files) {
    if (file === "tests/unit/known-failures.test.ts") continue;
    for (const todo of todoTests(readFileSync(new URL(file, root), "utf8")))
      assert.ok(expected.has(`${file}::${todo.name}`), `unlisted todo test: ${todo.name}`);
  }
});

test("todo detection handles quotes, option order and todo shorthands", () => {
  const source = [
    "test('single', { timeout: 5, todo: 'M1.1' }, () => {});",
    "it(`template`, { todo: true }, () => {});",
    'test.todo("shorthand");',
    'test("plain", () => {});',
    'test("other", { timeout: 5 }, () => {});',
  ].join("\n");
  assert.deepEqual(
    todoTests(source).map((todo) => todo.name),
    ["single", "template", "shorthand"],
  );
});

test("every listed todo test actually fails today (a passing one must leave the list)", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const file of new Set(listed.map((entry) => entry.file))) {
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", file], {
      cwd: new URL(".", root),
      encoding: "utf8",
      env,
    });
    for (const entry of listed.filter((candidate) => candidate.file === file)) {
      const line = run.stdout.split("\n").find((text) => text.includes(` - ${entry.test}`));
      assert.ok(line, `${entry.id}: not reported by ${file}`);
      assert.match(
        line,
        /^\s*not ok \d+ - .*# TODO/,
        `${entry.id} now passes: remove todo and the list entry`,
      );
    }
  }
});
