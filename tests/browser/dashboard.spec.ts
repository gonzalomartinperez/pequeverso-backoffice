import { expect, test } from "@playwright/test";
import { axe, cspViolations, OWNER_STATE, openPanel, prepare, SHOTS, variant } from "./support.ts";

// Signed in once by auth.setup.ts through the fake IdP; no per-test OAuth round trip.
test.use({ storageState: OWNER_STATE });

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("owner dashboard shows labelled synthetic data, charts and accessible tables @mobile", async ({
  page,
}, info) => {
  await openPanel(page);
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { level: 1, name: "Estado del asistente" })).toBeVisible();
  await expect(page.getByTestId("synthetic-banner")).toContainText("Datos sintéticos (fixture)");
  const overview = page.getByRole("region", { name: "¿Puede responder ahora?", exact: true });
  await expect(overview.getByText("PRESUPUESTO RESTANTE DEL MES", { exact: true })).toBeVisible();
  await expect(overview.getByText("RESPUESTAS COMPLETADAS · 24 H", { exact: true })).toBeVisible();
  await expect(overview.getByText("PRIMER TEXTO · P95 · 24 H", { exact: true })).toBeVisible();
  // Technical data is available through a real disclosure, not removed or eagerly overwhelming.
  const diagnostic = page.getByText("Diagnóstico técnico y configuración", { exact: true });
  await expect(diagnostic.locator("..")).not.toHaveAttribute("open");
  await diagnostic.focus();
  await page.keyboard.press("Enter");
  await expect(diagnostic.locator("..")).toHaveAttribute("open", "");
  await expect(page.getByRole("heading", { name: "Estado técnico", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(diagnostic.locator("..")).not.toHaveAttribute("open");

  const mobile = info.project.name.startsWith("mobile");
  if (!mobile)
    await expect(page.getByTestId("actor")).toContainText("owner@example.test · propietario");
  else await expect(page.getByTestId("actor-role")).toHaveText("Propietario");
  await expect(page.getByRole("heading", { name: "Presupuesto de 2026-10" })).toBeVisible();
  // The fixture deliberately reports a historical budget day: never imply it is today's spend.
  const budgetTable = page.getByRole("region", { name: "Gasto del mes y del día" });
  await expect(budgetTable.getByRole("columnheader", { name: /Día \(2026-10-05\)/ })).toBeVisible();
  await expect(budgetTable).not.toContainText("Hoy (");
  for (const [label, month, day] of [
    ["Con uso informado", "US$ 0,4123", "US$ 0,0612"],
    ["Estimado", "US$ 0,0180", "US$ 0,0000"],
    ["Pendiente", "US$ 0,0054", "US$ 0,0054"],
    ["Límite", "US$ 10,00", "US$ 1,00"],
  ] as const) {
    const row = budgetTable
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) });
    await expect(row.getByRole("cell")).toHaveText([month, day]);
  }
  await expect(
    page.getByRole("region", { name: "Presupuesto de 2026-10", exact: true }),
  ).toContainText("no la factura del proveedor");

  await expect(page.getByRole("region", { name: "Gasto del mes y del día" })).toContainText(
    "US$ 0,4123",
  );
  await expect(page.getByRole("heading", { name: "Solicitudes · Últimas 24 horas" })).toBeVisible();
  await expect(page.getByText("Rechazadas antes de responder").first()).toBeVisible();
  await expect(
    page.getByTestId("chart-runs").locator(".recharts-bar-rectangle").first(),
  ).toBeVisible();
  await expect(
    page.getByTestId("chart-cost").locator(".recharts-bar-rectangle").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Actividad diaria en tabla" }).getByRole("row"),
  ).toHaveCount(8);
  await axe(page);
  expect(await cspViolations(page)).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-dashboard.png`, fullPage: true });
  if (mobile) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `${SHOTS}/mobile-dashboard-top.png` });
    await page
      .getByRole("region", { name: "Actividad diaria", exact: true })
      .screenshot({ path: `${SHOTS}/mobile-dashboard-daily.png` });
  }
  // No secret or private configuration reaches the browser.
  const html = await page.content();
  expect(html).not.toContain("test-ops-read-token");
  expect(html).not.toContain("127.0.0.1:8237");
});

test("dark theme keeps the dashboard readable and accessible", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openPanel(page);
  await expect(page.getByTestId("synthetic-banner")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await axe(page);
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-dashboard-dark.png`, fullPage: true });
});

test("a single daily reading is a table without a trend chart", async ({ page }) => {
  await variant("single");
  await openPanel(page);
  await expect(page.getByText("Hay una sola lectura diaria")).toBeVisible();
  await expect(page.getByTestId("chart-runs")).toHaveCount(0);
});

test("analytics cards and disclosures reflow with 200 percent text @mobile", async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    ),
  ).toBe(32);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("region", { name: "¿Puede responder ahora?", exact: true }),
    ).toBeVisible();
    const diagnostic = page.getByText("Diagnóstico técnico y configuración", { exact: true });
    await diagnostic.click();
    await expect(page.getByRole("heading", { name: "Estado técnico", exact: true })).toBeVisible();
    const reflow = await page.evaluate(() => {
      const root = document.documentElement;
      // Content-free structural diagnostics; deliberately omit text, URLs, ids and tokens.
      const structuralOverflow = [
        ...document.querySelectorAll("header, nav, main, section, div, span"),
      ]
        .filter((element) => {
          let ancestor: Element | null = element;
          while (ancestor) {
            if (["auto", "scroll"].includes(getComputedStyle(ancestor).overflowX)) return false;
            ancestor = ancestor.parentElement;
          }
          return element.getBoundingClientRect().right + window.scrollX > root.clientWidth + 1;
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          classes: element.className,
          right: Math.round(element.getBoundingClientRect().right + window.scrollX),
        }));
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, structuralOverflow };
    });
    expect(reflow.scrollWidth, JSON.stringify(reflow)).toBeLessThanOrEqual(reflow.clientWidth + 1);
    await diagnostic.click();
  }
  expect(await cspViolations(page)).toEqual([]);
});
