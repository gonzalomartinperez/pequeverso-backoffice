import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const workflowDirectory = new URL(".github/workflows/", root);
const readWorkflow = (file: string) => readFileSync(new URL(file, workflowDirectory), "utf8");
const ci = readWorkflow("ci.yml");

type Profile = { paths?: string[]; adds?: string[] };
type ProfileMap = { base: string[]; profiles: Record<string, Profile>; required: string };
const profileMap = JSON.parse(
  readFileSync(new URL(".github/ci-profile.json", root), "utf8"),
) as ProfileMap;

// Same glob semantics as the engineering-standards classify workflow (`**/`, `**`, `*`, `?`).
function globToRegex(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; ) {
    if (pattern.startsWith("**/", i)) {
      out += "(?:.*/)?";
      i += 3;
    } else if (pattern.startsWith("**", i)) {
      out += ".*";
      i += 2;
    } else if (pattern[i] === "*") {
      out += "[^/]*";
      i += 1;
    } else if (pattern[i] === "?") {
      out += "[^/]";
      i += 1;
    } else {
      out += (pattern[i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

function profilesOf(path: string, map: ProfileMap = profileMap): string[] {
  return Object.entries(map.profiles)
    .filter(([, spec]) => spec.paths?.some((pattern) => globToRegex(pattern).test(path)))
    .map(([name]) => name);
}

// Deliberately validates this workflow's bounded block shape, not arbitrary YAML.
// actionlint and zizmor (security job) remain the hosted syntax and security validators.
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

const STANDARDS = /gonzalomartinperez\/engineering-standards\/[^@\s]+@[0-9a-f]{40} # v1\.\d+\.\d+/;

function validateCi(source: string, map: ProfileMap = profileMap): void {
  assert.match(source, /^name: CI$/m);
  assert.match(source, /^permissions: \{\}$/m);
  assert.match(source, /pull_request:\n {4}branches: \[develop, main\]/);
  assert.match(source, /push:\n {4}branches: \[develop, main\]/);
  assert.doesNotMatch(source, /continue-on-error:|pull_request_target/);
  const jobs = jobBlocks(source);
  const classify = jobs.get("classify") ?? "";
  assert.match(
    classify,
    new RegExp(
      `uses: ${STANDARDS.source.replace("[^@\\s]+", "\\.github/workflows/classify\\.yml")}`,
    ),
  );

  const named = new Set([...map.base, ...Object.values(map.profiles).flatMap((p) => p.adds ?? [])]);
  const gated = [...jobs.keys()].filter((id) => !["classify", "ci-gate", "checks"].includes(id));
  assert.deepEqual([...named].sort(), [...gated].sort(), "profile job names equal gated job ids");
  for (const id of gated) {
    const block = jobs.get(id) ?? "";
    assert.ok(
      block.includes(`if: contains(fromJSON(needs.classify.outputs.jobs), '${id}')`),
      `${id} is not gated on classify`,
    );
    assert.match(block, /^ {4}needs: \[classify(?:, [a-z-]+)*\]$/m, `${id} must need classify`);
    if (!block.includes("uses: "))
      assert.match(block, /^ {4}timeout-minutes: \d+$/m, `${id} timeout`);
  }

  const gate = jobs.get("ci-gate") ?? "";
  assert.equal(map.required, "ci-gate");
  assert.match(gate, /^ {4}name: ci-gate$/m);
  assert.match(gate, /^ {4}if: always\(\)$/m);
  const needs = gate.match(/^ {4}needs: \[([^\]]*)\]$/m)?.[1]?.split(", ") ?? [];
  assert.deepEqual(needs.sort(), ["classify", ...gated].sort(), "ci-gate must need every job");
  assert.match(
    gate,
    new RegExp(`uses: ${STANDARDS.source.replace("[^@\\s]+", "actions/ci-gate")}`),
  );
  assert.match(gate, /needs: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(gate, /expected: \$\{\{ needs\.classify\.outputs\.jobs \}\}/);

  const alias = jobs.get("checks") ?? "";
  assert.match(alias, /^ {4}name: Required checks$/m);
  assert.match(alias, /^ {4}if: always\(\)$/m);
  assert.match(alias, /^ {4}needs: \[ci-gate\]$/m);
}

function aliasScript(source: string): string {
  const script = (jobBlocks(source).get("checks") ?? "").split("        run: ")[1]?.split("\n")[0];
  assert.ok(script, "missing alias gate command");
  return script;
}

function runAlias(result: string | undefined): number | null {
  // Only the fixed alias command executes, never a PR dependency or build script.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "/usr/bin:/bin" };
  if (result !== undefined) env.GATE_RESULT = result;
  const run = spawnSync("bash", ["--noprofile", "--norc", "-c", aliasScript(ci)], {
    env,
    timeout: 1000,
    encoding: "utf8",
  });
  assert.ifError(run.error);
  return run.status;
}

function unquoteName(value: string): string {
  return value.replace(/^(?:"(.*)"|'(.*)')$/, (_, d: string, s: string) => d ?? s);
}

const reserved = ["ci-gate", "Required checks"];
function validateUniqueNames(workflows: Record<string, string>): void {
  const names = new Set<string>();
  for (const [file, source] of Object.entries(workflows)) {
    const rawName = source.match(/^name: (.+)$/m)?.[1];
    assert.ok(rawName, `${file} missing workflow name`);
    const name = unquoteName(rawName);
    assert.ok(!names.has(name), "duplicate workflow name");
    names.add(name);
    if (file !== "ci.yml")
      for (const match of source.matchAll(/^ {4}name: (.+)$/gm))
        assert.ok(
          !reserved.includes(unquoteName(match[1] ?? "")),
          "required status name collision",
        );
  }
}

const workflows = Object.fromEntries(
  readdirSync(workflowDirectory)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => [file, readWorkflow(file)]),
);

describe("dynamic CI profile", () => {
  it("places every tracked file in at least one profile (no silent fail-closed full runs)", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    const uncovered = files.filter((file) => profilesOf(file).length === 0);
    assert.deepEqual(uncovered, []);
  });

  it("routes representative files to the expected profiles", () => {
    assert.deepEqual(profilesOf("docs/ci.md"), ["docs"]);
    assert.deepEqual(profilesOf("README.md"), ["docs"]);
    assert.ok(profilesOf("src/server/auth.ts").includes("database"));
    assert.ok(profilesOf("src/server/auth.ts").includes("container"));
    assert.deepEqual(profilesOf("src/features/operations/presentation/dashboard.tsx"), ["code"]);
    assert.deepEqual(profilesOf("infra/docker/app/Dockerfile"), ["container"]);
    assert.ok(profilesOf("migrations/0001_init.sql").includes("database"));
    assert.deepEqual(profilesOf("contracts/ops/source.json"), ["contract"]);
    assert.ok(profilesOf(".github/workflows/ci.yml").includes("workflow"));
    assert.deepEqual(profilesOf("unknown/file.bin"), []);
  });

  it("runs the coverage gate (database job) for every code change", () => {
    const jobsFor = (file: string) => [
      ...new Set([
        ...profileMap.base,
        ...profilesOf(file).flatMap((name) => profileMap.profiles[name]?.adds ?? []),
      ]),
    ];
    for (const file of [
      "src/shared/lib/format.ts",
      "tests/unit/access.test.ts",
      "scripts/check-coverage.ts",
      "quality/ratchets/coverage.json",
    ])
      assert.ok(jobsFor(file).includes("database"), `${file} must trigger the database job`);
    assert.equal(jobsFor("docs/ci.md").includes("database"), false);
    assert.match(jobBlocks(ci).get("database") ?? "", /node scripts\/diff-coverage\.ts/);
  });

  it("keeps the docs fast path free of build, browser, database and container jobs", () => {
    const docs = profileMap.profiles.docs?.adds ?? [];
    for (const heavy of ["static", "build", "browser", "database", "container"])
      assert.ok(!docs.includes(heavy), heavy);
    assert.ok(profileMap.base.includes("secrets"), "secret scan runs on every PR");
    assert.ok(
      profileMap.base.includes("security"),
      "workflow and dependency checks run on every PR",
    );
  });

  it("gates every job on classify, aggregates all of them in ci-gate and pins the standards", () => {
    validateCi(ci);
    assert.match(jobBlocks(ci).get("database") ?? "", /run: npm run coverage/);
    assert.match(jobBlocks(ci).get("browser") ?? "", /npm run test:browser/);
    assert.match(jobBlocks(ci).get("browser") ?? "", /^ {4}needs: \[classify, build\]$/m);
    assert.match(jobBlocks(ci).get("container") ?? "", /scripts\/smoke-postgres\.sh/);
  });

  it("rejects ungated jobs, missing gate needs, renamed contexts and unpinned standards", () => {
    for (const candidate of [
      ci.replace("    needs: [classify, security, ", "    needs: [classify, "),
      ci.replace("if: contains(fromJSON(needs.classify.outputs.jobs), 'database')", "if: true"),
      ci.replace("    name: ci-gate", "    name: gate"),
      ci.replace("    name: Required checks", "    name: Checks"),
      ci.replace(/classify\.yml@[0-9a-f]{40}/, "classify.yml@main"),
      ci.replace("    if: always()\n    needs: [classify", "    needs: [classify"),
      ci.replace(
        "    needs: [classify]\n    if: contains(fromJSON(needs.classify.outputs.jobs), 'static')",
        "    needs: [classify]\n    if: contains(fromJSON(needs.classify.outputs.jobs), 'static')\n    continue-on-error: true",
      ),
    ]) {
      assert.notEqual(candidate, ci, "mutation must change the workflow");
      assert.throws(() => validateCi(candidate));
    }
    const extraJob: ProfileMap = {
      ...profileMap,
      profiles: { ...profileMap.profiles, extra: { paths: ["x/**"], adds: ["lighthouse"] } },
    };
    assert.throws(() => validateCi(ci, extraJob));
  });

  it("keeps the Required checks alias green only when ci-gate succeeded", () => {
    assert.equal(runAlias("success"), 0);
    for (const result of ["failure", "cancelled", "skipped", "", undefined])
      assert.notEqual(runAlias(result), 0);
  });

  it("rejects workflow name and required status name collisions", () => {
    validateUniqueNames(workflows);
    assert.throws(() => validateUniqueNames({ ...workflows, "duplicate.yml": "name: CI\n" }));
    for (const name of reserved)
      assert.throws(() =>
        validateUniqueNames({
          ...workflows,
          "collision.yml": `name: Other\njobs:\n  other:\n    name: "${name}"\n`,
        }),
      );
  });

  it("retains a read-only manual dependency policy with its distinct canonical name", () => {
    const policy = readWorkflow("dependency-policy.yml");
    assert.match(policy, /^name: Dependency policy$/m);
    assert.doesNotMatch(policy, /(?:contents|pull-requests): write|enable-auto-merge|gh pr merge/);
    assert.match(policy, /ref: \u0024{{ github.event.repository.default_branch }}/);
  });
});

describe("Node LTS trial", () => {
  const trial = readWorkflow("node-matrix.yml");
  it("stays advisory, read-only and pinned to the .nvmrc patch for Node 24", () => {
    assert.match(trial, /^permissions: \{\}$/m);
    assert.match(trial, /persist-credentials: false/);
    assert.doesNotMatch(trial, /pull_request_target|schedule:|(?:contents|pull-requests): write/);
    const nvmrc = readFileSync(new URL(".nvmrc", root), "utf8").trim();
    assert.match(trial, new RegExp(`node: \\["${nvmrc.replaceAll(".", "\\.")}", "26"\\]`));
    assert.doesNotMatch(jobBlocks(ci).get("ci-gate") ?? "", /\bnode\b/);
  });
});
