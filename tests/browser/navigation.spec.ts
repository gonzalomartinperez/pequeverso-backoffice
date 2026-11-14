import { expect, type Request, test } from "@playwright/test";
import { cspViolations, OWNER_STATE, openPanel, prepare } from "./support.ts";

// Signed in once by auth.setup.ts through the fake IdP; no per-test OAuth round trip.
test.use({ storageState: OWNER_STATE });

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("keyboard: skip link, navigation and focus are reachable", async ({ page }) => {
  await openPanel(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
  const nav = page.getByRole("navigation", { name: "Backoffice" });
  await nav.getByRole("link", { name: "Accesos" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel\/accesos$/);
  await expect(nav.getByRole("link", { name: "Accesos" })).toHaveAttribute("aria-current", "page");
});

test("private navigation waits for explicit activation instead of prefetching @mobile", async ({
  page,
}) => {
  const privatePaths = new Set(["/panel", "/panel/analitica", "/panel/accesos", "/panel/cuenta"]);
  let privatePrefetches = 0;
  const observe = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://localhost:3241" || !privatePaths.has(url.pathname)) return;
    const headers = request.headers();
    if (headers["next-router-prefetch"] === "1" || headers.purpose === "prefetch")
      privatePrefetches++;
  };
  // Observe before the first navigation so initial viewport prefetch cannot escape the check.
  page.on("request", observe);
  try {
    await openPanel(page);
    const nav = page.getByRole("navigation", { name: "Backoffice" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(4);
    await page.waitForLoadState("networkidle", { timeout: 7_000 });
    expect(privatePrefetches).toBe(0);
    for (const link of await nav.getByRole("link").all()) await link.hover();
    await page.waitForLoadState("networkidle", { timeout: 7_000 });
    expect(privatePrefetches).toBe(0);

    const accountResponse = page.waitForResponse((response) => {
      const request = response.request();
      const url = new URL(response.url());
      return (
        url.origin === "http://localhost:3241" &&
        url.pathname === "/panel/cuenta" &&
        (request.isNavigationRequest() || request.headers().rsc === "1") &&
        request.headers()["next-router-prefetch"] !== "1"
      );
    });
    await nav.getByRole("link", { name: "Cuenta", exact: true }).click();
    expect((await accountResponse).status()).toBe(200);
    await expect(page).toHaveURL(/\/panel\/cuenta$/);
    await expect(nav.getByRole("link", { name: "Cuenta", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(privatePrefetches).toBe(0);
    expect(await cspViolations(page)).toEqual([]);
  } finally {
    page.off("request", observe);
  }
});
