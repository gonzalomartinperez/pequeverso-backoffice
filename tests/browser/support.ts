import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page } from "@playwright/test";

export const IDP = "http://127.0.0.1:8238";
export const OPS = "http://127.0.0.1:8237";
export const SHOTS = "docs/verification/backoffice";

export async function identity(email: string, sub: string, verified = true) {
  await fetch(`${IDP}/__identity`, {
    method: "POST",
    body: JSON.stringify({ email, sub, email_verified: verified }),
  });
}

export async function variant(name: string) {
  await fetch(`${OPS}/__variant?name=${name}`);
}

/** Records CSP violations so every test can assert the strict policy breaks nothing. */
export async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = store;
    document.addEventListener("securitypolicyviolation", (event) => {
      store.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
}

export async function signIn(page: Page, email: string, sub: string) {
  await identity(email, sub);
  await page.goto("/ingresar");
  await continueWithTestProvider(page);
  // The OAuth round trip ends on the panel or back on the sign-in page with an error.
  await page.waitForURL(/\/panel$|\/ingresar\?error=/);
}

export async function continueWithTestProvider(page: Page) {
  const button = page.getByRole("button", { name: "Continuar con Proveedor de prueba" });
  await expect(button).toBeEnabled();
  await button.click();
}

export async function axe(page: Page) {
  // Audit a settled page: right after a server action React may be mid-commit (Firefox has shown
  // a transient empty <title> then). A page whose title never appears still fails here.
  await page.waitForLoadState("load");
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`),
  ).toEqual([]);
}

export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await watchCsp(page);
  return page;
}

/** Every backoffice test starts from the full synthetic ops variant with CSP monitoring. */
export async function prepare(page: Page) {
  await variant("full");
  await watchCsp(page);
}
