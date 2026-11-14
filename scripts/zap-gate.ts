// Gate for the ZAP baseline JSON report: fails when any alert at or above the threshold remains
// after the triage in .zap/rules.tsv (IGNORE lines are already removed by ZAP itself).
//   node scripts/zap-gate.ts <report.json> [minimum-risk-code, default 3 = High]
import { readFileSync } from "node:fs";

type Alert = { pluginid?: string; alert?: string; riskcode?: string; instances?: unknown[] };
type Report = { site?: { "@name"?: string; alerts?: Alert[] }[] };

/** Alerts at or above `minimum` (ZAP risk codes: 0 info, 1 low, 2 medium, 3 high). */
export function blockingAlerts(report: Report, minimum = 3): Alert[] {
  return (report.site ?? [])
    .flatMap((site) => site.alerts ?? [])
    .filter((alert) => Number(alert.riskcode ?? "0") >= minimum);
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/zap-gate.ts <report.json> [minimum-risk-code]");
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(file, "utf8")) as Report;
  if (!Array.isArray(report.site)) {
    console.error("ZAP report has no site list: refusing to treat it as clean");
    process.exit(1);
  }
  const blocking = blockingAlerts(report, Number(process.argv[3] ?? "3"));
  for (const alert of blocking)
    console.error(`blocking: [${alert.pluginid}] ${alert.alert} (${alert.instances?.length ?? 0})`);
  console.log(`zap gate: ${blocking.length} blocking alert(s) in ${file}`);
  process.exit(blocking.length === 0 ? 0 : 1);
}
