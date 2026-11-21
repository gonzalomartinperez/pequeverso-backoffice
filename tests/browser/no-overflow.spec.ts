import { expect, test } from "@playwright/test";
import { axe, OWNER_STATE, prepare, SHOTS } from "./support.ts";

// M2.6 and M3.1 (A-P1-1): no route may scroll sideways at the four reference widths (WCAG 1.4.10 reflow).
// Signed in as the owner (auth.setup.ts), who can open every route including /panel/accesos.
test.use({ storageState: OWNER_STATE });

const ROUTES = ["/panel", "/panel/analitica", "/panel/accesos", "/panel/cuenta"] as const;
const WIDTHS = [320, 390, 768, 1440] as const;

for (const route of ROUTES)
  for (const width of WIDTHS)
    test(`no horizontal overflow on ${route} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page);
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
    });

test("no horizontal overflow on /ingresar at every reference width", async ({ browser }) => {
  // Anonymous context: the sign-in page redirects signed-in users away.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/ingresar");
      await expect(page.locator("main")).toBeVisible();
      const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
    }
  } finally {
    await context.close();
  }
});

// Evidence for A-P1-1 (docs/verification/backoffice): the members table scrolls inside its region
// at 390 px in both themes, and the page itself stays within the viewport.
for (const scheme of ["light", "dark"] as const)
  test(`members table reflows at 390 px, ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await prepare(page);
    await page.goto("/panel/accesos");
    await expect(page.locator('section[aria-label="Cuentas con acceso"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await axe(page);
    await page.screenshot({
      path: `${SHOTS}/mobile-access${scheme === "dark" ? "-dark" : ""}.png`,
      fullPage: true,
    });
  });
