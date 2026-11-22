// Release notes for `.github/workflows/release.yml` (ADR 010). The version is `package.json`
// `version`; the notes are the matching `## [X.Y.Z] - date` section of CHANGELOG.md (a hyphen or an
// em dash before the date are both accepted).
//
// CLI: `node scripts/release-notes.ts --out <file>` writes the notes and prints `version=` and
// `has_section=` lines (appendable to $GITHUB_OUTPUT). Exits 1 when the version is not X.Y.Z or the
// section exists but is empty; a missing section is reported through `has_section=false`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Returns the `version` of a package.json text; throws unless it is a plain X.Y.Z. */
export function parseVersion(packageJson: string): string {
  const { version } = JSON.parse(packageJson) as { version?: unknown };
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(`package.json version ${JSON.stringify(version)} is not X.Y.Z`);
  }
  return version;
}

/**
 * Returns the trimmed body of the `## [version]` section, or `undefined` when the heading is
 * absent. The body ends at the next level-two heading (`## `, bracketed or not, such as the
 * historical `## 1.0.0 — …` baseline), a link-reference line or the end of the file.
 */
export function extractSection(changelog: string, version: string): string | undefined {
  const lines = changelog.replaceAll("\r\n", "\n").split("\n");
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) return undefined;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ") || /^\[[^\]]+\]: /.test(line)) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

/** The notes of a version; throws when the section is empty, returns `undefined` when missing. */
export function requireNotes(changelog: string, version: string): string | undefined {
  const section = extractSection(changelog, version);
  if (section === "") throw new Error(`CHANGELOG section [${version}] is empty`);
  return section;
}

function main(argv: string[]): number {
  const out = argv[argv.indexOf("--out") + 1];
  if (argv.indexOf("--out") === -1 || out === undefined) {
    console.error("usage: node scripts/release-notes.ts --out <notes-file>");
    return 2;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const version = parseVersion(readFileSync(resolve(root, "package.json"), "utf8"));
    const notes = requireNotes(readFileSync(resolve(root, "CHANGELOG.md"), "utf8"), version);
    console.log(`version=${version}`);
    console.log(`has_section=${notes === undefined ? "false" : "true"}`);
    if (notes !== undefined) writeFileSync(out, `${notes}\n`);
    return 0;
  } catch (error) {
    console.error(`::error title=release::${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
