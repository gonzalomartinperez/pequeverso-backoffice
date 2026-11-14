import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blockingAlerts } from "../../scripts/zap-gate.ts";

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
  assert.equal(blockingAlerts({ site: [] }).length, 0);
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
