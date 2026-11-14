import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { blockingAlerts, parseMinimum, reportProblems } from "../../scripts/zap-gate.ts";

test("the ZAP gate blocks on High alerts and ignores lower risks", () => {
  const report = {
    site: [
      {
        alerts: [
          { pluginid: "1", alert: "high", riskcode: "3" },
          { pluginid: "2", alert: "medium", riskcode: "2" },
          { pluginid: "3", alert: "info", riskcode: "0" },
        ],
      },
    ],
  };
  assert.deepEqual(
    blockingAlerts(report).map((alert) => alert.pluginid),
    ["1"],
  );
  assert.equal(blockingAlerts(report, 2).length, 2);
});

test("every ZAP triage rule is well formed and preceded by a reason comment", () => {
  const lines = readFileSync(new URL("../../.zap/rules.tsv", import.meta.url), "utf8").split("\n");
  let rules = 0;
  lines.forEach((line, index) => {
    if (!line.trim() || line.startsWith("#")) return;
    rules++;
    assert.match(line, /^\d+\t(IGNORE|WARN|FAIL)\t[^\t]+(\t.*)?$/, `rules.tsv:${index + 1}`);
    assert.ok(lines[index - 1]?.startsWith("# Reason"), `rules.tsv:${index + 1} lacks a reason`);
  });
  assert.ok(rules > 0);
});

test("the ZAP gate fails closed on malformed reports and bad risk codes", () => {
  const origin = "http://localhost:3241";
  assert.ok(reportProblems({ site: [] }, origin).length > 0);
  assert.ok(reportProblems({}, origin).length > 0);
  assert.ok(reportProblems({ site: [{ "@name": origin }] }, origin).length > 0);
  assert.ok(reportProblems({ site: [{ "@name": "http://other", alerts: [] }] }, origin).length > 0);
  assert.deepEqual(reportProblems({ site: [{ "@name": origin, alerts: [] }] }, origin), []);
  for (const code of [undefined, "", "high", "7", "-1"])
    assert.equal(blockingAlerts({ site: [{ alerts: [{ riskcode: code }] }] }, 3).length, 1);
  assert.equal(parseMinimum(undefined), 3);
  for (const bad of ["4", "-1", "high", "", "1.5"]) assert.equal(parseMinimum(bad), null);
});

test("the ZAP gate CLI exits non-zero on missing, empty or unparseable files and bad arguments", () => {
  const dir = mkdtempSync(join(tmpdir(), "zap-gate-"));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/zap-gate.ts", ...args], { encoding: "utf8" }).status;
  const origin = "http://localhost:3241";
  const empty = join(dir, "empty.json");
  const broken = join(dir, "broken.json");
  const clean = join(dir, "clean.json");
  writeFileSync(empty, JSON.stringify({ site: [] }));
  writeFileSync(broken, "{not json");
  writeFileSync(clean, JSON.stringify({ site: [{ "@name": origin, alerts: [] }] }));
  assert.equal(run(join(dir, "absent.json"), origin), 1);
  assert.equal(run(empty, origin), 1);
  assert.equal(run(broken, origin), 1);
  assert.equal(run(clean, origin, "9"), 2);
  assert.equal(run(clean), 2);
  assert.equal(run(clean, origin), 0);
});
