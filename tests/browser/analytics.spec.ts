import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const enabled = process.env.PRODUCT_ANALYTICS_READ_ENABLED === "true";
const reportPath =
  "/panel/analitica?period=day&offset=0&route=%2F&section_id=hero&viewport_bucket=all&locale=es";
async function owner(page: Page) {
  await fetch("http://127.0.0.1:8238/__identity", {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.test", sub: "owner", email_verified: true }),
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Continuar con Proveedor de prueba" }).click();
  await page.waitForURL(/\/panel$/);
}
test("analytics refuses an anonymous reader @mobile", async ({ page }) => {
  await page.goto(reportPath);
  await expect(page).toHaveURL(/\/ingresar/);
  await expect(
    page.getByRole("heading", { name: "Actividad del sitio · prueba local" }),
  ).toHaveCount(0);
});
test("analytics stays honestly disabled by default @mobile", async ({ page }) => {
  test.skip(
    enabled,
    "Separate enabled fixture lease; this case verifies the default OFF configuration.",
  );
  await owner(page);
  const response = await page.goto(reportPath);
  await expect(page.getByRole("status")).toContainText("desactivada");
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(response?.headers()["cache-control"]).toContain("no-store");
});
test("real fixture API aggregates render accessible counts and filters @mobile", async ({
  page,
}) => {
  test.skip(
    !enabled || !process.env.LIVE_OPS_URL,
    "Requires an explicitly leased real fixture API/PG and opt-in harness dataset; mock ops is insufficient.",
  );
  await owner(page);
  await page.goto(reportPath);
  await expect(
    page.getByRole("heading", { name: "Actividad del sitio · prueba local" }),
  ).toBeVisible();
  await expect(page.getByText("Datos sintéticos.", { exact: false })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Eventos por grupo de país" })).toContainText("9");
  await expect(page.getByRole("region", { name: "Eventos por día" })).toContainText("2");
  await page.getByLabel("Página", { exact: true }).selectOption("/grafismo-fonetico/");
  await expect(page.getByLabel("Sección", { exact: true })).toHaveValue("all");
  // Changing a native form control does not request another report until submission.
  await expect(page).toHaveURL(/section_id=hero/);
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(page).toHaveURL(/section_id=all/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((row) => row.id)).toEqual([]);
});
