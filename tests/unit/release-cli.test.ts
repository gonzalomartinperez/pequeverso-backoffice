import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("release CLI writes matching notes, handles missing sections, and reports errors", () => {
  const root = mkdtempSync(join(tmpdir(), "bo-release-cli-"));
  try {
    const scripts = join(root, "scripts");
    const script = join(scripts, "release-notes.ts");
    const changelog = join(root, "CHANGELOG.md");
    const output = join(root, "notes.md");
    mkdirSync(scripts);
    copyFileSync(new URL("../../scripts/release-notes.ts", import.meta.url), script);
    writeFileSync(join(root, "package.json"), '{"type":"module","version":"1.2.3"}');
    const stdoutPath = join(root, "stdout");
    const stderrPath = join(root, "stderr");
    const run = (...args: string[]) => {
      const stdout = openSync(stdoutPath, "w");
      const stderr = openSync(stderrPath, "w");
      try {
        const result = spawnSync(process.execPath, [script, ...args], {
          cwd: scripts,
          stdio: ["ignore", stdout, stderr],
        });
        assert.ifError(result.error);
        return {
          status: result.status,
          stdout: readFileSync(stdoutPath, "utf8"),
          stderr: readFileSync(stderrPath, "utf8"),
        };
      } finally {
        closeSync(stderr);
        closeSync(stdout);
      }
    };

    const unreleased = "# Changelog\n\n## [Unreleased]\n\n- Pending change\n";
    writeFileSync(changelog, unreleased);
    const missing = run("--out", output);
    assert.equal(missing.status, 0, missing.stderr);
    assert.equal(missing.stdout, "version=1.2.3\nhas_section=false\n");
    assert.equal(existsSync(output), false);

    writeFileSync(changelog, `${unreleased}\n## [1.2.3] - 2026-11-22\n\n- Reviewed change\n`);
    const result = run("--out", output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "version=1.2.3\nhas_section=true\n");
    assert.equal(readFileSync(output, "utf8"), "- Reviewed change\n");

    for (const args of [[], ["--out"]]) {
      const invalid = run(...args);
      assert.equal(invalid.status, 2);
      assert.match(invalid.stderr, /usage: node scripts\/release-notes\.ts/);
    }
    const unwritable = run("--out", join(root, "missing", "notes.md"));
    assert.equal(unwritable.status, 1);
    assert.match(unwritable.stderr, /::error title=release::.*ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
