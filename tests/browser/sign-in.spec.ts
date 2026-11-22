import { readFileSync } from "node:fs";
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
  // M4.7: every response carries a request id; a well-formed incoming one is echoed, others replaced.
  expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  const echoed = await page.request.get("/healthz", {
    headers: { "x-request-id": "probe-12345678" },
  });
  expect(echoed.headers()["x-request-id"]).toBe("probe-12345678");
  expect(await echoed.json()).toMatchObject({ status: "ok", schema_version: "0002" });
  const replaced = await page.request.get("/ingresar", { headers: { "x-request-id": "bad id" } });
  expect(replaced.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
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

test("the dev-only component kit does not exist in the production server", async ({ page }) => {
  const response = await page.goto("/__kit");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("kit-marker")).toHaveCount(0);
  // Not merely hidden: the production build has no such route at all.
  const routes = readFileSync(".next/app-path-routes-manifest.json", "utf8");
  expect(routes).not.toContain("__kit");
});
