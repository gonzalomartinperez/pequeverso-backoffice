import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "@typescript/typescript6";
import { ENV_DOC, renderEnv } from "../../scripts/generate-env.ts";
import { ENVIRONMENT_VARIABLES } from "../../src/server/environment-variables.ts";

const root = path.resolve(import.meta.dirname, "../..");

function environmentReads(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      const receiver = node.expression.getText(source);
      if (receiver === "env" || receiver === "process.env") names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...names].sort();
}

describe("docs/reference/env.md", () => {
  it("is up to date with the configuration descriptions (run: node scripts/generate-env.ts)", () => {
    assert.equal(readFileSync(path.join(root, ENV_DOC), "utf8"), renderEnv());
  });

  it("describes exactly the variables read by the main and delegated parsers", () => {
    const runtime = ENVIRONMENT_VARIABLES.runtime.map(([name]) => name);
    const observability = ENVIRONMENT_VARIABLES.observability.map(([name]) => name);
    assert.deepEqual(runtime.sort(), environmentReads("src/server/env-parse.ts"));
    assert.deepEqual(
      [...observability, "BACKOFFICE_ENVIRONMENT", "OPS_READ_TOKEN"].sort(),
      environmentReads("src/server/observability-config.ts"),
    );
  });

  it("describes every variable in .env.example, including commented settings", () => {
    const names = Object.values(ENVIRONMENT_VARIABLES)
      .flat()
      .map(([name]) => name);
    const documented = new Set<string>(names);
    assert.equal(documented.size, names.length, "duplicate variable descriptions");
    const example = readFileSync(path.join(root, ".env.example"), "utf8");
    const assignments = /^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm;
    for (const [, name] of example.matchAll(assignments)) {
      assert.ok(name && documented.has(name), `Missing description for ${name}`);
    }
  });
});
