/**
 * Which files the pull-request mutation run covers (ADR-0018). Prints the files to mutate as one
 * comma-separated list (what `stryker run --mutate` takes) and the reason on stderr; prints nothing
 * when there is nothing to mutate, which the job treats as "skip".
 *
 *   node scripts/mutation-scope.ts <base-ref>   changed files = git diff <base-ref>...HEAD
 *   node scripts/mutation-scope.ts --files a b  explicit file list (tests)
 *
 * Rules: scoped sources that changed; more than MAX_FILES of them are left to the weekly full run;
 * a change to the mutation tooling alone mutates the smallest scoped file as a smoke run.
 */

import { execFileSync } from "node:child_process";
import { globSync, readFileSync, statSync } from "node:fs";
import { matchesGlob } from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_FILES = 8;

/** Changing any of these changes how mutation runs, so a config-only PR gets a smoke run. */
export const TOOLING_FILES: readonly string[] = [
  "stryker.config.json",
  "scripts/mutation-scope.ts",
  "scripts/mutation-gate.ts",
  "quality/ratchets/mutation.json",
];

export type Selection = { files: string[]; reason: string };

/** Repository-relative files that fall inside the mutation scope; test files never do. */
export function inScope(files: readonly string[], globs: readonly string[]): string[] {
  return files.filter(
    (file) => !file.endsWith(".test.ts") && globs.some((glob) => matchesGlob(file, glob)),
  );
}

export function mutateGlobs(configPath = "stryker.config.json"): string[] {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { mutate?: unknown };
  const globs = config.mutate;
  if (!Array.isArray(globs) || !globs.every((glob): glob is string => typeof glob === "string")) {
    throw new Error(`${configPath}: "mutate" must be a list of globs`);
  }
  return globs;
}

/** The smallest scoped source by size, the cheapest file for a smoke run. */
export function smallestScoped(globs: readonly string[]): string {
  const sources = inScope(
    globs.flatMap((glob) => globSync(glob)),
    globs,
  );
  const sized = sources.map((file) => ({ file, size: statSync(file).size }));
  sized.sort((a, b) => a.size - b.size || a.file.localeCompare(b.file));
  const first = sized[0];
  if (first === undefined) throw new Error("no scoped source exists");
  return first.file;
}

export function select(
  changed: readonly string[],
  globs: readonly string[],
  smallest: () => string = () => smallestScoped(globs),
): Selection {
  const scoped = inScope(changed, globs);
  if (scoped.length > MAX_FILES) {
    return {
      files: [],
      reason: `${scoped.length} scoped files changed (more than ${MAX_FILES}): left to the weekly full run`,
    };
  }
  if (scoped.length > 0)
    return { files: scoped, reason: `${scoped.length} scoped file(s) changed` };
  if (changed.some((file) => TOOLING_FILES.includes(file))) {
    return {
      files: [smallest()],
      reason: "mutation tooling changed: smoke run on the smallest scoped file",
    };
  }
  return { files: [], reason: "no scoped module or mutation tooling changed" };
}

function changedFiles(baseRef: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=d", `${baseRef}...HEAD`], {
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [first, ...rest] = process.argv.slice(2);
  if (first === undefined) {
    throw new Error("usage: mutation-scope.ts <base-ref> | --files <file>...");
  }
  const files = first === "--files" ? rest : changedFiles(first);
  const selection = select(files, mutateGlobs());
  process.stderr.write(`${selection.reason}\n`);
  process.stdout.write(selection.files.join(","));
}
