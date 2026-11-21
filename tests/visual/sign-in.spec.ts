import { expect, type Page, test } from "@playwright/test";

// THROWAWAY infrastructure proof (M2.7): these sign-in baselines only show that the pinned image,
// frozen clock and settled fonts give identical pixels across runs. Discarded at M5.
// Mock ops states (full, single, missing, invalid, down, telemetry-off, telemetry-invalid) are the
// `/__variant` modes of scripts/mock-ops.ts; sign-in reads no ops data, so none applies here.

async function settle(page: Page, path: string) {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00Z"));
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of ["light", "dark"] as const)
  test(`sign-in, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page, "/ingresar");
    await expect(page).toHaveScreenshot(`sign-in-${scheme}.png`, { fullPage: true });
  });

test("sign-in, refused identity", async ({ page }) => {
  await settle(page, "/ingresar?error=unable_to_create_user");
  await expect(page.getByTestId("sign-in-error")).toBeVisible();
  await expect(page).toHaveScreenshot("sign-in-error.png", { fullPage: true });
});
