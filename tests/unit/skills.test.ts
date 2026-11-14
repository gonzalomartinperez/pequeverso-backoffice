import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { validateSkills } from "../../scripts/check-skills.ts";

const repository = path.resolve(import.meta.dirname, "../..");
const names = [
  "implement-task",
  "resume-refactor",
  "review-change",
  "score-repo",
  "update-dependencies",
  "verify-release",
  "write-adr",
];
const first = "implement-task";
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
  mkdirSync(path.join(root, ".claude/skills"), { recursive: true });
  for (const name of names) {
    cpSync(path.join(repository, ".agents/skills", name), path.join(root, ".agents/skills", name), {
      recursive: true,
    });
    symlinkSync(`../../.agents/skills/${name}`, path.join(root, ".claude/skills", name), "dir");
  }
  // Only reference existence matters here; these fixtures never execute a procedure.
  for (const name of names) {
    const entry = path.join(root, ".agents/skills", name, "SKILL.md");
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
  const file = path.join(root, `.agents/skills/${first}/SKILL.md`);
  writeFileSync(file, transform(readFileSync(file, "utf8")));
}

function rejects(root: string, pattern: RegExp): void {
  assert.match(validateSkills(root).errors.join("\n"), pattern);
}

describe("canonical backoffice skill discovery", () => {
  it("resolves both clients to the same seven procedures from any working directory", () => {
    assert.deepEqual(validateSkills(repository), { names, errors: [] });
    assert.deepEqual(validateSkills(fixture()), { names, errors: [] });
    const cli = spawnSync(process.execPath, [path.join(repository, "scripts/check-skills.ts")], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /7 canonical entries, 0 errors/);
  });

  it("rejects a broken discovery link and mismatched catalogs", () => {
    const root = fixture();
    const link = path.join(root, `.claude/skills/${first}`);
    rmSync(link);
    symlinkSync("../../.agents/skills/missing", link, "dir");
    rejects(root, /ENOENT|exact canonical/);
    rmSync(link);
    rejects(root, /Client catalogs differ/);
    rmSync(path.join(root, `.agents/skills/${first}`), { recursive: true });
    rejects(root, /standard seven-skill catalog/);
  });

  it("rejects the previous layout direction with canonical files under .claude", () => {
    const root = fixture();
    for (const name of names) {
      const canonical = path.join(root, ".agents/skills", name);
      const discovery = path.join(root, ".claude/skills", name);
      const source = readFileSync(path.join(canonical, "SKILL.md"), "utf8");
      rmSync(discovery);
      rmSync(canonical, { recursive: true });
      put(path.join(discovery, "SKILL.md"), source);
      symlinkSync(`../../.claude/skills/${name}`, canonical, "dir");
    }
    const errors = validateSkills(root).errors.join("\n");
    assert.match(errors, /real directory\/file/);
    assert.match(errors, /never an editable copy/);
  });

  it("rejects an editable discovery copy even with identical procedure bytes", () => {
    const root = fixture();
    const discovery = path.join(root, `.claude/skills/${first}`);
    rmSync(discovery);
    put(
      path.join(discovery, "SKILL.md"),
      readFileSync(path.join(root, `.agents/skills/${first}/SKILL.md`), "utf8"),
    );
    rejects(root, /never an editable copy/);
  });

  it("rejects absolute discovery links even when they reach the correct skill", () => {
    const root = fixture();
    const discovery = path.join(root, `.claude/skills/${first}`);
    rmSync(discovery);
    symlinkSync(path.join(root, `.agents/skills/${first}`), discovery, "dir");
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
          path.join(root, `.agents/skills/${first}/outside.md`),
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
      (s: string) => s.replace("name: implement-task", "name: other-task"),
      (s: string) => s.replace("name: implement-task", `name: ${first}\nname: ${first}`),
      (s: string) => s.replace("name: implement-task", `name: ${first}\nlicense: MIT`),
      (s: string) => s.replace("allowed-tools:", "allowed-tools: Read\nallowed-tools:"),
      (s: string) => s.replace(/description: .*\n/, "description: [not, a, string]\n"),
      (s: string) => s.replace("  owner: gonzalomartinperez\n", "  owner: a\n  owner: b\n"),
      (s: string) => s.replace("  owner: gonzalomartinperez\n", "  owner: a\n  extra: b\n"),
    ]) {
      const root = fixture();
      edit(root, transform);
      rejects(root, /frontmatter|Frontmatter|metadata|Metadata|name differ|Invalid skill name/);
    }
  });

  it("rejects missing metadata, bad review dates and descriptions without triggers", () => {
    for (const transform of [
      (s: string) => s.replace(/metadata:\n(?: {2}.*\n)+/, ""),
      (s: string) => s.replace(/last-reviewed: .*\n/, 'last-reviewed: "yesterday"\n'),
      (s: string) => s.replace(/last-reviewed: .*\n/, 'last-reviewed: "2026-02-31"\n'),
      (s: string) => s.replace(/ {2}version: .*\n/, ""),
      (s: string) => s.replace("Use when", "Run when"),
      (s: string) => s.replace(/Not for/g, "Skip for"),
    ]) {
      const root = fixture();
      edit(root, transform);
      rejects(root, /Metadata requires|Frontmatter allows|Description must contain/);
    }
  });

  it("rejects parameterised, unknown or network tools in allowed-tools", () => {
    for (const tools of ["Read, Bash(*)", "Read, WebFetch", "Read, Grep, mcp__x"]) {
      const root = fixture();
      edit(root, (source) => source.replace(/^allowed-tools: .*$/m, `allowed-tools: ${tools}`));
      rejects(root, /allowed-tools may only list/);
    }
  });

  it("rejects a procedure body over 120 lines and descriptions over 1024 characters", () => {
    const root = fixture();
    edit(root, (source) => `${source}${"filler line\n".repeat(121)}`);
    rejects(root, /exceeds 120 lines/);
    const long = fixture();
    edit(long, (source) => source.replace(/description: "/, `description: "${"x".repeat(1100)} `));
    rejects(long, /40–1024/);
  });

  it("rejects missing or weak activation and output evals", () => {
    const eval_ = (root: string, file: string) =>
      path.join(root, `.agents/skills/${first}/evals/${file}`);
    const missing = fixture();
    rmSync(eval_(missing, "triggers.json"));
    rejects(missing, /triggers\.json/);
    const few = fixture();
    writeFileSync(
      eval_(few, "triggers.json"),
      JSON.stringify({ queries: [{ query: "q", should_trigger: true, split: "train" }] }),
    );
    rejects(few, /at least 10/);
    const skewed = fixture();
    const queries = Array.from({ length: 12 }, (_, index) => ({
      query: `q${index}`,
      should_trigger: index < 6,
      split: "train",
    }));
    writeFileSync(eval_(skewed, "triggers.json"), JSON.stringify({ queries }));
    rejects(skewed, /Validation share/);
    const bare = fixture();
    writeFileSync(
      eval_(bare, "evals.json"),
      JSON.stringify({ evals: [{ prompt: "p", assertions: [] }, {}, {}] }),
    );
    rejects(bare, /prompt and non-empty/);
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
    const skill = path.join(root, `.agents/skills/${first}`);
    mkdirSync(path.join(skill, "empty"));
    put(path.join(skill, "agents/openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
    symlinkSync("SKILL.md", path.join(skill, "copy.md"));
    const errors = validateSkills(root).errors.join("\n");
    assert.match(errors, /Empty scaffold/);
    assert.match(errors, /must remain enabled/);
    assert.match(errors, /must not be symlinks/);
  });
});
