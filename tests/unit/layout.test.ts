import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { it } from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

it("discovers the real browser specifications from the canonical directory", () => {
  assert.match(read("playwright.config.ts"), /testDir: "\.\/tests\/browser"/);
  assert.deepEqual(readdirSync("tests/browser").sort(), [
    "analytics.spec.ts",
    "backoffice.spec.ts",
    "live-ops.spec.ts",
  ]);
  assert.equal(existsSync("tests/backoffice"), false);
});

it("builds both existing recipes from root with effective recipe-specific context filters", () => {
  const workflow = read(".github/workflows/quality.yml");
  assert.match(
    workflow,
    /uses: docker\/bake-action@[0-9a-f]{40} # v\S+\n(?: {8}.*\n)*? {8}with:\s+source: \.\s+files: docker-bake\.hcl/,
  );
  const bake = read("docker-bake.hcl");
  assert.match(bake, /context\s+= "\."/);
  assert.match(bake, /target "app" \{[^}]*dockerfile = "infra\/docker\/app\/Dockerfile"/);
  assert.match(bake, /target "postgres" \{[^}]*dockerfile = "infra\/docker\/postgres\/Dockerfile"/);
  assert.match(bake, /group "default" \{\s+targets = \["app", "postgres"\]/);
  const settings = bake.replace(/^\s*#.*$/gm, "");
  assert.doesNotMatch(settings, /\bpush\s*=\s*true|output\s*=\s*\[[^\]]*(?:registry|push=true)/);
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

it("stamps revision and version into both images and keeps install scripts off", () => {
  const app = read("infra/docker/app/Dockerfile");
  const runtime = app.split(/ AS runtime\n/)[1] ?? "";
  for (const arg of ["SERVICE_REVISION", "VERSION"]) {
    assert.match(runtime, new RegExp(`^ARG ${arg}=`, "m"), `runtime ARG ${arg}`);
    assert.ok(
      runtime.includes(
        `org.opencontainers.image.${arg === "VERSION" ? "version" : "revision"}="\${${arg}}"`,
      ),
    );
  }
  assert.match(runtime, /^ENV SERVICE_REVISION=\$\{SERVICE_REVISION\} VERSION=\$\{VERSION\}$/m);
  assert.match(app, /npm ci --ignore-scripts /);

  const postgres = read("infra/docker/postgres/Dockerfile");
  assert.match(postgres, /^HEALTHCHECK [^\n]*\\\n\s+CMD \["sh", "-c", "pg_isready /m);
  assert.match(postgres, /org\.opencontainers\.image\.revision="\$\{SERVICE_REVISION\}"/);
  const lock = JSON.parse(read("package-lock.json")) as {
    packages: Record<string, { hasInstallScript?: boolean }>;
  };
  const scripted = Object.entries(lock.packages).filter(([, meta]) => meta.hasInstallScript);
  assert.deepEqual(
    scripted,
    [],
    "a dependency now needs an install script; review --ignore-scripts",
  );
});
