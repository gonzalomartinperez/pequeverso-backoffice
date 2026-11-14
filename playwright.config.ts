import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);

/**
 * Backoffice suite: the production build with a real PostgreSQL, the real Better Auth callback
 * flow against a local fake identity provider, and SYNTHETIC ops data from the mock ops API.
 * Proves access rules, rendering and accessibility; it does not prove Google/GitHub OAuth.
 */
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // A pass on retry is flaky, not green (ecosystem 6.3). CI sets PW_FAIL_ON_FLAKY=1 on main and
  // release pull requests; elsewhere the flaky count is only reported as a warning.
  failOnFlakyTests: process.env.PW_FAIL_ON_FLAKY === "1",
  reporter: ci
    ? [
        ["list"],
        ["html", { open: "never" }],
        ["json", { outputFile: "playwright-json/results.json" }],
      ]
    : [["list"]],
  use: {
    baseURL: "http://localhost:3241",
    // No traces in CI: they would capture the disposable test sessions' cookies.
    trace: ci ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // `npm run test:browser:pr` runs chromium + mobile-webkit; the default run (push, merge queue,
  // nightly) runs every project. Each depends on `setup`, which stores the owner and viewer sessions.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15"] },
      grep: /@mobile/,
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: "node scripts/backoffice-stack.ts",
    url: "http://localhost:3241/healthz",
    reuseExistingServer: false,
    timeout: 90_000,
    // Let the fixture parent close children and remove its database/role before forced teardown.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
