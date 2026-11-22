import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractSection, parseVersion, requireNotes } from "../../scripts/release-notes.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the CHANGELOG has an Unreleased heading and any current-version section has notes", () => {
  const version = parseVersion(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## \[Unreleased\]$/m);
  assert.doesNotThrow(() => requireNotes(changelog, version));
});

test("parseVersion accepts only X.Y.Z", () => {
  assert.equal(parseVersion('{"version":"1.2.3"}'), "1.2.3");
  assert.throws(() => parseVersion('{"version":"1.2"}'));
  assert.throws(() => parseVersion('{"version":"1.2.3-rc.1"}'));
  assert.throws(() => parseVersion("{}"));
});

const changelog = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "- pending",
  "",
  "## [1.1.0] - 2026-11-01",
  "",
  "### Added",
  "- hyphen",
  "",
  "## [1.0.0] — 2026-10-13",
  "",
  "### Fixed",
  "- em dash",
  "",
  "## [0.9.0] - 2026-09-01",
  "",
  "## [0.8.0] - 2026-08-01",
  "- last",
  "",
  "[0.8.0]: https://example.invalid/0.8.0",
  "",
].join("\n");

test("extractSection handles hyphen and em dash headings and stops at the next heading", () => {
  assert.equal(extractSection(changelog, "1.1.0"), "### Added\n- hyphen");
  assert.equal(extractSection(changelog, "1.0.0"), "### Fixed\n- em dash");
  assert.equal(extractSection(changelog, "0.8.0"), "- last");
});

test("extractSection tolerates CRLF line endings", () => {
  assert.equal(extractSection(changelog.replaceAll("\n", "\r\n"), "1.0.0"), "### Fixed\n- em dash");
});

test("a missing section is undefined and does not match a version prefix", () => {
  assert.equal(extractSection(changelog, "2.0.0"), undefined);
  assert.equal(extractSection(changelog, "1.1"), undefined);
  assert.equal(requireNotes(changelog, "2.0.0"), undefined);
});

test("an empty section is rejected", () => {
  assert.equal(extractSection(changelog, "0.9.0"), "");
  assert.throws(() => requireNotes(changelog, "0.9.0"), /is empty/);
});

test("release.yml triggers only on push to main", () => {
  const workflow = read(".github/workflows/release.yml");
  const on = workflow.match(/^"on":\n((?: {2}.*\n)+)/m)?.[1] ?? "";
  assert.equal(on, "  push:\n    branches:\n      - main\n");
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(workflow, /^ {4}permissions:\n {6}contents: write\n {4}steps:/m);
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request|tags:/);
  const uses = [...workflow.matchAll(/^\s*(?:- )?uses: (\S+)/gm)].map((match) => match[1]);
  assert.deepEqual(
    uses.map((action) => action?.split("@")[0]),
    ["actions/checkout", "actions/setup-node"],
  );
  const ci = read(".github/workflows/ci.yml");
  for (const action of uses) {
    assert.ok(action);
    assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    assert.ok(ci.includes(`uses: ${action}`), `${action} must use the same pin as CI`);
  }
  assert.doesNotMatch(workflow.replace(/^\s*#.*$/gm, ""), /npm (ci|run)|deploy/i);
});

test("a section ends at any level-two heading, including the unbracketed 1.0.0 baseline", () => {
  const log = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "## [2.0.0] - 2026-12-01",
    "",
    "- New dashboard.",
    "",
    "## 1.0.0 — source release baseline (2026-10-17)",
    "",
    "- Old entry.",
  ].join("\n");
  assert.equal(extractSection(log, "2.0.0"), "- New dashboard.");
});

test("release.yml creates the tag create-only and never lets GitHub pick the target", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /--method POST "repos\/\$\{GITHUB_REPOSITORY\}\/git\/refs"/);
  assert.match(workflow, /gh release create "\$tag" [^\n]*--verify-tag/);
  assert.doesNotMatch(workflow, /--target/);
  // A failed lookup is an error, not "no release": only "release not found" means none.
  assert.doesNotMatch(workflow, /\|\| echo none/);
  assert.equal(workflow.match(/grep -q "release not found"/g)?.length, 2);
});
