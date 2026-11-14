// Diff coverage: changed executable lines must be covered (90% on auth paths, 80% elsewhere).
// Reads the merged lcov and `git diff -U0 <base>...HEAD`. Node built-ins only.
// Usage: node scripts/diff-coverage.ts [coverage/lcov.info] [--base origin/develop]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAuthPath } from "./check-coverage.ts";

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

/** file -> added line numbers from a zero-context unified diff. */
export function parseChangedLines(diff: string): Map<string, Set<number>> {
  const changed = new Map<string, Set<number>>();
  let file: string | undefined;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line === "+++ /dev/null" ? undefined : line.slice(6);
    } else if (file && line.startsWith("@@")) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!m) continue;
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      const set = changed.get(file) ?? new Set<number>();
      for (let i = 0; i < count; i++) set.add(start + i);
      changed.set(file, set);
    }
  }
  return changed;
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
): { results: DiffResult[]; errors: string[] } {
  const tally = { auth: { covered: 0, total: 0 }, rest: { covered: 0, total: 0 } };
  for (const [file, lines] of changed) {
    const executable = lcov.get(file);
    if (!executable || !file.startsWith("src/")) continue;
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
  const errors = results
    .filter((r) => r.percent < DIFF_FLOORS[r.group])
    .map(
      (r) =>
        `diff coverage ${r.group} ${r.percent.toFixed(1)}% (${r.covered}/${r.total}) is below ${DIFF_FLOORS[r.group]}%`,
    );
  return { results, errors };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : "origin/develop";
  const lcovPath =
    args.find((a, i) => !a.startsWith("--") && i !== baseIndex + 1) ?? "coverage/lcov.info";
  const diff = execFileSync(
    "git",
    ["diff", "-U0", "--no-color", "--no-ext-diff", `${base}...HEAD`, "--", "src"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const { results, errors } = evaluateDiff(
    parseLcov(readFileSync(lcovPath, "utf8"), `${process.cwd()}/`),
    parseChangedLines(diff),
  );
  for (const r of results)
    console.log(
      `Diff coverage ${r.group}: ${r.percent.toFixed(1)}% (${r.covered}/${r.total} changed executable lines)`,
    );
  for (const e of errors) console.error(`Diff coverage gate: ${e}`);
  if (errors.length) process.exitCode = 1;
}
