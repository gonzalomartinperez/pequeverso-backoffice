// Diff coverage: changed executable lines must be covered (90% on auth paths, 80% elsewhere).
// Reads the merged lcov and `git diff -U0 <base>...HEAD`. Node built-ins only.
// Usage: node scripts/diff-coverage.ts [coverage/lcov.info] [--base origin/develop]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { isAuthPath, parseCli, resolveBase } from "./check-coverage.ts";

export const DIFF_FLOORS = { auth: 90, rest: 80 } as const;

/** file -> (line -> hits) for every executable line (DA record). */
export function parseLcov(text: string, root = ""): Map<string, Map<number, number>> {
  const files = new Map<string, Map<number, number>>();
  // Standard lcov only: SF may be relative (c8) or absolute (other producers).
  let current: Map<number, number> | undefined;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      current = new Map();
      const file = line.slice(3).trim();
      files.set(root && file.startsWith(root) ? file.slice(root.length) : file, current);
    } else if (line.startsWith("DA:") && current) {
      const [n, hits] = line.slice(3).split(",");
      current.set(Number(n), Number(hits));
    }
  }
  return files;
}

/**
 * file -> added line numbers from a zero-context unified diff. Hunk bodies are consumed by their
 * declared line counts, so an added line such as `++ x` is never read as a `+++ ` file header.
 */
export function parseChangedLines(diff: string): Map<string, Set<number>> {
  const changed = new Map<string, Set<number>>();
  let file: string | undefined;
  let previous = "";
  let remOld = 0;
  let remNew = 0;
  let next = 0;
  for (const line of diff.split("\n")) {
    if (remOld > 0 || remNew > 0) {
      if (line.startsWith("-")) remOld--;
      else if (line.startsWith("+")) {
        remNew--;
        if (file) (changed.get(file) ?? changed.set(file, new Set()).get(file))?.add(next);
        next++;
      }
      previous = line;
      continue;
    }
    if (line.startsWith("+++ ") && previous.startsWith("--- ")) {
      const target = line.slice(4).split("\t")[0] ?? "";
      file = target === "/dev/null" || target.startsWith('"') ? undefined : target.slice(2);
    } else if (line.startsWith("@@")) {
      const m = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!m) continue;
      remOld = m[1] === undefined ? 1 : Number(m[1]);
      next = Number(m[2]);
      remNew = m[3] === undefined ? 1 : Number(m[3]);
    }
    previous = line;
  }
  return changed;
}

/** True when the module has no runtime statements once types are stripped (types only). */
export function isTypeOnlySource(source: string): boolean {
  let js: string;
  try {
    js = stripTypeScriptTypes(source, { mode: "strip" });
  } catch {
    return false;
  }
  const rest = js
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import\b[^;]*;?\s*$/gm, "")
    .replace(/^\s*export\s*(?:\{[^}]*\}|\*[^;]*)[^;]*;?\s*$/gm, "")
    .trim();
  return rest === "";
}

export type DiffResult = {
  group: "auth" | "rest";
  covered: number;
  total: number;
  percent: number;
};

export function evaluateDiff(
  lcov: Map<string, Map<number, number>>,
  changed: Map<string, Set<number>>,
  typeOnly: (file: string) => boolean = () => false,
): { results: DiffResult[]; errors: string[]; unmeasuredTsxLines: number } {
  const tally = { auth: { covered: 0, total: 0 }, rest: { covered: 0, total: 0 } };
  const errors: string[] = [];
  let unmeasuredTsxLines = 0;
  for (const [file, lines] of changed) {
    if (!file.startsWith("src/")) continue;
    if (file.endsWith(".tsx")) {
      unmeasuredTsxLines += lines.size;
      continue;
    }
    if (!file.endsWith(".ts") || file.endsWith(".d.ts")) continue;
    const executable = lcov.get(file);
    if (!executable) {
      if (!typeOnly(file)) errors.push(`${file} changed but is not in lcov (unmeasured)`);
      continue;
    }
    const group = isAuthPath(file) ? tally.auth : tally.rest;
    for (const n of lines) {
      const hits = executable.get(n);
      if (hits === undefined) continue;
      group.total++;
      if (hits > 0) group.covered++;
    }
  }
  const results = (["auth", "rest"] as const).map((group) => {
    const { covered, total } = tally[group];
    return { group, covered, total, percent: total === 0 ? 100 : (covered / total) * 100 };
  });
  for (const r of results)
    if (!(r.percent >= DIFF_FLOORS[r.group]))
      errors.push(
        `diff coverage ${r.group} ${r.percent.toFixed(1)}% (${r.covered}/${r.total}) is below ${DIFF_FLOORS[r.group]}%`,
      );
  return { results, errors, unmeasuredTsxLines };
}

if (import.meta.main) {
  const { positional, flags } = parseCli(process.argv.slice(2), ["--base"]);
  try {
    const base = resolveBase(flags["--base"] ?? "origin/develop");
    const diff = execFileSync(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "-U0",
        "--no-color",
        "--no-ext-diff",
        "--no-renames",
        base,
        "HEAD",
        "--",
        "src",
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const { results, errors, unmeasuredTsxLines } = evaluateDiff(
      parseLcov(readFileSync(positional ?? "coverage/lcov.info", "utf8"), `${process.cwd()}/`),
      parseChangedLines(diff),
      (file) => isTypeOnlySource(readFileSync(file, "utf8")),
    );
    for (const r of results)
      console.log(
        `Diff coverage ${r.group}: ${r.percent.toFixed(1)}% (${r.covered}/${r.total} changed executable lines)`,
      );
    console.log(`Diff coverage: ${unmeasuredTsxLines} changed .tsx lines are not measured`);
    for (const e of errors) console.error(`Diff coverage gate: ${e}`);
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Diff coverage gate: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
