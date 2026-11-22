import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { it } from "node:test";

// M4.3 ratchet: the compiler flags of the typing policy (target-state section 5) stay on, and the
// Next.js generated route types stay in the program so `typedRoutes` is actually enforced.
const root = path.resolve(import.meta.dirname, "../..");
const tsconfig = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8")) as {
  compilerOptions: Record<string, unknown>;
  include: string[];
  exclude: string[];
};

it("keeps the strict typing flags on", () => {
  for (const flag of [
    "strict",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "verbatimModuleSyntax",
    "erasableSyntaxOnly",
    "noImplicitOverride",
    "noImplicitReturns",
    "noFallthroughCasesInSwitch",
    "useUnknownInCatchVariables",
  ])
    assert.equal(tsconfig.compilerOptions[flag], true, flag);
  assert.equal(tsconfig.compilerOptions.allowJs, false);
  assert.deepEqual(tsconfig.compilerOptions.types, ["node"]);
});

it("enables typed routes and keeps the generated route types in the program", () => {
  assert.match(readFileSync(path.join(root, "next.config.ts"), "utf8"), /^\s*typedRoutes: true,$/m);
  assert.ok(tsconfig.include.includes(".next/types/**/*.ts"));
  // Excluding `.next` as a whole silently drops .next/types/link.d.ts, and with it typed links.
  assert.ok(!tsconfig.exclude.includes(".next"), "exclude only build outputs under .next");
  for (const pattern of tsconfig.exclude)
    for (const file of [".next/types/link.d.ts", ".next/types/validator.ts"])
      assert.ok(
        !path.matchesGlob(file, pattern) && !path.matchesGlob(file, `${pattern}/**`),
        pattern,
      );
});
