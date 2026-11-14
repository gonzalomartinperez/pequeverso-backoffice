import { expect, test } from "@playwright/test";
import { prepare, VIEWER_STATE } from "./support.ts";

// The stored viewer session (invited by the owner in auth.setup.ts): read-only by role.
test.use({ storageState: VIEWER_STATE });

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("a stored viewer session reads the panel but cannot reach access management", async ({
  page,
}) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByTestId("actor")).toContainText("· lectura");
  await expect(
    page.getByRole("navigation", { name: "Backoffice" }).getByRole("link", { name: "Accesos" }),
  ).toHaveCount(0);
  await page.goto("/panel/accesos");
  await expect(page).toHaveURL(/\/panel$/);
});
