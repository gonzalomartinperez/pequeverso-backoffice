import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  checkFiles,
  checkGlobal,
  gateTarget,
  readBaselines,
  score,
} from "../../scripts/mutation-gate.ts";
import {
  inScope,
  MAX_FILES,
  mutateGlobs,
  select,
  TOOLING_FILES,
} from "../../scripts/mutation-scope.ts";

const globs = mutateGlobs();

test("the mutation scope lists only pure modules that exist, never UI glue", () => {
  assert.ok(globs.length > 0);
  for (const glob of globs) assert.doesNotMatch(glob, /presentation|components|\.tsx|app\//);
});

test("inScope keeps scoped sources and drops tests, UI and unrelated files", () => {
  const files = [
    "src/features/auth/domain/access.ts",
    "src/server/csp.ts",
    "src/features/operations/domain/summary.ts",
    "src/features/auth/presentation/panel.tsx",
    "src/features/auth/domain/access.test.ts",
    "src/shared/ui/button.tsx",
    "docs/ci.md",
  ];
  assert.deepEqual(inScope(files, globs), [
    "src/features/auth/domain/access.ts",
    "src/server/csp.ts",
    "src/features/operations/domain/summary.ts",
  ]);
  assert.deepEqual(inScope(["README.md"], globs), []);
});

const smallest = () => "src/server/csp.ts";

test("select skips the two type-only modules excluded by the mutate globs", () => {
  const typeOnly = [
    "src/features/auth/application/ports.ts",
    "src/features/operations/domain/telemetry.ts",
  ];
  assert.deepEqual(select(typeOnly, globs, smallest).files, []);
  assert.deepEqual(select([...typeOnly, smallest()], globs, smallest).files, [smallest()]);
});

test("select requests the full scope above the limit and retains every changed scoped file", () => {
  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => `src/features/auth/domain/f${i}.ts`);
  const full = select(many, globs, smallest);
  assert.equal(full.full, true);
  assert.deepEqual(full.files, many);
  const narrowed = select(many.slice(0, MAX_FILES), globs, smallest);
  assert.equal(narrowed.full, false);
  assert.deepEqual(narrowed.files, many.slice(0, MAX_FILES));
});

test("select smoke-runs on tooling-only changes and skips unrelated changes", () => {
  assert.deepEqual(select(["stryker.config.json"], globs, smallest).files, [smallest()]);
  assert.deepEqual(select(["docs/ci.md", "src/app/page.tsx"], globs, smallest).files, []);
  assert.deepEqual(select(["src/server/csp.ts", "stryker.config.json"], globs, smallest).files, [
    "src/server/csp.ts",
  ]);
});

test("the ci-profile mutation paths cover the inclusive mutate globs and mutation tooling", () => {
  const profile = JSON.parse(readFileSync(".github/ci-profile.json", "utf8")) as {
    profiles: Record<string, { paths?: string[] }>;
  };
  const paths = profile.profiles.mutation?.paths ?? [];
  const dirs = globs
    .filter((glob) => !glob.startsWith("!"))
    .map((glob) => glob.replace(/\/\*\*\/\*\.ts$/, "/**"));
  assert.deepEqual([...paths].sort(), [...dirs, ...TOOLING_FILES].sort());
});

const mutants = (statuses: Record<string, number>) =>
  Object.entries(statuses).flatMap(([status, n]) => Array.from({ length: n }, () => ({ status })));

test("score counts killed and timed-out mutants and ignores runtime and compile errors", () => {
  assert.equal(score(mutants({ Killed: 3, Timeout: 1, Survived: 4, RuntimeError: 9 })), 50);
  assert.equal(score(mutants({ RuntimeError: 2 })), undefined);
});

const report = (file: string, statuses: Record<string, number>) => ({
  files: { [file]: { mutants: mutants(statuses) } },
});
const baselines = readBaselines({
  values: [{ key: "score", value: 70 }],
  files: { "a.ts": 75 },
});

test("the gate fails a file below its per-file baseline and passes one at or above it", () => {
  assert.equal(
    checkFiles(report("a.ts", { Killed: 3, Survived: 1 }), baselines, ["a.ts"]).length,
    0,
  );
  assert.equal(
    checkFiles(report("a.ts", { Killed: 2, Survived: 1 }), baselines, ["a.ts"]).length,
    1,
  );
});

test("a file without a baseline must reach the break of 70", () => {
  assert.equal(
    checkFiles(report("new.ts", { Killed: 7, Survived: 3 }), baselines, ["new.ts"]).length,
    0,
  );
  assert.equal(
    checkFiles(report("new.ts", { Killed: 2, Survived: 1 }), baselines, ["new.ts"]).length,
    1,
  );
});

test("the gate fails a listed file that is missing from the report", () => {
  assert.equal(checkFiles(report("a.ts", { Killed: 1 }), baselines, ["b.ts"]).length, 1);
});

test("the gate fails a baselined file when the report contains no countable mutants for it", () => {
  const cases: Record<string, number>[] = [{}, { RuntimeError: 1, CompileError: 1, Ignored: 1 }];
  for (const statuses of cases) {
    assert.deepEqual(checkFiles(report("a.ts", statuses), baselines, ["a.ts"]), [
      "a.ts: no countable mutants for its per-file baseline",
    ]);
  }
  assert.deepEqual(checkFiles(report("new.ts", {}), baselines, ["new.ts"]), []);
});

test("the gate needs either --global or a non-empty --files list", () => {
  for (const args of [
    [],
    ["--files"],
    ["--files", "", "--report", "report.json"],
    ["--files", " , "],
    ["--files", "--report", "report.json"],
  ]) {
    assert.equal(gateTarget(args), undefined);
  }
  assert.deepEqual(gateTarget(["--global"]), { global: true, files: [] });
  assert.deepEqual(gateTarget(["--files", "a.ts,b.ts"]), {
    global: false,
    files: ["a.ts", "b.ts"],
  });
});

test("the global check fails below the global baseline only", () => {
  assert.equal(checkGlobal(report("a.ts", { Killed: 7, Survived: 3 }), baselines).length, 0);
  assert.equal(checkGlobal(report("a.ts", { Killed: 6, Survived: 4 }), baselines).length, 1);
});

test("every per-file baseline in quality/ratchets/mutation.json is a scoped file", () => {
  const ratchet = JSON.parse(readFileSync("quality/ratchets/mutation.json", "utf8")) as {
    files: Record<string, number>;
  };
  assert.deepEqual(
    inScope(Object.keys(ratchet.files), globs).sort(),
    Object.keys(ratchet.files).sort(),
  );
});
