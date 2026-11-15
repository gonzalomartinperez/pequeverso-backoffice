import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { checkReadmeHeadings, README_HEADINGS } from "../../scripts/check-docs.ts";

const complete = README_HEADINGS.map((heading) => `## ${heading}\n\ntext`).join("\n\n");

describe("README headings check", () => {
  it("accepts every required heading in order", () => {
    assert.deepEqual(checkReadmeHeadings(`# Title\n\n${complete}\n\n## Extra`), []);
  });

  it("accepts the committed README", () => {
    const readme = readFileSync(path.resolve(import.meta.dirname, "../../README.md"), "utf8");
    assert.deepEqual(checkReadmeHeadings(readme), []);
  });

  it("reports a missing heading (negative fixture)", () => {
    const errors = checkReadmeHeadings(complete.replace("## Quality\n\ntext", ""));
    assert.deepEqual(errors, ["README heading missing: ## Quality"]);
  });

  it("reports a heading out of order", () => {
    const swapped = complete
      .replace("## Why", "## Temp")
      .replace("## Highlights", "## Why")
      .replace("## Temp", "## Highlights");
    assert.deepEqual(checkReadmeHeadings(swapped), ["README heading out of order: ## Highlights"]);
  });

  it("ignores headings inside code fences", () => {
    const fenced = complete.replace("## License\n\ntext", "```\n## License\n```");
    assert.deepEqual(checkReadmeHeadings(fenced), ["README heading missing: ## License"]);
  });
});
