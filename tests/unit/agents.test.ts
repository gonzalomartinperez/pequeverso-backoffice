import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), "utf8");
const scripts = Object.keys(
  (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts,
);

/** npm scripts named in backticked commands (`npm run x`, `npm test`). */
function backtickedScripts(markdown: string): string[] {
  const names = new Set<string>();
  for (const [, code] of markdown.matchAll(/`([^`\n]+)`/g)) {
    for (const [, name] of (code ?? "").matchAll(/\bnpm run ([a-z][\w:-]*)/g))
      names.add(name ?? "");
    if (/\bnpm test\b/.test(code ?? "")) names.add("test");
  }
  return [...names].sort();
}

/** npm scripts invoked by `run:` steps of a workflow. */
function workflowScripts(workflow: string): string[] {
  const names = new Set<string>();
  for (const [, line] of workflow.matchAll(/^\s+(?:- )?run: (.+)$/gm)) {
    for (const [, name] of (line ?? "").matchAll(/\bnpm run ([a-z][\w:-]*)/g))
      names.add(name ?? "");
    if (/\bnpm test\b/.test(line ?? "")) names.add("test");
  }
  return [...names].sort();
}

function commandsSection(markdown: string): string {
  return markdown.split(/^## Commands$/m)[1]?.split(/^## /m)[0] ?? "";
}

describe("AGENTS.md commands", () => {
  const agents = read("AGENTS.md");

  it("names only scripts that exist in package.json", () => {
    const missing = backtickedScripts(agents).filter((name) => !scripts.includes(name));
    assert.deepEqual(missing, []);
  });

  it("lists every npm script the CI workflow runs in its Commands section", () => {
    const listed = backtickedScripts(commandsSection(agents));
    const missing = workflowScripts(read(".github/workflows/ci.yml")).filter(
      (name) => !listed.includes(name),
    );
    assert.deepEqual(missing, []);
  });

  it("detects an unknown script and an unlisted CI command (negative fixtures)", () => {
    assert.deepEqual(
      backtickedScripts("Run `npm run nope` and `npm test`.").filter((n) => !scripts.includes(n)),
      ["nope"],
    );
    assert.deepEqual(workflowScripts("    steps:\n      - run: npm run lint && npm test\n"), [
      "lint",
      "test",
    ]);
    assert.equal(commandsSection("# T\n## Other\n`npm run x`\n"), "");
  });

  it("keeps CLAUDE.md as the import of AGENTS.md and the Next.js rules block verbatim", () => {
    assert.equal(read("CLAUDE.md"), "@AGENTS.md\n");
    assert.match(
      agents,
      /<!-- BEGIN:nextjs-agent-rules -->\n\n# This is NOT the Next\.js you know\n[\s\S]+<!-- END:nextjs-agent-rules -->/,
    );
    assert.ok(agents.split("\n").length <= 200, "AGENTS.md stays at most 200 lines");
  });
});
