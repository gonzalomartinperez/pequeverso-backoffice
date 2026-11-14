// One-command setup from a fresh clone: check the Node line, install the locked dependencies
// without install scripts, then run the fast check. Uses only Node built-ins (runs before npm ci).
// Never reads or writes .env files; database and browser suites need their own fixtures
// (docs/verification.md).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const wanted = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
const major = (version: string) => version.replace(/^v/, "").split(".")[0];
if (major(process.version) !== major(wanted)) {
  console.error(`Node ${wanted} expected (.nvmrc), found ${process.version}. Run \`nvm use\`.`);
  process.exit(1);
}
if (process.version.replace(/^v/, "") !== wanted)
  console.warn(`Node ${process.version} differs from the pinned ${wanted}; continuing.`);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const args of [
  ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
  ["run", "check:fast"],
]) {
  console.log(`$ npm ${args.join(" ")}`);
  execFileSync(npm, args, { stdio: "inherit" });
}
console.log("Setup complete. Full gate: npm run check; database: npm run test:db.");
