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

/** NaN (fails every comparison) when the set is empty: an empty file set can never pass. */
const percent = ({ total, covered }: Counter, count: number): number =>
  count === 0 ? Number.NaN : total === 0 ? 100 : Math.floor((covered / total) * 1000) / 10;

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
  const auth = files.filter(([k]) => isAuthPath(k)).map(([, v]) => v);
  return {
    branchRepo: percent(branches(files.map(([, v]) => v)), files.length),
    branchAuth: percent(branches(auth), auth.length),
    linesStore: store ? percent(store.lines, 1) : Number.NaN,
  };
}

const KEYS = Object.keys(FLOORS) as (keyof Measured)[];
const isPercent = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

/** Every ratchet key must be present and a finite number in [0, 100]. */
export function validateRatchet(value: unknown, label: string): string[] {
  if (typeof value !== "object" || value === null) return [`${label} is not an object`];
  const record = value as Record<string, unknown>;
  return KEYS.filter((key) => !isPercent(record[key])).map(
    (key) => `${label}.${key} must be a finite number in [0, 100]`,
  );
}

export function evaluate(
  measured: Measured,
  ratchet: Ratchet,
  base?: Ratchet,
): { errors: string[]; warnings: string[] } {
  const errors = [
    ...validateRatchet(ratchet, "ratchet"),
    ...(base ? validateRatchet(base, "base ratchet") : []),
  ];
  if (errors.length) return { errors, warnings: [] };
  for (const key of KEYS) {
    // Fail-closed comparisons: NaN (empty file set, missing store file) fails every check.
    if (!(measured[key] >= FLOORS[key]))
      errors.push(`${key} ${measured[key]}% is below the ${FLOORS[key]}% floor`);
    if (!(measured[key] >= ratchet[key]))
      errors.push(`${key} ${measured[key]}% regressed below the ratchet ${ratchet[key]}%`);
    if (base && !(ratchet[key] >= base[key]))
      errors.push(`ratchet ${key} was lowered from ${base[key]} to ${ratchet[key]}`);
  }
  const warnings =
    measured.branchAuth >= AUTH_TARGET
      ? []
      : [
          `branchAuth ${measured.branchAuth}% is below the ${AUTH_TARGET}% plan target (ratchet only)`,
        ];
  return { errors, warnings };
}

const git = (args: string[]): string =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
const gitOk = (args: string[]): boolean => {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolves the revision to compare against. CI checks out the PR merge ref, so a merge commit's
 * first parent is the current base tip; otherwise the merge base with `ref`. Throws when `ref`
 * does not resolve to a commit (fail closed).
 */
export function resolveBase(ref: string): string {
  if (!gitOk(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]))
    throw new Error(`base ref "${ref}" does not resolve to a commit (fetch-depth too shallow?)`);
  if (gitOk(["rev-parse", "--verify", "--quiet", "HEAD^2"])) return "HEAD^1";
  return git(["merge-base", ref, "HEAD"]).trim();
}

/** Ratchet at `rev`, or undefined only when the file does not exist there (first introduction). */
export function readBaseRatchet(rev: string, path: string): unknown | undefined {
  if (!gitOk(["cat-file", "-e", `${rev}:${path}`])) return undefined;
  return JSON.parse(git(["show", `${rev}:${path}`]));
}

/** Positional arguments, skipping value-taking flags and their values. */
export function parseCli(
  args: string[],
  valueFlags: string[],
): { positional: string | undefined; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  let positional: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (valueFlags.includes(arg)) flags[arg] = args[++i] ?? "";
    else if (!arg.startsWith("--") && positional === undefined) positional = arg;
  }
  return { positional, flags };
}

if (import.meta.main) {
  const { positional, flags } = parseCli(process.argv.slice(2), ["--base-ref"]);
  const summaryPath = positional ?? "coverage/coverage-summary.json";
  const ratchetPath = "quality/ratchets/coverage.json";
  try {
    const measured = measure(
      JSON.parse(readFileSync(summaryPath, "utf8")) as Summary,
      `${process.cwd()}/`,
    );
    const ratchet = JSON.parse(readFileSync(ratchetPath, "utf8")) as Ratchet;
    const baseRef = flags["--base-ref"];
    const base = baseRef
      ? (readBaseRatchet(resolveBase(baseRef), ratchetPath) as Ratchet | undefined)
      : undefined;
    console.log(
      `Coverage: branches repo ${measured.branchRepo}%, branches auth ${measured.branchAuth}%, lines store ${measured.linesStore}%`,
    );
    const { errors, warnings } = evaluate(measured, ratchet, base);
    for (const w of warnings) console.warn(`Coverage gate (target): ${w}`);
    for (const e of errors) console.error(`Coverage gate: ${e}`);
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Coverage gate: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
