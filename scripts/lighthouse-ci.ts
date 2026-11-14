// Lighthouse over the preview stack (scripts/backoffice-stack.ts: production build, fake IdP,
// SYNTHETIC mock ops). Warn mode: prints and summarizes medians and exits 0 on budget misses;
// `--enforce` turns misses into a failure. Infrastructure failures always exit non-zero.
//
//   node scripts/lighthouse-ci.ts --lighthouse-bin <path> [--base http://localhost:3241]
//     [--idp http://127.0.0.1:8238] [--runs 5] [--out lighthouse-out] [--enforce]
//
// Chromium is Playwright's, launched with a debugging port; Lighthouse attaches with --port, so
// the sign-in cookie created through the fake IdP is shared with the audited tab. `/ingresar` is
// audited first (anonymous), then the session is created and `/panel` is audited.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import {
  type Budgets,
  extractRun,
  findMisses,
  type RunMetrics,
  renderMarkdown,
  type Summary,
  summarize,
} from "./lighthouse-summary.ts";

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const bin = flag("--lighthouse-bin");
if (!bin) throw new Error("--lighthouse-bin is required");
const base = flag("--base", "http://localhost:3241") as string;
const idp = flag("--idp", "http://127.0.0.1:8238") as string;
const runs = Number(flag("--runs", "5"));
const out = flag("--out", "lighthouse-out") as string;
const enforce = argv.includes("--enforce");
const port = 9333;
mkdirSync(out, { recursive: true });

function lighthouse(url: string, file: string, desktop: boolean): Promise<void> {
  const args = [
    url,
    `--port=${port}`,
    "--output=json",
    `--output-path=${file}`,
    "--only-categories=performance,accessibility,best-practices",
    "--quiet",
    ...(desktop ? ["--preset=desktop"] : []),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(bin as string, args, { stdio: ["ignore", "inherit", "inherit"] });
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`lighthouse exited with ${code} for ${url}`));
    });
  });
}

const results: Record<string, Summary> = {};
async function audit(name: string, path: string, desktop: boolean) {
  const collected: RunMetrics[] = [];
  for (let run = 1; run <= runs; run++) {
    const file = join(out, `${name}-${run}.json`);
    try {
      await lighthouse(`${base}${path}`, file, desktop);
      collected.push(extractRun(JSON.parse(readFileSync(file, "utf8"))));
    } catch (error) {
      console.error(`${name} run ${run} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  // A median over fewer than three runs is not a median of 5: treat it as an infrastructure failure.
  if (collected.length < 3)
    throw new Error(`${name}: only ${collected.length}/${runs} runs succeeded`);
  results[name] = summarize(collected);
  console.log(name, JSON.stringify(results[name]));
}

const profile = mkdtempSync(join(tmpdir(), "lh-profile-"));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  args: [`--remote-debugging-port=${port}`],
});
try {
  await audit("signin_mobile", "/ingresar", false);
  await audit("signin_desktop", "/ingresar", true);

  await fetch(`${idp}/__identity`, {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.test", sub: "owner", email_verified: true }),
  });
  const page = await context.newPage();
  await page.goto(`${base}/ingresar`);
  await page.getByRole("button", { name: "Continuar con Proveedor de prueba" }).click();
  await page.waitForURL(/\/panel$/);
  await page.close();

  await audit("dashboard_mobile", "/panel", false);
  await audit("dashboard_desktop", "/panel", true);
} finally {
  await context.close();
}

const ratchet = JSON.parse(readFileSync("quality/ratchets/lighthouse.json", "utf8")) as {
  budgets: Budgets;
};
const misses = Object.entries(results).flatMap(([name, summary]) =>
  findMisses(name, summary, ratchet.budgets),
);
const version = flag("--lighthouse-version", "unknown") as string;
const markdown = renderMarkdown(results, misses, version);
console.log(markdown);
writeFileSync(
  join(out, "lighthouse-summary.json"),
  `${JSON.stringify({ lighthouseVersion: version, stack: "synthetic preview stack", results }, null, 2)}\n`,
);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
if (process.env.GITHUB_ACTIONS)
  for (const miss of misses) console.log(`::warning title=lighthouse::${miss}`);
process.exit(enforce && misses.length ? 1 : 0);
