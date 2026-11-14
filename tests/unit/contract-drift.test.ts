import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Fetcher, render, watch } from "../../scripts/contract-drift.ts";

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
