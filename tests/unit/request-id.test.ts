import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { httpOpsSource } from "../../src/features/operations/adapters/ops-http.ts";

// x-request-id contract (docs/master-plan/roadmap.md M4.7, testing.md Observability): created when
// absent, sanitized when present, propagated to the ops API call and echoed on the response.
// The todo tests are listed in quality/ratchets/known-failures.json and turn into plain tests
// at M4.7 (remove the todo option and the list entry together).

test("the ops adapter sends no request id today and still sends only its three headers", async () => {
  let headers: Record<string, string> = {};
  const fetcher = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  await httpOpsSource({ url: "http://ops.invalid", token: "t" }, fetcher).read();
  assert.deepEqual(Object.keys(headers).sort(), ["Accept", "Authorization"]);
});

test("a valid incoming x-request-id is kept and an invalid one is replaced", {
  todo: "M4.7: src/server/request-id.ts does not exist yet",
}, async () => {
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

test("proxy.ts creates, sanitizes and echoes x-request-id on every response", {
  todo: "M4.7: proxy.ts does not handle x-request-id yet",
}, () => {
  // proxy.ts cannot be imported under node:test (extensionless imports), so assert the source.
  const source = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");
  assert.match(source, /x-request-id/i);
  assert.match(source, /response\.headers\.set\(\s*["']x-request-id["']/i);
});

test("the ops API call carries the sanitized x-request-id", {
  todo: "M4.7: the ops adapter does not accept a request id yet",
}, async () => {
  let headers: Record<string, string> = {};
  const fetcher = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  // Expected: the request id is the fifth parameter of httpOpsSource.
  const source = httpOpsSource as unknown as (...args: unknown[]) => { read(): Promise<unknown> };
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
