import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { validateSkills } from "../../scripts/check-skills.ts";

const repository = path.resolve(import.meta.dirname, "../..");
const names = ["web-change-backoffice", "web-review-delivery", "web-verify-backoffice"];
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function put(file: string, content = "fixture\n"): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "bo-skills-"));
  temporary.push(root);
  put(path.join(root, "package.json"), readFileSync(path.join(repository, "package.json"), "utf8"));
  put(path.join(root, "CLAUDE.md"), "@AGENTS.md\n");
  mkdirSync(path.join(root, ".agents/skills"), { recursive: true });
  for (const name of names) {
    const entry = path.join(root, ".claude/skills", name, "SKILL.md");
    const content = readFileSync(path.join(repository, ".claude/skills", name, "SKILL.md"), "utf8");
    put(entry, content);
    symlinkSync(`../../.claude/skills/${name}`, path.join(root, ".agents/skills", name), "dir");
  }
  // Only reference existence matters here; these fixtures never execute a procedure.
  for (const name of names) {
    const entry = path.join(root, ".claude/skills", name, "SKILL.md");
    const content = readFileSync(entry, "utf8");
    for (const [, target = ""] of content.matchAll(/\]\(([^\s)]+)\)/g)) {
      if (!/^(?:https?:|mailto:|#)/.test(target) && !target.endsWith("SKILL.md"))
        put(path.resolve(path.dirname(entry), target.split("#")[0] ?? ""));
    }
    for (const match of content.matchAll(/\bscripts\/[\w./-]+/g)) put(path.join(root, match[0]));
  }
  assert.deepEqual(validateSkills(root).errors, [], "valid disposable fixture");
  return root;
}

function edit(root: string, transform: (source: string) => string): void {
  const file = path.join(root, ".claude/skills/web-change-backoffice/SKILL.md");
  writeFileSync(file, transform(readFileSync(file, "utf8")));
}

function rejects(root: string, pattern: RegExp): void {
  assert.match(validateSkills(root).errors.join("\n"), pattern);
}

describe("canonical backoffice skill discovery", () => {
  it("resolves both clients to the same three procedures from any working directory", () => {
    assert.deepEqual(validateSkills(repository), { names, errors: [] });
    assert.deepEqual(validateSkills(fixture()), { names, errors: [] });
    const cli = spawnSync(process.execPath, [path.join(repository, "scripts/check-skills.ts")], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /3 canonical entries, 0 errors/);
  });

  it("rejects a broken discovery link and mismatched catalogs", () => {
    const root = fixture();
    const link = path.join(root, ".agents/skills/web-change-backoffice");
    rmSync(link);
    symlinkSync("../../.claude/skills/missing", link, "dir");
    rejects(root, /ENOENT|exact canonical/);
    rmSync(link);
    rejects(root, /Client catalogs differ/);
    rmSync(path.join(root, ".claude/skills/web-change-backoffice"), { recursive: true });
    rejects(root, /preserve the three backoffice skills/);
  });

  it("rejects an editable discovery copy even with identical procedure bytes", () => {
    const root = fixture();
    const discovery = path.join(root, ".agents/skills/web-change-backoffice");
    rmSync(discovery);
    put(
      path.join(discovery, "SKILL.md"),
      readFileSync(path.join(root, ".claude/skills/web-change-backoffice/SKILL.md"), "utf8"),
    );
    rejects(root, /never an editable copy/);
  });

  it("rejects absolute discovery links even when they reach the correct skill", () => {
    const root = fixture();
    const discovery = path.join(root, ".agents/skills/web-change-backoffice");
    rmSync(discovery);
    symlinkSync(path.join(root, ".claude/skills/web-change-backoffice"), discovery, "dir");
    rejects(root, /relative link/);
  });

  it("rejects missing and escaping references, including a symlink outside the repo", () => {
    for (const reference of ["missing.md", "../../../../escape.md", "outside.md", "%ZZ.md"]) {
      const root = fixture();
      if (reference === "outside.md") {
        const outside = mkdtempSync(path.join(os.tmpdir(), "bo-skill-outside-"));
        temporary.push(outside);
        put(path.join(outside, "reference.md"));
        symlinkSync(
          path.join(outside, "reference.md"),
          path.join(root, ".claude/skills/web-change-backoffice/outside.md"),
        );
      }
      edit(root, (source) => `${source}\n[reference](${reference})\n`);
      rejects(root, /reference|symlinks|URI malformed/);
    }
  });

  it("rejects an external catalog hidden behind a parent symlink", () => {
    const root = fixture();
    const outside = mkdtempSync(path.join(os.tmpdir(), "bo-skill-catalog-"));
    temporary.push(outside);
    mkdirSync(path.join(outside, "skills"));
    rmSync(path.join(root, ".claude"), { recursive: true });
    symlinkSync(outside, path.join(root, ".claude"), "dir");
    rejects(root, /real directory inside/);
  });

  it("rejects malformed, duplicate, extended and folder-mismatched frontmatter", () => {
    for (const transform of [
      (s: string) => s.replace(/^---\n/, ""),
      (s: string) => s.replace("name: web-change-backoffice", "name: web-other"),
      (s: string) =>
        s.replace(
          "name: web-change-backoffice",
          "name: web-change-backoffice\nname: web-change-backoffice",
        ),
      (s: string) =>
        s.replace(
          "name: web-change-backoffice",
          "name: web-change-backoffice\nallowed-tools: shell",
        ),
      (s: string) => s.replace(/description: .*\n/, "description: [not, a, string]\n"),
    ]) {
      const root = fixture();
      edit(root, transform);
      rejects(root, /frontmatter|Frontmatter|metadata|name differ/);
    }
  });

  it("rejects stale commands and script resources", () => {
    for (const added of ["npm run missing:script", "`node scripts/missing.ts`"]) {
      const root = fixture();
      edit(root, (source) => `${source}\n${added}\n`);
      rejects(root, /Unknown npm command|Missing or external executable/);
    }
  });

  it("rejects actual secret-like tokens, machine paths and unfinished scaffolds", () => {
    for (const added of [
      `sk-${"a".repeat(24)}`,
      `sk-proj-${"a_".repeat(24)}`,
      `ghp_${"b".repeat(24)}`,
      `github_pat_${"c".repeat(40)}`,
      `AKIA${"C".repeat(16)}`,
      "-----BEGIN " + "PRIVATE KEY-----",
      "/home/fixture/private",
      "TO" + "DO",
    ]) {
      const root = fixture();
      edit(root, (source) => `${source}\n${added}\n`);
      rejects(root, /Secret-like token|Machine-specific|Unfinished scaffold/);
    }
  });

  it("rejects resource symlinks, empty scaffolds and explicit-only selection", () => {
    const root = fixture();
    const skill = path.join(root, ".claude/skills/web-change-backoffice");
    mkdirSync(path.join(skill, "empty"));
    put(path.join(skill, "agents/openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
    symlinkSync("SKILL.md", path.join(skill, "copy.md"));
    const errors = validateSkills(root).errors.join("\n");
    assert.match(errors, /Empty scaffold/);
    assert.match(errors, /must remain enabled/);
    assert.match(errors, /must not be symlinks/);
  });
});
