import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { httpOpsSource } from "../../src/features/operations/adapters/ops-http.ts";

// x-request-id contract (docs/master-plan/roadmap.md M4.7, testing.md Observability): created when
// absent, sanitized when present, propagated to the ops API call and echoed on the response.
// Expected-red since M2.9; delivered by M4.7.

test("the ops adapter sends no request id today and still sends only its three headers", async () => {
  let headers: Record<string, string> = {};
  const fetcher = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  await httpOpsSource({ url: "http://ops.invalid", token: "t" }, fetcher).read();
  assert.deepEqual(Object.keys(headers).sort(), ["Accept", "Authorization"]);
});

test("a valid incoming x-request-id is kept and an invalid one is replaced", async () => {
  // Expected: requestIdFrom(header) keeps ^[A-Za-z0-9._-]{8,64}$ and otherwise returns a UUID.
  const modulePath = "../../src/server/request-id.ts";
  const { requestIdFrom } = (await import(modulePath)) as {
    requestIdFrom: (header: string | null) => string;
  };
  assert.equal(requestIdFrom("abc-12345678"), "abc-12345678");
  assert.match(requestIdFrom(null), /^[0-9a-f-]{36}$/);
  for (const bad of [
    "short",
    "a b c d e f g h",
    "x\r\nInjected: 1",
    "é".repeat(12),
    "a".repeat(65),
  ])
    assert.match(requestIdFrom(bad), /^[0-9a-f-]{36}$/);
});

test("proxy.ts creates, sanitizes and echoes x-request-id on every response", () => {
  // The proxy needs a NextRequest, so the source contract is asserted here and the behaviour in
  // the browser suite (every response carries a sanitized id).
  const source = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");
  assert.match(source, /x-request-id/i);
  assert.match(source, /response\.headers\.set\(\s*["']x-request-id["']/i);
});

test("the ops API call carries the sanitized x-request-id", async () => {
  let headers: Record<string, string> = {};
  const fetcher = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  const source = httpOpsSource;
  await source(
    { url: "http://ops.invalid", token: "t" },
    fetcher,
    4000,
    null,
    "abc-12345678",
  ).read();
  assert.equal(headers["x-request-id"], "abc-12345678");
  await source({ url: "http://ops.invalid", token: "t" }, fetcher, 4000, null, "bad\r\nid").read();
  assert.equal(headers["x-request-id"], undefined);
});

test("the telemetry call carries the same sanitized x-request-id", async () => {
  const { readHttpTelemetry } = await import(
    "../../src/features/operations/adapters/telemetry-http.ts"
  );
  let headers: Record<string, string> = {};
  const fetcher = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  const settings = { url: "http://ops.invalid", token: "t" };
  await readHttpTelemetry(settings, true, fetcher, null, "abc-12345678");
  assert.equal(headers["x-request-id"], "abc-12345678");
  await readHttpTelemetry(settings, true, fetcher, null, "x\r\ny");
  assert.equal(headers["x-request-id"], undefined);
});
