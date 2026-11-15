import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Fetcher, fetchRaw, MAX_BYTES, render, watch } from "../../scripts/contract-drift.ts";

const pin = JSON.parse(readFileSync("contracts/ops/source.json", "utf8"));
const example = readFileSync("contracts/ops/ops.summary.example.json");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const serve =
  (body: Uint8Array): Fetcher =>
  async () =>
    body;

test("pinned bytes that still validate produce no finding", async () => {
  const exact = {
    ...pin,
    files: { "contracts/examples/ops.summary.json": { sha256: sha(example) } },
  };
  assert.deepEqual(await watch("ops", exact, serve(example)), []);
});

test("changed bytes are drift and the request targets the API develop raw URL", async () => {
  const urls: string[] = [];
  const spy: Fetcher = async (url) => {
    urls.push(url);
    return example;
  };
  const findings = await watch("ops", pin, spy);
  assert.ok(
    urls.every((u) =>
      u.startsWith(`https://raw.githubusercontent.com/${pin.api_repository}/develop/`),
    ),
  );
  assert.deepEqual(
    findings.map((f) => f.file),
    ["contracts/ops.schema.json"],
  );
});

test("an example the local validator rejects is reported as breaking", async () => {
  const broken = new TextEncoder().encode(JSON.stringify({ schema_version: "9" }));
  const findings = await watch("ops", pin, serve(broken));
  assert.ok(findings.some((f) => f.problem === "breaking" && f.file.endsWith("ops.summary.json")));
  assert.match(render(findings), /BREAKING ops/);
});

test("a failed fetch rejects instead of reading as no drift", async () => {
  await assert.rejects(
    watch("ops", pin, async () => Promise.reject(new Error("503"))),
    /503/,
  );
});

const sourceOf = (name: string) =>
  JSON.parse(readFileSync(`contracts/${name}/source.json`, "utf8"));
const bytesOf = (file: string) => readFileSync(file);

test("the telemetry and analytics examples pass their validators and a broken one is breaking", async () => {
  const telemetry = sourceOf("telemetry");
  const tFile = "contracts/examples/ops.telemetry.json";
  const tBytes = bytesOf("contracts/telemetry/ops.telemetry.example.json");
  const tPin = { ...telemetry, files: { [tFile]: { sha256: sha(tBytes) } } };
  assert.deepEqual(await watch("telemetry", tPin, serve(tBytes)), []);
  const tBroken = await watch("telemetry", tPin, serve(new TextEncoder().encode("{}")));
  assert.ok(tBroken.some((f) => f.problem === "breaking"));

  const analytics = sourceOf("analytics");
  const aFile = "contracts/examples/product-analytics.json";
  const aBytes = bytesOf("contracts/analytics/product-analytics.example.json");
  const aPin = { ...analytics, files: { [aFile]: { sha256: sha(aBytes) } } };
  assert.deepEqual(await watch("analytics", aPin, serve(aBytes)), []);
  const wrapped = JSON.parse(aBytes.toString("utf8"));
  delete wrapped.report.selection;
  const aBroken = await watch(
    "analytics",
    aPin,
    serve(new TextEncoder().encode(JSON.stringify(wrapped))),
  );
  assert.ok(aBroken.some((f) => f.problem === "breaking"));
});

test("fetchRaw refuses redirects and bodies over 1 MiB", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      assert.equal(init?.redirect, "error");
      return new Response(new Uint8Array(MAX_BYTES + 1));
    }) as typeof fetch;
    await assert.rejects(fetchRaw("https://example.test/x"), /exceeds/);
    globalThis.fetch = (async () => new Response("ok")) as typeof fetch;
    assert.equal(new TextDecoder().decode(await fetchRaw("https://example.test/x")), "ok");
  } finally {
    globalThis.fetch = real;
  }
});
