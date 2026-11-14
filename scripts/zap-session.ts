// Signs in as the fixture owner through the fake identity provider (TEST ONLY) and writes the
// session cookie as `name=value` to the file given as the first argument, for the ZAP baseline
// authenticated scan (docs/ci.md, .github/workflows/zap-nightly.yml). The cookie belongs to a
// disposable database; it is never printed.
//   node scripts/zap-session.ts <output-file>
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const output = process.argv[2];
if (!output) {
  console.error("usage: node scripts/zap-session.ts <output-file>");
  process.exit(2);
}
const app = process.env.ZAP_APP_URL ?? "http://localhost:3241";
const idp = process.env.ZAP_IDP_URL ?? "http://127.0.0.1:8238";

const identity = await fetch(`${idp}/__identity`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "owner@example.test", email_verified: true, sub: "zap-owner" }),
  signal: AbortSignal.timeout(10_000),
});
if (!identity.ok) throw new Error(`fake IdP refused the identity (${identity.status})`);
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${app}/ingresar`);
  await page.getByRole("button", { name: "Continuar con Proveedor de prueba" }).click();
  await page.waitForURL(/\/panel$/, { timeout: 30_000 });
  const session = (await context.cookies(app)).find((c) => c.name.endsWith("session_token"));
  if (!session) throw new Error("no session cookie after sign-in");
  writeFileSync(output, `${session.name}=${session.value}`, { mode: 0o600 });
  console.log("zap session cookie written (value not shown)");
} finally {
  await browser.close();
}
