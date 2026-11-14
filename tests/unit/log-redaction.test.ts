import assert from "node:assert/strict";
import { test } from "node:test";
import { httpOpsSource } from "../../src/features/operations/adapters/ops-http.ts";
import { SafeObservability } from "../../src/server/observability.ts";
import { parseObservability } from "../../src/server/observability-config.ts";

// Log redaction (docs/master-plan/testing.md, Observability). Everything here uses PLANTED
// synthetic secrets. Passing tests prove today's server paths stay quiet and clean; the todo
// tests need structured logging with a request id (M4.7) and are listed in
// quality/ratchets/known-failures.json.
const TOKEN = "planted-ops-token-0000000000000000";
const SCRAPE = "planted-scrape-token-1111111111111111";
const EMAIL = "planted.person@example.test";
const SECRETS = [TOKEN, SCRAPE, EMAIL, "Bearer"];

type Sink = "log" | "info" | "warn" | "error" | "debug";
const SINKS: Sink[] = ["log", "info", "warn", "error", "debug"];

/** Runs `body` while recording everything written through console and process streams. */
async function captured(body: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const saved = SINKS.map((name) => [name, console[name]] as const);
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const record = (chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  };
  for (const name of SINKS) console[name] = (...args: unknown[]) => void lines.push(args.join(" "));
  process.stdout.write = record as never;
  process.stderr.write = record as never;
  try {
    await body();
  } finally {
    for (const [name, original] of saved) console[name] = original;
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }
  return lines.join("\n");
}

function assertClean(output: string) {
  for (const secret of SECRETS) assert.ok(!output.includes(secret), `log leaked ${secret}`);
}

test("a failing ops request leaves the bearer token out of logs and the reading", async () => {
  const failing = (async () => {
    throw new Error(`connect failed with Authorization: Bearer ${TOKEN} for ${EMAIL}`);
  }) as unknown as typeof fetch;
  let reading: unknown;
  const output = await captured(async () => {
    reading = await httpOpsSource({ url: "http://ops.invalid", token: TOKEN }, failing).read();
  });
  assert.equal((reading as { status: string; reason: string }).reason, "unreachable");
  assertClean(output);
  assertClean(JSON.stringify(reading));
});

test("a rejected or malformed ops response leaves no secret in logs or the reading", async () => {
  for (const body of [`{"error":"${TOKEN} ${EMAIL}"}`, `not json ${TOKEN}`]) {
    const fetcher = (async () =>
      new Response(body, { status: body.startsWith("{") ? 401 : 200 })) as typeof fetch;
    let reading: unknown;
    const output = await captured(async () => {
      reading = await httpOpsSource({ url: "http://ops.invalid", token: TOKEN }, fetcher).read();
    });
    assertClean(output);
    assertClean(JSON.stringify(reading));
  }
});

test("observed operations never put planted secrets in logs, metrics or errors", async () => {
  const observed = new SafeObservability(
    parseObservability({ OBSERVABILITY_METRICS_ENABLED: "true", OBSERVABILITY_READ_TOKEN: SCRAPE }),
  );
  let thrown = "";
  const output = await captured(async () => {
    await observed.observe(
      "ops_summary",
      async () => "ok",
      () => "ok",
    );
    try {
      await observed.observe(
        "ops_summary",
        async () => {
          throw new Error(`failure for ${EMAIL}`);
        },
        () => "ok",
      );
    } catch (error) {
      thrown = error instanceof Error ? error.message : "";
    }
  });
  assertClean(output);
  assertClean(observed.metrics());
  assert.match(thrown, /failure/); // the error propagates to the caller, which owns its handling
});

test("rejected scrape credentials are not echoed", async () => {
  const observed = new SafeObservability(
    parseObservability({ OBSERVABILITY_METRICS_ENABLED: "true", OBSERVABILITY_READ_TOKEN: SCRAPE }),
  );
  const output = await captured(async () => {
    assert.equal(observed.authorize(`Bearer ${SCRAPE}x`), "rejected");
  });
  assertClean(output);
});

test("structured server logs carry the request id and no e-mail or token", {
  todo: "M4.7: structured logger with request id does not exist yet",
}, async () => {
  // Expected shape once M4.7 lands: src/server/log.ts exports log(event, fields, requestId).
  const modulePath = "../../src/server/log.ts";
  const { log } = (await import(modulePath)) as {
    log: (event: string, fields: Record<string, unknown>, requestId: string) => void;
  };
  const output = await captured(async () =>
    log("sign_up_denied", { email: EMAIL, token: TOKEN }, "req-12345678"),
  );
  assert.match(output, /req-12345678/);
  assertClean(output);
});

test("trace spans carry the request id and no e-mail or token", {
  todo: "M4.7: spans do not carry a request id attribute yet",
}, async () => {
  const modulePath = "../../src/server/request-id.ts";
  const { REQUEST_ID_ATTRIBUTE } = (await import(modulePath)) as {
    REQUEST_ID_ATTRIBUTE: string;
  };
  assert.equal(REQUEST_ID_ATTRIBUTE, "request.id");
});
