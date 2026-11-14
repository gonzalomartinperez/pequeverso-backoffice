import { expect, test as setup } from "@playwright/test";
import {
  continueWithTestProvider,
  identity,
  newPage,
  OWNER_STATE,
  signIn,
  VIEWER_STATE,
} from "./support.ts";

// Signs each role in once through the real Better Auth callback against the fake IdP and stores
// the session cookies for the role projects. The sessions are disposable test data.
setup.describe.configure({ mode: "serial" });

setup("owner signs in through the fake identity provider", async ({ page }) => {
  await signIn(page, "owner@example.test", "owner");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByTestId("actor")).toContainText("owner@example.test · propietario");
  await page.context().storageState({ path: OWNER_STATE });
});

setup(
  "viewer is invited by the owner and accepts through the fake IdP",
  async ({ browser }, info) => {
    const email = `viewer-setup-${info.retry}@example.test`;
    const owner = await browser.newContext({ storageState: OWNER_STATE });
    const ownerPage = await owner.newPage();
    await ownerPage.goto("/panel/accesos");
    await ownerPage.getByLabel("E-mail verificado de la persona").fill(email);
    await ownerPage.getByRole("button", { name: "Crear invitación" }).click();
    const link = (await ownerPage.getByTestId("invitation-link").textContent())?.trim() ?? "";
    expect(link).toMatch(/^http:\/\/localhost:3241\/invitacion\/[A-Za-z0-9_-]{43}$/);
    await owner.close();

    const viewer = await newPage(browser);
    await viewer.goto(link);
    await identity(email, `viewer-setup-${info.retry}`);
    await continueWithTestProvider(viewer);
    await expect(viewer).toHaveURL(/\/panel$/);
    await expect(viewer.getByTestId("actor")).toContainText(`${email} · lectura`);
    await viewer.context().storageState({ path: VIEWER_STATE });
    await viewer.context().close();
  },
);
