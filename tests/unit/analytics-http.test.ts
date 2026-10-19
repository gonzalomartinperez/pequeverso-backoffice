import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { analyticsHttp } from "../../src/features/analytics/adapters/analytics-http.ts";
import type { Selection } from "../../src/features/analytics/domain/report.ts";

const report = JSON.parse(
  readFileSync(
    new URL("../../contracts/analytics/product-analytics.example.json", import.meta.url),
    "utf8",
  ),
).report;
const selection: Selection = report.selection;
const settings = { url: "http://fixture-api", token: "synthetic-server-only-token" };
describe("bounded private analytics read", () => {
  it("does no fetch when disabled or unconfigured", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      throw new Error("must not fetch");
    };
    assert.deepEqual(await analyticsHttp(settings, false, fetcher).read(selection), {
      status: "disabled",
    });
    assert.equal((await analyticsHttp(null, true, fetcher).read(selection)).status, "unavailable");
    assert.equal(calls, 0);
  });
  it("uses only the server bearer and approved selection without cache, redirect or retry", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.pathname, "/internal/v1/ops/product-analytics");
      assert.equal(url.searchParams.get("section_id"), "hero");
      assert.deepEqual(init?.headers, {
        Authorization: `Bearer ${settings.token}`,
        Accept: "application/json",
      });
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      return Response.json(report);
    };
    assert.equal(
      (await analyticsHttp(settings, true, fetcher).read(selection)).status,
      "available",
    );
    assert.equal(calls, 1);
  });
  it("accepts production-class aggregates through the same bounded private server read", async () => {
    const reading = await analyticsHttp(settings, true, async () =>
      Response.json({ ...report, synthetic: false, country_collection: "trusted_proxy_header" }),
    ).read(selection);
    assert.equal(reading.status, "available");
    if (reading.status === "available") assert.equal(reading.report.synthetic, false);
  });
  it("distinguishes disabled, rejected, malformed, non-UTF8 and oversized bodies", async () => {
    const cases: [() => Response, string][] = [
      [() => new Response(null, { status: 404 }), "disabled"],
      [() => new Response(null, { status: 401 }), "unavailable"],
      [() => new Response("{}", { headers: { "content-type": "text/plain" } }), "unavailable"],
      [
        () => new Response("{}", { headers: { "content-type": "application/json" } }),
        "unavailable",
      ],
      [() => Response.json({ ...report, synthetic: "false" }), "unavailable"],
      [
        () =>
          new Response(new Uint8Array([255]), { headers: { "content-type": "application/json" } }),
        "unavailable",
      ],
      [
        () =>
          new Response("x".repeat(256 * 1024 + 1), {
            headers: { "content-type": "application/json", "content-length": "1" },
          }),
        "unavailable",
      ],
    ];
    for (const [response, status] of cases)
      assert.equal(
        (await analyticsHttp(settings, true, async () => response()).read(selection)).status,
        status,
      );
  });
  it("bounds both a stuck fetch and a stuck chunked body", async () => {
    let canceled = false;
    for (const fetcher of [
      async () => new Promise<Response>(() => {}),
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled = true;
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ]) {
      const started = performance.now();
      assert.equal(
        (await analyticsHttp(settings, true, fetcher, 15).read(selection)).status,
        "unavailable",
      );
      assert.ok(performance.now() - started < 1000);
    }
    assert.equal(canceled, true);
  });
});
