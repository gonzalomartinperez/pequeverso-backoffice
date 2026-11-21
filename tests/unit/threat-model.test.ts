import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "@typescript/typescript6";

const root = path.resolve(import.meta.dirname, "../..");
const threatModel = "docs/explanation/threat-model.md";

function declaredTestNames(file: string, source: string): Set<string> {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const name = node.arguments[0];
      if (
        (callee === "test" || callee === "it" || callee === "describe") &&
        name &&
        ts.isStringLiteralLike(name)
      ) {
        names.add(name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(ast);
  return names;
}

describe(threatModel, () => {
  it("cites at least ten existing tests by their exact names", () => {
    const markdown = readFileSync(path.join(root, threatModel), "utf8");
    const citations = Array.from(markdown.matchAll(/`([^`\r\n]+)` › `([^`\r\n]+)`/g), (match) => ({
      file: match[1] ?? "",
      name: match[2] ?? "",
    }));
    assert.ok(citations.length >= 10, `Expected at least 10 citations, found ${citations.length}`);

    for (const [file, references] of Map.groupBy(citations, (citation) => citation.file)) {
      const absolute = path.resolve(root, file);
      assert.ok(existsSync(absolute), `Missing cited test file: ${file}`);
      const names = declaredTestNames(file, readFileSync(absolute, "utf8"));
      for (const { name } of references) {
        assert.ok(names.has(name), `Missing cited test name: ${file} › ${name}`);
      }
    }
  });

  it("rejects a missing literal name in an inline fixture", () => {
    const source = [
      'describe("a suite", () => {',
      "  it('missing name suffix', () => {});",
      "  test(`a template literal`, () => {});",
      '  // test("missing name", () => {});',
      '  const label = "missing name";',
      "  test(label, () => {});",
      "});",
    ].join("\n");

    const names = declaredTestNames("fixture.test.ts", source);
    assert.deepEqual(names, new Set(["a suite", "missing name suffix", "a template literal"]));
    assert.ok(!names.has("missing name"));
  });
});
