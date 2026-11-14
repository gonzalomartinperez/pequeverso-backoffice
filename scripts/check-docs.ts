// Verifies that every relative link in tracked Markdown files points to an existing file and that
// README.md carries the ecosystem template headings in order (docs/master-plan/readme-template.md).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const README_HEADINGS = [
  "Why",
  "Highlights",
  "Architecture",
  "Quickstart",
  "Usage",
  "Quality",
  "Documentation",
  "Ecosystem",
  "Contributing and security",
  "Scope and limits",
  "License",
] as const;

/** Returns one message per required `##` heading that is missing or out of order. */
export function checkReadmeHeadings(markdown: string): string[] {
  const found: string[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && line.startsWith("## ")) found.push(line.slice(3).trim());
  }
  const errors: string[] = [];
  let position = -1;
  for (const heading of README_HEADINGS) {
    const index = found.indexOf(heading, position + 1);
    if (index === -1) {
      errors.push(
        found.includes(heading)
          ? `README heading out of order: ## ${heading}`
          : `README heading missing: ## ${heading}`,
      );
    } else position = index;
  }
  return errors;
}

function main(): number {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        encoding: "utf8",
      }).split("\0"),
    ),
  ].filter((file) => file.endsWith(".md") && existsSync(file));
  let count = 0;
  let missing = 0;
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(
      /!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const target = match[1] ?? "";
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const pathname = decodeURIComponent(target.split("#")[0] ?? "");
      if (!pathname) continue;
      count++;
      if (!existsSync(path.resolve(path.dirname(file), pathname))) {
        console.error(`Missing local documentation target: ${file} → ${target}`);
        missing++;
      }
    }
  }
  const headingErrors = checkReadmeHeadings(readFileSync("README.md", "utf8"));
  for (const error of headingErrors) console.error(error);
  console.log(
    `Documentation: ${count} local links checked, ${missing} missing, ${headingErrors.length} README heading errors.`,
  );
  return missing || headingErrors.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main();
