import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";

// OD-53: the retired domain is never used as a contact, link or fixture value.
// Built at runtime so this test file does not match itself.
const retiredDomain = ["digitalproducts", "team", ".com"].join("");
const pattern = new RegExp(retiredDomain.replaceAll(".", "\\."), "i");

// Files that record the decision itself (owner registers and the plan that schedules the sweep).
// Exact paths, not prefixes: a new mention anywhere else fails and needs review.
const decisionRecords = new Set([
  "docs/master-plan/RESUME.md",
  "docs/master-plan/docs-and-community.md",
  "docs/master-plan/owner-decisions-existing.md",
  "docs/master-plan/owner-decisions.md",
  "docs/master-plan/roadmap.md",
]);

type Entry = { path: string; text: string };

function retiredDomainReferences(entries: Iterable<Entry>): string[] {
  const offenders: string[] = [];
  for (const { path, text } of entries) {
    if (!decisionRecords.has(path) && pattern.test(text)) offenders.push(path);
  }
  return offenders;
}

function* repositoryEntries(): Generator<Entry> {
  const root = new URL("../../", import.meta.url);
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
  for (const path of new Set(files)) {
    const url = new URL(path, root);
    if (!existsSync(url) || !statSync(url).isFile()) continue;
    const bytes = readFileSync(url);
    if (bytes.includes(0)) continue;
    yield { path, text: bytes.toString("utf8") };
  }
}

describe("retired domain (OD-53)", () => {
  it("has no reference outside the decision records", () => {
    assert.deepEqual(retiredDomainReferences(repositoryEntries()), []);
  });

  it("flags a reference in any other file, case-insensitively", () => {
    const fixtures: Entry[] = [
      { path: "SECURITY.md", text: `Write to soporte@${retiredDomain}.` },
      {
        path: "tests/fixtures/ops.json",
        text: `{"contact":"https://${retiredDomain.toUpperCase()}"}`,
      },
      { path: "docs/master-plan/progress.md", text: retiredDomain },
      { path: "README.md", text: "Write to soporte@pequeverso.com." },
      { path: "docs/master-plan/owner-decisions.md", text: retiredDomain },
    ];
    assert.deepEqual(retiredDomainReferences(fixtures), [
      "SECURITY.md",
      "tests/fixtures/ops.json",
      "docs/master-plan/progress.md",
    ]);
  });

  it("does not match look-alike domains", () => {
    assert.deepEqual(
      retiredDomainReferences([
        { path: "a.md", text: "digitalproductsteam.co digitalproducts.com" },
      ]),
      [],
    );
  });
});
