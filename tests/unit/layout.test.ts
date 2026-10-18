import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { it } from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

it("discovers the real browser specifications from the canonical directory", () => {
  assert.match(read("playwright.config.ts"), /testDir: "\.\/tests\/browser"/);
  assert.deepEqual(readdirSync("tests/browser").sort(), ["backoffice.spec.ts", "live-ops.spec.ts"]);
  assert.equal(existsSync("tests/backoffice"), false);
});

it("builds both existing recipes from root with effective recipe-specific context filters", () => {
  const workflow = read(".github/workflows/quality.yml");
  assert.match(workflow, /context: \.\s+file: infra\/docker\/app\/Dockerfile/);
  assert.match(workflow, /docker build -f infra\/docker\/postgres\/Dockerfile [^\n]+ \./);
  for (const old of ["Dockerfile", "Dockerfile.postgres", ".dockerignore"])
    assert.equal(existsSync(old), false, old);

  const appFilter = read("infra/docker/app/Dockerfile.dockerignore").split("\n");
  assert.ok(appFilter.includes("*"));
  for (const denied of ["**/.env*", "**/*.pem", "**/*.key"])
    assert.ok(appFilter.includes(denied), denied);
  for (const notice of ["!LICENSE", "!NOTICE.md", "!THIRD_PARTY_NOTICES.md"])
    assert.ok(appFilter.includes(notice), notice);
  assert.match(read("infra/docker/postgres/Dockerfile.dockerignore"), /^\*\*$/m);
  assert.doesNotMatch(read("infra/docker/postgres/Dockerfile"), /^\s*(?:COPY|ADD)\s/im);
});

it("keeps manual dependency discovery attached to both moved Docker recipes", () => {
  const docker = read(".github/dependabot.yml").split("  - package-ecosystem: docker\n")[1];
  assert.ok(docker);
  assert.match(docker, /directories:\s+- \/infra\/docker\/app\s+- \/infra\/docker\/postgres/);
  assert.doesNotMatch(docker, /^\s+directory: \/\s*$/m);
});
