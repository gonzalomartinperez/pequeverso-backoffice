import { expect, test } from "@playwright/test";
import { axe, cspViolations, OWNER_STATE, openPanel, prepare, SHOTS, variant } from "./support.ts";

// Signed in once by auth.setup.ts through the fake IdP; no per-test OAuth round trip.
test.use({ storageState: OWNER_STATE });

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("technical observation stays honest, accessible and separate from provider availability @mobile", async ({
  page,
}, info) => {
  await openPanel(page);
  await page.getByText("Diagnóstico técnico y configuración", { exact: true }).click();
  const technical = page.getByRole("region", { name: "Estado técnico" });
  const fixtureNotice = technical.getByTestId("telemetry-fixture-banner");
  await expect(fixtureNotice).toContainText("Proveedor de prueba (fixture)");
  await expect(fixtureNotice).toContainText("La muestra informa HTTP y recursos del proceso");
  await expect(fixtureNotice).toContainText(
    "no acredita disponibilidad de OpenAI ni calidad del modelo",
  );
  await expect(technical).toContainText("API preparada");
  await expect(technical).toContainText("Proveedor: sin comprobar");
  await expect(technical).toContainText("0 / 4 ejecuciones activas");
  await technical.locator("summary").click();
  await expect(technical.getByText("Memoria RSS del proceso").locator("..")).toContainText(
    "No disponible",
  );
  await expect(technical).toContainText("no incluyen fallos SSE enviados dentro de HTTP 200");
  await axe(page);
  expect(await cspViolations(page)).toEqual([]);
  const html = await page.content();
  expect(html).not.toContain("test-observability-token-separate");
  expect(html).not.toContain("test-ops-read-token");
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-telemetry-detail.png`, fullPage: true });
});

test("disabled or invalid optional telemetry preserves valid legacy spend and runs", async ({
  page,
}) => {
  await openPanel(page);
  for (const name of ["telemetry-off", "telemetry-invalid"]) {
    await variant(name);
    await page.goto("/panel");
    await page.getByText("Diagnóstico técnico y configuración", { exact: true }).click();
    const technical = page.getByRole("region", { name: "Estado técnico" });
    await expect(technical).toContainText("No disponible");
    await expect(page.getByRole("heading", { name: "Presupuesto de 2026-10" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Solicitudes · Últimas 24 horas" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Gasto del mes y del día" })).toContainText(
      "US$ 0,4123",
    );
  }
});

test("private machine metrics require a separate bearer and expose no credentials", async ({
  request,
}) => {
  const path = "/internal/v1/ops/metrics";
  expect((await request.get(path)).status()).toBe(401);
  expect((await request.get(path, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(
    401,
  );
  const response = await request.get(path, {
    headers: { Authorization: "Bearer test-observability-token-separate-000000000000" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const metrics = await response.text();
  expect(metrics).toContain("pequeverso_backoffice_operation_total");
  expect(metrics).toContain("pequeverso_backoffice_process_resident_memory_bytes");
  expect(metrics).not.toMatch(
    /owner@example|test-ops-read-token|test-observability-token|invitacion|8237/,
  );
});
