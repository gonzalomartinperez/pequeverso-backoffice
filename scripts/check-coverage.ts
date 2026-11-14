// Coverage gate: reads the c8 json-summary of the merged unit + integration run, enforces the
// floors and the ratchet (quality/ratchets/coverage.json). Node built-ins only.
// Usage: node scripts/check-coverage.ts [summary.json] [--base-ref origin/develop]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Counter = { total: number; covered: number };
type FileSummary = { branches: Counter; lines: Counter };
export type Summary = Record<string, FileSummary>;
export type Measured = { branchRepo: number; branchAuth: number; linesStore: number };
export type Ratchet = Measured;

/** Hard floors. `auth` is an interim 80 while the plan target (90) is not met; see AUTH_TARGET. */
export const FLOORS: Measured = { branchRepo: 80, branchAuth: 80, linesStore: 80 };
/** Plan target for branch coverage on auth paths (testing.md): reported, not yet enforced. */
export const AUTH_TARGET = 90;
export const STORE_FILE = "src/features/auth/adapters/postgres-access-store.ts";

export const isAuthPath = (file: string): boolean =>
  file.startsWith("src/features/auth/") || file === "src/server/auth.ts";

const percent = ({ total, covered }: Counter): number =>
  total === 0 ? 100 : Math.floor((covered / total) * 1000) / 10;

const branches = (files: FileSummary[]): Counter => ({
  total: files.reduce((n, f) => n + f.branches.total, 0),
  covered: files.reduce((n, f) => n + f.branches.covered, 0),
});

/** Normalises the absolute paths c8 writes to repository-relative ones and drops the `total` key. */
export function measure(summary: Summary, root: string): Measured {
  const files = Object.entries(summary)
    .filter(([key]) => key !== "total")
    .map(([key, value]) => [key.startsWith(root) ? key.slice(root.length) : key, value] as const);
  const store = files.find(([key]) => key === STORE_FILE)?.[1];
  return {
    branchRepo: percent(branches(files.map(([, v]) => v))),
    branchAuth: percent(branches(files.filter(([k]) => isAuthPath(k)).map(([, v]) => v))),
    linesStore: store ? percent(store.lines) : 0,
  };
}

export function evaluate(
  measured: Measured,
  ratchet: Ratchet,
  base?: Ratchet,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  for (const key of Object.keys(FLOORS) as (keyof Measured)[]) {
    if (measured[key] < FLOORS[key])
      errors.push(`${key} ${measured[key]}% is below the ${FLOORS[key]}% floor`);
    if (measured[key] < ratchet[key])
      errors.push(`${key} ${measured[key]}% regressed below the ratchet ${ratchet[key]}%`);
    if (base && ratchet[key] < base[key])
      errors.push(`ratchet ${key} was lowered from ${base[key]} to ${ratchet[key]}`);
  }
  const warnings =
    measured.branchAuth < AUTH_TARGET
      ? [
          `branchAuth ${measured.branchAuth}% is below the ${AUTH_TARGET}% plan target (ratchet only)`,
        ]
      : [];
  return { errors, warnings };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const refIndex = args.indexOf("--base-ref");
  const baseRef = refIndex >= 0 ? args[refIndex + 1] : undefined;
  const summaryPath =
    args.find((a, i) => !a.startsWith("--") && i !== refIndex + 1) ??
    "coverage/coverage-summary.json";
  const ratchetPath = "quality/ratchets/coverage.json";
  const root = `${process.cwd()}/`;
  const measured = measure(JSON.parse(readFileSync(summaryPath, "utf8")) as Summary, root);
  const ratchet = JSON.parse(readFileSync(ratchetPath, "utf8")) as Ratchet;
  let base: Ratchet | undefined;
  if (baseRef) {
    try {
      base = JSON.parse(
        execFileSync("git", ["show", `${baseRef}:${ratchetPath}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      ) as Ratchet;
    } catch {
      base = undefined; // first introduction of the ratchet file
    }
  }
  console.log(
    `Coverage: branches repo ${measured.branchRepo}%, branches auth ${measured.branchAuth}%, lines store ${measured.linesStore}%`,
  );
  const { errors, warnings } = evaluate(measured, ratchet, base);
  for (const w of warnings) console.warn(`Coverage gate (target): ${w}`);
  for (const e of errors) console.error(`Coverage gate: ${e}`);
  if (errors.length) process.exitCode = 1;
}
