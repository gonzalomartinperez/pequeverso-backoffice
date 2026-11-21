import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression (M2.7). Run only through `scripts/visual.sh`, which starts the production
 * stack on the host and runs this config inside the pinned Playwright image: baselines are valid
 * only when rendered there (fonts and rasterisation), never on a developer machine.
 * The sign-in baselines are THROWAWAY infrastructure proof (pinned image, frozen clock,
 * determinism at 0.002); they are discarded at M5 and are not a long-lived contract.
 */
export default defineConfig({
  testDir: "./tests/visual",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: "http://localhost:3241",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "es-ES",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "visual" }],
});
