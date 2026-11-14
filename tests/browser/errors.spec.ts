import { expect, test } from "@playwright/test";
import { axe, prepare, SHOTS, signIn, variant } from "./support.ts";

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("missing data is shown as not available, never as zero", async ({ page }, info) => {
  await variant("missing");
  await signIn(page, "owner@example.test", "owner");
  await expect(page.getByText("No acepta preguntas")).toBeVisible();
  await expect(page.getByText("Sin catálogo válido")).toBeVisible();
  await expect(
    page.getByText(/No disponible: la API no informó el estado del presupuesto/),
  ).toBeVisible();
  await expect(page.getByText(/No disponible: todavía no hay días con registros/)).toBeVisible();
  await axe(page);
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-missing-data.png`, fullPage: true });
});

test("an unreachable or rejecting API is reported without numbers", async ({ page }, info) => {
  await variant("down");
  await signIn(page, "owner@example.test", "owner");
  const alert = page.getByRole("alert").filter({ hasText: "Métricas no disponibles" });
  await expect(alert).toContainText("rechazó la lectura");
  await expect(page.getByTestId("synthetic-banner")).toHaveCount(0);
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-unavailable.png`, fullPage: true });
});
