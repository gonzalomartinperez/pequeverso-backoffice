import { expect, test } from "@playwright/test";
import {
  axe,
  continueWithTestProvider,
  identity,
  newPage,
  prepare,
  SHOTS,
  signIn,
} from "./support.ts";

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test("invitation lifecycle: invite, accept as viewer, read-only, revoke", async ({
  page,
  browser,
}, info) => {
  // Unique per attempt: a retry must not collide with the previous attempt's database rows.
  const attempt = `${info.project.name}-${info.repeatEachIndex}-${info.retry}`;
  const email = `viewer-${attempt}@example.test`;
  await signIn(page, "owner@example.test", "owner");
  await page.goto("/panel/accesos");
  await page.getByLabel("E-mail verificado de la persona").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const link = (await page.getByTestId("invitation-link").textContent())?.trim() ?? "";
  expect(link).toMatch(/^http:\/\/localhost:3241\/invitacion\/[A-Za-z0-9_-]{43}$/);
  if (info.project.name === "chromium") {
    // Keep the opaque invitation URL only in test memory, never in a public screenshot.
    await page.reload();
    await expect(page.getByTestId("invitation-link")).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Invitaciones" })
        .getByRole("row", { name: new RegExp(email) }),
    ).toContainText("Pendiente");
    await page.screenshot({ path: `${SHOTS}/desktop-access.png`, fullPage: true });
  }

  // Someone else with the link but another e-mail is refused, and the link still works afterwards.
  const intruder = await newPage(browser);
  await intruder.goto(link);
  await expect(intruder).toHaveURL(/\/ingresar\?invitacion=1$/);
  expect(intruder.url()).not.toContain("/invitacion/");
  await identity(`intruder-${attempt}@example.test`, `intruder-${attempt}`);
  await continueWithTestProvider(intruder);
  await expect(intruder).toHaveURL(/error=unable_to_create_user/);
  await intruder.context().close();

  const viewer = await newPage(browser);
  await viewer.goto(link);
  await identity(email, `viewer-${attempt}`);
  await continueWithTestProvider(viewer);
  await expect(viewer).toHaveURL(/\/panel$/);
  await expect(viewer.getByTestId("actor")).toContainText(`${email} · lectura`);
  await expect(
    viewer.getByRole("navigation", { name: "Backoffice" }).getByRole("link", { name: "Accesos" }),
  ).toHaveCount(0);
  await viewer.goto("/panel/accesos");
  await expect(viewer).toHaveURL(/\/panel$/);
  // Explicit linking is offered to owners only.
  await viewer.goto("/panel/cuenta");
  await expect(viewer.getByRole("button", { name: /Vincular/ })).toHaveCount(0);
  // No session material in browser storage.
  expect(
    await viewer.evaluate(() =>
      Object.keys(localStorage).filter((k) => /auth|session|token/i.test(k)),
    ),
  ).toEqual([]);

  // The link is spent.
  const late = await newPage(browser);
  await late.goto(link);
  await expect(late).toHaveURL(/error=invitation_invalid/);
  await late.context().close();

  // Revocation takes effect on the viewer's next request.
  await page.reload();
  const members = page.getByRole("region", { name: "Cuentas con acceso" });
  const row = members.getByRole("row", { name: new RegExp(email) });
  const trigger = row.getByRole("button", { name: `Quitar acceso ${email}` });
  // Escape cancels the modal and returns focus to its trigger.
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "¿Quitar el acceso?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  if (info.project.name === "chromium")
    await page.screenshot({ path: `${SHOTS}/desktop-revoke-dialog.png` });
  await dialog.getByRole("button", { name: "Quitar acceso" }).click();
  await expect(dialog).toBeHidden();
  await expect(members.getByRole("row", { name: new RegExp(email) })).toHaveCount(0);
  await expect(page.locator("#members-title")).toBeFocused();
  await expect(
    page
      .getByRole("region", { name: "Invitaciones" })
      .getByRole("row", { name: new RegExp(email) }),
  ).toContainText("Aceptada");
  await viewer.goto("/panel");
  await expect(viewer).toHaveURL(/\/ingresar$/);
  await viewer.context().close();
});

test("newly created invitations are accessible", async ({ page }, info) => {
  const attempt = `${info.project.name}-${info.repeatEachIndex}-${info.retry}`;
  const email = `audit-pending-${attempt}@example.test`;
  await signIn(page, "owner@example.test", "owner");
  await page.goto("/panel/accesos");
  await page.getByLabel("E-mail verificado de la persona").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  // Audit the same newly created, unconsumed invitation state as the lifecycle.
  await expect(page.getByTestId("invitation-link")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Invitaciones" })
      .getByRole("row", { name: new RegExp(email) }),
  ).toContainText("Pendiente");
  await axe(page);
});

test("the owner's revocation dialog is accessible", async ({ page, browser }, info) => {
  const attempt = `${info.project.name}-${info.repeatEachIndex}-${info.retry}`;
  const email = `audit-revoke-${attempt}@example.test`;
  await signIn(page, "owner@example.test", "owner");
  await page.goto("/panel/accesos");
  await page.getByLabel("E-mail verificado de la persona").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const link = (await page.getByTestId("invitation-link").textContent())?.trim() ?? "";
  expect(link).toMatch(/^http:\/\/localhost:3241\/invitacion\/[A-Za-z0-9_-]{43}$/);
  const viewer = await newPage(browser);
  try {
    // Populate the member through the real invitation and OAuth callback, never injected SQL.
    await viewer.goto(link);
    await identity(email, `audit-revoke-${attempt}`);
    await continueWithTestProvider(viewer);
    await expect(viewer).toHaveURL(/\/panel$/);
    await expect(viewer.getByTestId("actor")).toContainText(`${email} · lectura`);
    await page.reload();
    const member = page
      .getByRole("region", { name: "Cuentas con acceso" })
      .getByRole("row", { name: new RegExp(email) });
    await member.getByRole("button", { name: `Quitar acceso ${email}` }).click();
    await expect(page.getByRole("dialog", { name: "¿Quitar el acceso?" })).toBeVisible();
    await axe(page);
  } finally {
    await viewer.context().close();
  }
});
