import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  evaluate,
  measure,
  parseCli,
  type Ratchet,
  readBaseRatchet,
  resolveBase,
  STORE_FILE,
  type Summary,
} from "../../scripts/check-coverage.ts";
import {
  evaluateDiff,
  isTypeOnlySource,
  parseChangedLines,
  parseLcov,
} from "../../scripts/diff-coverage.ts";

const script = (name: string) => path.resolve("scripts", name);
const counter = (covered: number, total: number) => ({
  branches: { covered, total },
  lines: { covered, total },
});
const root = "/repo/";
const summary = (
  store: [number, number],
  auth: [number, number],
  other: [number, number],
): Summary => ({
  total: counter(0, 0),
  [`${root}${STORE_FILE}`]: counter(...store),
  [`${root}src/server/auth.ts`]: counter(...auth),
  [`${root}src/shared/lib/format.ts`]: counter(...other),
});
const ratchet: Ratchet = { branchRepo: 80, branchAuth: 80, linesStore: 80 };

describe("coverage gate (synthetic fixtures)", () => {
  it("passes when floors and ratchet hold, warning below the auth target", () => {
    const measured = measure(summary([9, 10], [19, 20], [8, 10]), root);
    assert.deepEqual(measured, { branchRepo: 90, branchAuth: 93.3, linesStore: 90 });
    assert.deepEqual(evaluate(measured, ratchet), { errors: [], warnings: [] });
    const { warnings } = evaluate({ ...measured, branchAuth: 85 }, ratchet);
    assert.match(warnings[0] ?? "", /below the 90% plan target/);
  });

  it("fails below the floors (negative fixture)", () => {
    const measured = measure(summary([1, 10], [8, 10], [5, 10]), root);
    const { errors } = evaluate(measured, ratchet);
    assert.equal(errors.length, 6);
    assert.match(errors.join("\n"), /branchAuth 45% is below the 80% floor/);
    assert.match(errors.join("\n"), /linesStore 10% is below the 80% floor/);
  });

  it("fails below the ratchet even above the floor", () => {
    const high: Ratchet = { branchRepo: 95, branchAuth: 99, linesStore: 95 };
    const { errors } = evaluate({ branchRepo: 90, branchAuth: 93.3, linesStore: 90 }, high);
    assert.equal(errors.length, 3);
    assert.match(errors[0] ?? "", /regressed below the ratchet 95%/);
  });

  it("rejects a lowered ratchet against the base", () => {
    const base: Ratchet = { branchRepo: 91, branchAuth: 95, linesStore: 90 };
    const { errors } = evaluate({ branchRepo: 99, branchAuth: 99, linesStore: 99 }, ratchet, base);
    assert.equal(errors.length, 3);
    assert.match(errors[0] ?? "", /ratchet branchRepo was lowered from 91 to 80/);
  });

  it("fails closed on a missing store file and on empty file sets (NaN)", () => {
    const partial: Summary = { total: counter(0, 0), [`${root}src/a.ts`]: counter(1, 1) };
    const measured = measure(partial, root);
    assert.ok(Number.isNaN(measured.linesStore));
    assert.ok(Number.isNaN(measured.branchAuth));
    assert.equal(evaluate(measured, ratchet).errors.length >= 4, true);
    const empty = measure({ total: counter(0, 0) }, root);
    assert.ok(Number.isNaN(empty.branchRepo));
    assert.ok(evaluate(empty, ratchet).errors.length >= 6);
  });

  it("rejects a ratchet with a deleted, non-numeric, NaN or out-of-range key", () => {
    const measured = { branchRepo: 99, branchAuth: 99, linesStore: 99 };
    for (const bad of [
      { branchRepo: 80, branchAuth: 80 },
      { branchRepo: "80", branchAuth: 80, linesStore: 80 },
      { branchRepo: Number.NaN, branchAuth: 80, linesStore: 80 },
      { branchRepo: 80, branchAuth: 101, linesStore: 80 },
      { branchRepo: 80, branchAuth: 80, linesStore: -1 },
      null,
    ]) {
      const { errors } = evaluate(measured, bad as unknown as Ratchet);
      assert.ok(errors.length > 0, JSON.stringify(bad));
    }
    assert.ok(evaluate(measured, ratchet, { branchRepo: 80 } as unknown as Ratchet).errors.length);
  });

  it("fails when a measured value is NaN even with a valid ratchet", () => {
    const { errors } = evaluate(
      { branchRepo: Number.NaN, branchAuth: 90, linesStore: 90 },
      ratchet,
    );
    assert.equal(errors.length, 2);
  });
});

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pvb-cov-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: dir,
      stdio: "pipe",
    });
  git("init", "-q", "-b", "main");
  return dir;
}
const gitIn = (dir: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
    cwd: dir,
    stdio: "pipe",
    encoding: "utf8",
  });

describe("base resolution (temporary repository)", () => {
  it("fails on an unresolvable ref and only a file absent at base is a first introduction", () => {
    const dir = tempRepo();
    const here = process.cwd();
    try {
      process.chdir(dir);
      writeFileSync("a.txt", "x");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "one");
      assert.throws(() => resolveBase("does-not-exist"), /does not resolve/);
      const rev = resolveBase("HEAD");
      assert.equal(readBaseRatchet(rev, "quality/ratchets/coverage.json"), undefined);
      mkdirSync("quality/ratchets", { recursive: true });
      writeFileSync("quality/ratchets/coverage.json", '{"branchRepo":1}');
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "two");
      assert.deepEqual(readBaseRatchet("HEAD", "quality/ratchets/coverage.json"), {
        branchRepo: 1,
      });
      writeFileSync("quality/ratchets/coverage.json", "{not json");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "three");
      assert.throws(() => readBaseRatchet("HEAD", "quality/ratchets/coverage.json"));
    } finally {
      process.chdir(here);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses the first parent of a merge commit (PR merge ref) as the base", () => {
    const dir = tempRepo();
    const here = process.cwd();
    try {
      process.chdir(dir);
      writeFileSync("a.txt", "x");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "base");
      gitIn(dir, "checkout", "-q", "-b", "pr");
      writeFileSync("b.txt", "y");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "pr");
      gitIn(dir, "checkout", "-q", "main");
      writeFileSync("c.txt", "z");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "base moved");
      gitIn(dir, "merge", "-q", "--no-ff", "pr", "-m", "merge ref");
      const stale = gitIn(dir, "rev-parse", "HEAD~2").trim();
      assert.equal(resolveBase(stale), "HEAD^1");
    } finally {
      process.chdir(here);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CLI parsing and entry points", () => {
  it("reads a positional argument at index 0 with and without flags", () => {
    assert.equal(parseCli(["sum.json"], ["--base-ref"]).positional, "sum.json");
    assert.equal(
      parseCli(["--base-ref", "abc", "sum.json"], ["--base-ref"]).positional,
      "sum.json",
    );
    assert.equal(
      parseCli(["sum.json", "--base-ref", "abc"], ["--base-ref"]).flags["--base-ref"],
      "abc",
    );
    assert.equal(parseCli(["--base-ref", "abc"], ["--base-ref"]).positional, undefined);
  });

  it("check-coverage CLI honours a positional summary and fails on a broken ratchet", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pvb-cli-"));
    try {
      mkdirSync(path.join(dir, "quality/ratchets"), { recursive: true });
      const file = (name: string, value: unknown) =>
        writeFileSync(path.join(dir, name), JSON.stringify(value));
      const make = (c: number, t: number) => ({
        total: counter(0, 0),
        [`${dir}/src/server/auth.ts`]: counter(c, t),
        [`${dir}/${STORE_FILE}`]: counter(c, t),
      });
      file("good.json", make(9, 10));
      file("bad.json", make(1, 10));
      file("quality/ratchets/coverage.json", { branchRepo: 80, branchAuth: 80, linesStore: 80 });
      const run = (summary: string) =>
        spawnSync(process.execPath, [script("check-coverage.ts"), summary], {
          cwd: dir,
          encoding: "utf8",
        });
      assert.equal(run("good.json").status, 0);
      assert.equal(run("bad.json").status, 1);
      file("quality/ratchets/coverage.json", { branchRepo: 80 });
      const broken = run("good.json");
      assert.equal(broken.status, 1);
      assert.match(broken.stderr, /branchAuth must be a finite number/);
      assert.equal(
        spawnSync(
          process.execPath,
          [script("check-coverage.ts"), "good.json", "--base-ref", "nope"],
          { cwd: dir },
        ).status,
        1,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("diff-coverage CLI fails on an unmeasured changed file and passes when covered", () => {
    const dir = tempRepo();
    try {
      mkdirSync(path.join(dir, "src"));
      writeFileSync(path.join(dir, "src/a.ts"), "export const a = 1;\n");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "base");
      writeFileSync(path.join(dir, "src/a.ts"), "export const a = 1;\nexport const b = 2;\n");
      gitIn(dir, "add", ".");
      gitIn(dir, "commit", "-q", "-m", "change");
      writeFileSync(path.join(dir, "ok.info"), "SF:src/a.ts\nDA:2,1\nend_of_record\n");
      writeFileSync(path.join(dir, "missing.info"), "SF:src/other.ts\nDA:1,1\nend_of_record\n");
      writeFileSync(path.join(dir, "miss.info"), "SF:src/a.ts\nDA:2,0\nend_of_record\n");
      const run = (lcov: string) =>
        spawnSync(process.execPath, [script("diff-coverage.ts"), lcov, "--base", "HEAD~1"], {
          cwd: dir,
          encoding: "utf8",
        });
      assert.equal(run("ok.info").status, 0);
      assert.equal(run("miss.info").status, 1);
      const unmeasured = run("missing.info");
      assert.equal(unmeasured.status, 1);
      assert.match(unmeasured.stderr, /src\/a\.ts changed but is not in lcov/);
      assert.equal(
        spawnSync(process.execPath, [script("diff-coverage.ts"), "ok.info", "--base", "nope"], {
          cwd: dir,
        }).status,
        1,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("diff coverage (synthetic fixtures)", () => {
  const lcov = parseLcov(
    [
      "SF:src/server/auth.ts",
      "DA:1,1",
      "DA:2,0",
      "DA:3,1",
      "end_of_record",
      "SF:src/shared/lib/format.ts",
      "DA:1,1",
      "DA:2,1",
      "DA:3,1",
      "DA:4,1",
      "DA:5,0",
      "end_of_record",
    ].join("\n"),
  );

  it("parses zero-context diffs, including single-line hunks and deleted files", () => {
    const changed = parseChangedLines(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,0 +2,2 @@",
        "+one",
        "+two",
        "@@ -9 +11 @@",
        "-old",
        "+new",
        "@@ -20,2 +30,0 @@",
        "-gone1",
        "-gone2",
        "--- a/src/gone.ts",
        "+++ /dev/null",
        "@@ -1,3 +0,0 @@",
        "-x",
        "-y",
        "-z",
      ].join("\n"),
    );
    assert.deepEqual([...(changed.get("src/a.ts") ?? [])], [2, 3, 11]);
    assert.equal(changed.has("src/gone.ts"), false);
  });

  it("never reads an added line starting with '++ ' as a file header", () => {
    const changed = parseChangedLines(
      [
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -3 +3,2 @@",
        "--- removed",
        "+++ added-looks-like-header",
        "+real",
        "--- a/src/b.ts",
        "+++ b/src/b.ts",
        "@@ -0,0 +1 @@",
        "+x",
      ].join("\n"),
    );
    assert.deepEqual([...(changed.get("src/a.ts") ?? [])], [3, 4]);
    assert.deepEqual([...(changed.get("src/b.ts") ?? [])], [1]);
    assert.equal(changed.has("added-looks-like-header"), false);
  });

  it("fails a changed .ts file missing from lcov unless type-only, and counts .tsx lines", () => {
    const changed = new Map([
      ["src/new.ts", new Set([1])],
      ["src/types.ts", new Set([1])],
      ["src/ui.tsx", new Set([1, 2, 3])],
    ]);
    const r = evaluateDiff(lcov, changed, (f) => f === "src/types.ts");
    assert.deepEqual(r.errors, ["src/new.ts changed but is not in lcov (unmeasured)"]);
    assert.equal(r.unmeasuredTsxLines, 3);
  });

  it("detects type-only modules", () => {
    assert.equal(isTypeOnlySource("export interface A { a: string }\nexport type B = A;\n"), true);
    assert.equal(
      isTypeOnlySource("import type { A } from './a.ts';\n// c\nexport type B = A;\n"),
      true,
    );
    assert.equal(isTypeOnlySource("export const a = 1;\n"), false);
  });

  it("passes when changed lines are covered and ignores non-executable lines", () => {
    const changed = new Map([
      ["src/server/auth.ts", new Set([1, 3, 99])],
      ["src/shared/lib/format.ts", new Set([1, 2, 3, 4, 5])],
    ]);
    const { errors, results } = evaluateDiff(lcov, changed);
    assert.deepEqual(errors, []);
    assert.equal(results.find((r) => r.group === "auth")?.total, 2);
  });

  it("fails an uncovered auth change at 90% and the rest at 80% (negative fixture)", () => {
    const authOnly = evaluateDiff(lcov, new Map([["src/server/auth.ts", new Set([1, 2, 3])]]));
    assert.equal(authOnly.errors.length, 1);
    assert.match(authOnly.errors[0] ?? "", /auth 66\.7%/);
    const rest = evaluateDiff(lcov, new Map([["src/shared/lib/format.ts", new Set([4, 5])]]));
    assert.match(rest.errors[0] ?? "", /rest 50\.0%/);
  });

  it("accepts absolute SF paths from other lcov producers", () => {
    const abs = parseLcov("SF:/repo/src/a.ts\nDA:1,1\nend_of_record", "/repo/");
    assert.equal(abs.has("src/a.ts"), true);
  });

  it("passes when the diff touches no executable source", () => {
    assert.deepEqual(evaluateDiff(lcov, new Map([["docs/a.md", new Set([1])]])).errors, []);
  });
});
