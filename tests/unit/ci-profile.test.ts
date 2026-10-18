import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const workflowDirectory = new URL(".github/workflows/", root);
const readWorkflow = (file: string) => readFileSync(new URL(file, workflowDirectory), "utf8");
const quality = readWorkflow("quality.yml");
const core = {
  workflows: "Workflow validation",
  secrets: "Secret scan",
  static: "Static checks",
  database: "Database tests",
  container: "Container verification",
  browser: "Browser tests",
  checks: "Required checks",
};
const prerequisites = Object.keys(core).filter((id) => id !== "checks");

// Deliberately validates this workflow's bounded block shape, not arbitrary YAML.
// actionlint and zizmor remain the hosted syntax/security validators.
function jobBlocks(source: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const jobs = source.split("\njobs:\n")[1];
  assert.ok(jobs, "missing jobs mapping");
  for (const match of jobs.matchAll(
    /^ {2}([a-z][a-z0-9_-]*):\n([\s\S]*?)(?=^ {2}[a-z]|$(?![\s\S]))/gm,
  )) {
    assert.ok(!blocks.has(match[1] ?? ""), "duplicate job ID");
    blocks.set(match[1] ?? "", match[2] ?? "");
  }
  return blocks;
}

function validateCore(source: string): void {
  assert.match(source, /^name: Quality$/m);
  assert.match(source, /pull_request:\n {4}branches: \[develop, main\]/);
  assert.match(source, /push:\n {4}branches: \[develop, main\]/);
  assert.doesNotMatch(source, /continue-on-error:|^ {4}if:(?! always\(\)$)/m);
  const jobs = jobBlocks(source);
  assert.deepEqual([...jobs.keys()], Object.keys(core));
  for (const [id, name] of Object.entries(core)) {
    const block = jobs.get(id) ?? "";
    assert.match(block, new RegExp(`^    name: ${name}$`, "m"));
    const needs = block.match(/^ {4}needs: \[([^\]]*)\]$/m)?.[1];
    const expected =
      id === "checks"
        ? prerequisites
        : ["database", "container", "browser"].includes(id)
          ? ["static"]
          : [];
    assert.deepEqual(needs?.split(", ") ?? [], expected, `${id} prerequisite mismatch`);
    if (id !== "checks") {
      assert.match(block, /test "\u0024\(git rev-parse HEAD\)" = "\u0024GITHUB_SHA"/);
      assert.match(block, /PR_HEAD_SHA: \u0024{{ github.event.pull_request.head.sha }}/);
      assert.match(block, /PR_BASE_SHA: \u0024{{ github.event.pull_request.base.sha }}/);
      assert.ok(block.includes('"$GITHUB_WORKFLOW_SHA" "$GITHUB_RUN_ID"'));
    }
  }
  const checks = jobs.get("checks") ?? "";
  assert.match(checks, /^ {4}if: always\(\)$/m);
  for (const id of prerequisites) {
    assert.ok(checks.includes(`${id.toUpperCase()}_RESULT: \u0024{{ needs.${id}.result }}`));
  }
  const database = jobs.get("database") ?? "";
  assert.match(database, /run: npm run test:db/);
  assert.doesNotMatch(database, /steps\.suite|present=false|^ {8}if:/m);
}

function unquoteName(value: string): string {
  return value.replace(
    /^(?:"(.*)"|'(.*)')$/,
    (_, double: string, single: string) => double ?? single,
  );
}

function validateUniqueNames(workflows: Record<string, string>): void {
  const names = new Set<string>();
  for (const [file, source] of Object.entries(workflows)) {
    const rawName = source.match(/^name: (.+)$/m)?.[1];
    assert.ok(rawName, `${file} missing workflow name`);
    const name = unquoteName(rawName);
    assert.ok(!names.has(name), "duplicate workflow name");
    names.add(name);
    if (file !== "quality.yml") {
      for (const match of source.matchAll(/^ {4}name: (.+)$/gm)) {
        assert.ok(
          !Object.values(core).includes(unquoteName(match[1] ?? "")),
          "core status name collision",
        );
      }
    }
  }
}

const workflows = Object.fromEntries(
  readdirSync(workflowDirectory)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => [file, readWorkflow(file)]),
);
const checks = jobBlocks(quality).get("checks") ?? "";
const gate = checks
  .split("        run: |\n")[1]
  ?.split("\n")
  .map((line) => line.replace(/^ {10}/, ""))
  .join("\n");
assert.ok(gate, "missing aggregate shell gate");

function runGate(results: Record<string, string | undefined>): number | null {
  // Only the fixed aggregate shell block executes, never a PR dependency or build script.
  const env: Record<string, string> = { PATH: process.env.PATH ?? "/usr/bin:/bin" };
  for (const [key, value] of Object.entries(results)) {
    if (value !== undefined) env[key] = value;
  }
  const result = spawnSync("bash", ["--noprofile", "--norc", "-c", gate ?? "exit 1"], {
    env,
    timeout: 1000,
    encoding: "utf8",
  });
  assert.ifError(result.error);
  return result.status;
}

const success = Object.fromEntries(
  prerequisites.map((id) => [`${id.toUpperCase()}_RESULT`, "success"]),
);

describe("paired backoffice CI profile", () => {
  it("keeps seven real gates, canonical names, events and independent fixture DAG", () => {
    validateCore(quality);
    assert.match(jobBlocks(quality).get("browser") ?? "", /run: npm run test:browser/);
    assert.match(jobBlocks(quality).get("container") ?? "", /scripts\/smoke-postgres\.sh/);
  });

  it("rejects missing jobs, missing fixture dependencies, renamed contexts and optional DB coverage", () => {
    for (const candidate of [
      quality.replace("  secrets:\n", "  unexpected:\n"),
      quality.replace("    needs: [static]\n", ""),
      quality.replace("name: Container verification", "name: Production image"),
      quality.replace("run: npm run test:db", "run: echo present=false"),
      quality.replace("database, container, browser]", "database, container]"),
      quality.replace("    if: always()", "    if: success()"),
      quality.replace("needs.database.result", "needs.static.result"),
      quality.replace("    needs: [static]", "    needs: [static]\n    continue-on-error: true"),
      quality.replace("name: Browser tests", "name: Browser tests\n    if: false"),
      quality.replace('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"', "true"),
    ]) {
      assert.throws(() => validateCore(candidate));
    }
  });

  it("passes only when all six concrete prerequisite results succeeded", () => {
    assert.equal(runGate(success), 0);
    assert.notEqual(runGate({}), 0);
    for (const id of prerequisites) {
      for (const result of ["failure", "cancelled", "skipped", "pending", "", undefined]) {
        assert.notEqual(runGate({ ...success, [`${id.toUpperCase()}_RESULT`]: result }), 0);
      }
    }
  });

  it("rejects workflow and cross-workflow core status name collisions", () => {
    validateUniqueNames(workflows);
    assert.throws(() => validateUniqueNames({ ...workflows, "duplicate.yml": "name: Quality\n" }));
    assert.throws(() => validateUniqueNames({ ...workflows, "quoted.yml": 'name: "Quality"\n' }));
    for (const name of Object.values(core)) {
      assert.throws(() =>
        validateUniqueNames({
          ...workflows,
          "collision.yml": `name: Other\njobs:\n  other:\n    name: "${name}"\n`,
        }),
      );
    }
  });

  it("retains a read-only manual dependency policy with its distinct canonical name", () => {
    const policy = readWorkflow("dependency-policy.yml");
    assert.match(policy, /^name: Dependency policy$/m);
    assert.doesNotMatch(policy, /(?:contents|pull-requests): write|enable-auto-merge|gh pr merge/);
    assert.match(policy, /ref: \u0024{{ github.event.repository.default_branch }}/);
  });
});
