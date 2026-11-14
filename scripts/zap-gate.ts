// Gate for the ZAP baseline JSON report: fails when any alert at or above the threshold remains
// after the triage in .zap/rules.tsv (IGNORE lines are already removed by ZAP itself). It fails
// closed: a missing, unparseable or structurally empty report is never treated as clean.
//   node scripts/zap-gate.ts <report.json> <target-origin> [minimum-risk-code 0..3, default 3]
import { readFileSync } from "node:fs";

type Alert = { pluginid?: string; alert?: string; riskcode?: string; instances?: unknown[] };
type Site = { "@name"?: string; alerts?: unknown };
type Report = { site?: unknown };

/** Structural problems that make a report untrustworthy (empty list means well formed). */
export function reportProblems(report: Report, origin: string): string[] {
  if (!Array.isArray(report.site) || report.site.length === 0)
    return ["report has no scanned site"];
  const sites = report.site as Site[];
  const problems: string[] = [];
  sites.forEach((site, index) => {
    if (!Array.isArray(site?.alerts)) problems.push(`site ${index} has no alerts array`);
  });
  if (!sites.some((site) => site?.["@name"] === origin))
    problems.push(`no scanned site matches the target origin ${origin}`);
  return problems;
}

/** Alerts at or above `minimum` (0 info, 1 low, 2 medium, 3 high); an unreadable code blocks. */
export function blockingAlerts(report: Report, minimum = 3): Alert[] {
  const sites = Array.isArray(report.site) ? (report.site as Site[]) : [];
  return sites
    .flatMap((site) => (Array.isArray(site?.alerts) ? (site.alerts as Alert[]) : []))
    .filter((alert) => {
      const code = /^[0-3]$/.test(String(alert?.riskcode)) ? Number(alert.riskcode) : null;
      return code === null || code >= minimum;
    });
}

export function parseMinimum(value: string | undefined): number | null {
  return value === undefined ? 3 : /^[0-3]$/.test(value) ? Number(value) : null;
}

if (import.meta.main) {
  const [file, origin, minimumText] = process.argv.slice(2);
  const minimum = parseMinimum(minimumText);
  if (!file || !origin || minimum === null) {
    console.error("usage: node scripts/zap-gate.ts <report.json> <target-origin> [0..3]");
    process.exit(2);
  }
  let report: Report;
  try {
    report = JSON.parse(readFileSync(file, "utf8")) as Report;
  } catch {
    console.error(`zap gate: report ${file} is missing or not valid JSON`);
    process.exit(1);
  }
  const problems = reportProblems(report, origin);
  for (const problem of problems) console.error(`zap gate: ${problem}`);
  const blocking = blockingAlerts(report, minimum);
  for (const alert of blocking)
    console.error(`blocking: [${alert.pluginid}] ${alert.alert} (${alert.instances?.length ?? 0})`);
  console.log(
    `zap gate: ${blocking.length} blocking alert(s), ${problems.length} problem(s) in ${file}`,
  );
  process.exit(blocking.length === 0 && problems.length === 0 ? 0 : 1);
}
