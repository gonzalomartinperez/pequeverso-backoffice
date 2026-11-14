import { expect, test } from "@playwright/test";
import { axe, cspViolations, prepare, SHOTS, signIn } from "./support.ts";

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("sign-in page is private, unframable and accessible", async ({ page }, info) => {
  const response = await page.goto("/ingresar");
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["x-robots-tag"]).toContain("noindex");
  await expect(
    page.getByRole("heading", { level: 1, name: "Backoffice del asistente" }),
  ).toBeVisible();
  await axe(page);
  expect(await cspViolations(page)).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/sign-in.png`, fullPage: true });
});

test("the panel redirects anonymous visitors to sign-in", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto("/panel/accesos");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("an uninvited identity in the owner's domain is refused", async ({ page }, info) => {
  await signIn(page, `stranger-${info.project.name}@example.test`, `stranger-${info.project.name}`);
  await expect(page).toHaveURL(/\/ingresar\?error=unable_to_create_user/);
  await expect(page.getByTestId("sign-in-error")).toContainText("no tiene acceso");
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
});
