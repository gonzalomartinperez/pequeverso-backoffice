// Child process of tests/unit/container.test.ts (loaded with ./server-modules.ts). Drives the
// composition root with a synthetic fetch and prints what each read returned, as JSON.
import { readFileSync } from "node:fs";

const fixture = readFileSync("contracts/ops/summary.fixture.json", "utf8");
const calls: { url: string; authorization: string | null; traceparent: string | null }[] = [];
let mode: "ok" | "down" = "ok";
globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  calls.push({
    url: String(input),
    authorization: headers.get("authorization") === null ? null : "present",
    traceparent: headers.get("traceparent"),
  });
  if (mode === "down") throw new Error("synthetic network failure");
  return new Response(fixture, { status: 200, headers: { "content-type": "application/json" } });
};

const env = await import("../../../src/server/env.ts");
const container = await import("../../../src/server/container.ts");
const ok = await container.readOperations();
mode = "down";
const down = await container.readOperations();
const telemetry = await container.readTelemetry();
const analytics = await container.readAnalytics({}).then(
  () => "resolved",
  () => "rejected",
);
console.log(
  JSON.stringify({
    developmentBuild: env.developmentBuild(),
    httpsOrigin: env.httpsOrigin(),
    ok: ok.status,
    down: down.status,
    telemetry: telemetry.status === "unavailable" ? telemetry.reason : telemetry.status,
    analytics,
    calls,
  }),
);
