// Merged coverage: runs the unit and integration suites under one NODE_V8_COVERAGE directory, then
// asks c8 for the lcov and json-summary of src/**. Needs DATABASE_URL (integration suite).
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

if (!process.env.DATABASE_URL) {
  console.error(
    "coverage: DATABASE_URL is required (the integration suite runs against PostgreSQL).",
  );
  process.exit(1);
}
const tmp = ".coverage-tmp";
rmSync(tmp, { recursive: true, force: true });
rmSync("coverage", { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const env = { ...process.env, NODE_V8_COVERAGE: tmp };
const run = (command: string, args: string[], withCoverage: boolean) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: withCoverage ? env : process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("node", ["scripts/db-check.ts"], false);
run("node", ["--test", "tests/unit/**/*.test.ts"], true);
run("node", ["--test", "tests/integration/**/*.test.ts"], true);
run(
  "npx",
  [
    "c8",
    "report",
    `--temp-directory=${tmp}`,
    "--reports-dir=coverage",
    "--all",
    "--src=src",
    "--include=src/**/*.ts",
    "--extension=.ts",
    "--reporter=lcovonly",
    "--reporter=json-summary",
    "--reporter=text-summary",
  ],
  false,
);
rmSync(tmp, { recursive: true, force: true });
