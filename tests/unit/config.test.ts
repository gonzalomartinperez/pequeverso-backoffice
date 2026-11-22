import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConfig } from "../../src/server/env-parse.ts";

const production = {
  BACKOFFICE_ENVIRONMENT: "production",
  BACKOFFICE_ORIGIN: "https://backoffice.example.test",
  BETTER_AUTH_SECRET: "s".repeat(40),
  DATABASE_URL: "postgres://user:pass@db:5432/backoffice",
  OWNER_EMAIL: "Owner@Example.test",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
};

describe("backoffice configuration", () => {
  it("accepts a complete production configuration", () => {
    const config = parseConfig(production);
    assert.equal(config.ownerEmail, "owner@example.test");
    assert.equal(config.github?.clientId, "id");
    assert.equal(config.google, null);
    assert.equal(config.ops, null);
    assert.equal(config.rateLimit, true);
  });

  it("fails closed in production", () => {
    const cases: Record<string, string | undefined>[] = [
      { ...production, BACKOFFICE_ORIGIN: "http://backoffice.example.test" },
      { ...production, BACKOFFICE_ORIGIN: "https://backoffice.example.test/path" },
      { ...production, BETTER_AUTH_SECRET: "short" },
      { ...production, DATABASE_URL: "" },
      { ...production, OWNER_EMAIL: "" },
      { ...production, GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "" },
      { ...production, GITHUB_CLIENT_SECRET: "" },
      { ...production, AUTH_TEST_ISSUER: "http://127.0.0.1:8218" },
      { ...production, OPS_API_URL: "http://api:8000" },
      { ...production, OPS_API_URL: "http://api:8000", OPS_READ_TOKEN: "short" },
      { ...production, OPS_API_URL: "http://u:p@api:8000", OPS_READ_TOKEN: "t".repeat(40) },
      { ...production, BACKOFFICE_ENVIRONMENT: "staging" },
      { ...production, AUTH_DISABLE_RATE_LIMIT: "1" },
    ];
    for (const env of cases) assert.throws(() => parseConfig(env));
  });

  it("allows local http origins and the test identity provider outside production", () => {
    const config = parseConfig({
      BACKOFFICE_ENVIRONMENT: "test",
      BACKOFFICE_ORIGIN: "http://127.0.0.1:3221",
      AUTH_TEST_ISSUER: "http://127.0.0.1:8218",
      DATABASE_URL: "postgres://u:p@127.0.0.1:5432/bo_test_unit",
      OPS_API_URL: "http://127.0.0.1:8217/",
      OPS_READ_TOKEN: "t".repeat(40),
    });
    assert.equal(config.testIssuer, "http://127.0.0.1:8218");
    assert.equal(config.ops?.url, "http://127.0.0.1:8217");
  });

  it("treats NODE_ENV=production as production unless explicitly a loopback test", () => {
    const { BACKOFFICE_ENVIRONMENT: _, ...implicit } = production;
    assert.equal(parseConfig({ ...implicit, NODE_ENV: "production" }).environment, "production");
    assert.throws(
      () => parseConfig({ NODE_ENV: "production" }),
      /BACKOFFICE_ORIGIN|BETTER_AUTH_SECRET|OWNER_EMAIL|DATABASE_URL/,
    );
    assert.throws(
      () =>
        parseConfig({ ...implicit, NODE_ENV: "production", BACKOFFICE_ENVIRONMENT: "development" }),
      /refused/,
    );
    assert.throws(() =>
      parseConfig({
        NODE_ENV: "production",
        BACKOFFICE_ENVIRONMENT: "test",
        BACKOFFICE_ORIGIN: "https://bo.example.test",
      }),
    );
    assert.equal(
      parseConfig({ NODE_ENV: "production", BACKOFFICE_ENVIRONMENT: "test" }).environment,
      "test",
    );
  });

  it("reads the build VERSION label; a malformed one reads unknown and never stops the server", () => {
    assert.equal(parseConfig(production).version, "0.0.0-dev");
    assert.equal(parseConfig({ ...production, VERSION: "1.4.0+abc.1" }).version, "1.4.0+abc.1");
    for (const bad of ["", " 1.0", "1.0\nx", "-1", "v".repeat(65), "1.0/../x", "22.04 LTS (Jammy)"])
      assert.equal(parseConfig({ ...production, VERSION: bad }).version, "unknown", bad);
  });

  it("never uses a fixed secret outside test", () => {
    assert.throws(
      () => parseConfig({ BACKOFFICE_ENVIRONMENT: "development" }),
      /BETTER_AUTH_SECRET/,
    );
    assert.throws(() => parseConfig({}), /BETTER_AUTH_SECRET/);
    const test = parseConfig({ BACKOFFICE_ENVIRONMENT: "test" });
    assert.match(test.authSecret, /test-only/);
  });

  it("allows http for the ops API only to a private-network service name or an allowlisted host", () => {
    const token = "t".repeat(40);
    const ok = (url: string, extra: Record<string, string> = {}) =>
      parseConfig({ ...production, OPS_API_URL: url, OPS_READ_TOKEN: token, ...extra }).ops?.url;
    assert.equal(
      ok("http://pequeverso-assistant-api:8000"),
      "http://pequeverso-assistant-api:8000",
    );
    assert.equal(ok("https://ops.example.test"), "https://ops.example.test");
    assert.throws(() => ok("http://ops.example.test"));
    assert.throws(() => ok("http://203.0.113.5:8000"));
    assert.throws(() => ok("http://localhost:8000"));
    assert.equal(
      ok("http://api.internal:8000", { OPS_API_INSECURE_INTERNAL_HOSTS: "api.internal" }),
      "http://api.internal:8000",
    );
  });

  it("accepts valid proxy IPs and CIDRs at the existing width boundaries", () => {
    const valid = [
      "10.0.1.5",
      "::1",
      "2001:db8::1",
      "::ffff:192.0.2.1",
      "10.0.0.0/8",
      "10.0.1.5/32",
      "2001:db8::/16",
      "2001:db8::1/128",
    ];
    assert.deepEqual(
      parseConfig({ ...production, TRUSTED_PROXY_IPS: ` ${valid.join(", ")}, ` }).trustedProxies,
      valid,
    );
    assert.deepEqual(parseConfig(production).trustedProxies, []);
  });

  it("rejects malformed proxy IP literals before production can start", () => {
    for (const bad of [
      "proxy.local",
      "::::",
      "::::/32",
      "2001:::1",
      "1:2:3:4:5:6:7:8:9",
      "999.0.0.1",
      "01.2.3.4",
      "10.0.1.5/24/24",
    ])
      assert.throws(
        () => parseConfig({ ...production, TRUSTED_PROXY_IPS: bad }),
        /TRUSTED_PROXY_IPS/,
      );
  });

  it("rejects unsupported proxy CIDR widths and nondecimal notation", () => {
    for (const bad of [
      "0.0.0.0/0",
      "10.0.0.0/7",
      "10.0.0.1/33",
      "::1/0",
      "::1/15",
      "::1/129",
      "::1/1e2",
      "10.0.0.1/3.2",
      "10.0.0.1/+24",
      "10.0.0.1/",
      "::1/-1",
      "::1/ 32",
    ])
      assert.throws(
        () => parseConfig({ ...production, TRUSTED_PROXY_IPS: bad }),
        /TRUSTED_PROXY_IPS/,
      );
  });

  it("error messages never echo configured values", () => {
    try {
      parseConfig({
        ...production,
        OPS_API_URL: "http://u:SECRETVALUE@x.example/",
        OPS_READ_TOKEN: "t".repeat(40),
      });
      assert.fail("expected a refusal");
    } catch (error) {
      assert.doesNotMatch(String(error), /SECRETVALUE/);
    }
  });

  it("reports the first invalid configuration group using only its setting names", () => {
    const env = {
      ...production,
      GITHUB_CLIENT_SECRET: "",
      AUTH_TEST_ISSUER: "http://localhost",
      AUTH_DISABLE_RATE_LIMIT: "1",
      OPS_API_URL: "not a URL",
      OPS_READ_TOKEN: "short",
      PRODUCT_ANALYTICS_READ_ENABLED: "yes",
      OPS_TELEMETRY_ENABLED: "yes",
    };
    assert.throws(() => parseConfig(env), { message: "GitHub needs both client id and secret" });
    env.GITHUB_CLIENT_SECRET = production.GITHUB_CLIENT_SECRET;
    assert.throws(() => parseConfig(env), {
      message: "AUTH_TEST_ISSUER is not allowed in production",
    });
    env.AUTH_TEST_ISSUER = "";
    assert.throws(() => parseConfig(env), {
      message: "AUTH_DISABLE_RATE_LIMIT is not allowed in production",
    });
    env.AUTH_DISABLE_RATE_LIMIT = "";
    assert.throws(() => parseConfig(env), { message: "OPS_API_URL must be an absolute URL" });
    env.OPS_API_URL = "https://ops.example.test/path?private";
    assert.throws(() => parseConfig(env), {
      message: "OPS_API_URL must not carry credentials, query or fragment",
    });
    env.OPS_API_URL = "https://ops.example.test/path";
    assert.throws(() => parseConfig(env), {
      message: "OPS_READ_TOKEN must have at least 32 characters",
    });
    env.OPS_READ_TOKEN = "t".repeat(32);
    assert.throws(() => parseConfig(env), {
      message: "PRODUCT_ANALYTICS_READ_ENABLED must be true or false",
    });
  });

  it("validates observability switches and credentials before the trace exporter", () => {
    const env = {
      ...production,
      OBSERVABILITY_METRICS_ENABLED: "true",
      OBSERVABILITY_TRACES_ENABLED: "yes",
      OBSERVABILITY_READ_TOKEN: "",
      OBSERVABILITY_OTLP_TRACES_ENDPOINT: "invalid",
      OTEL_EXPORTER_OTLP_HEADERS: "synthetic",
    };
    const invalidToken = {
      message: "OBSERVABILITY_READ_TOKEN must be a private token of 32–256 characters",
    };
    assert.throws(() => parseConfig(env), {
      message: "OBSERVABILITY_TRACES_ENABLED must be true or false",
    });
    env.OBSERVABILITY_TRACES_ENABLED = "true";
    for (const token of ["", "m".repeat(31), "m".repeat(257), `${"m".repeat(32)} x`]) {
      assert.throws(() => parseConfig({ ...env, OBSERVABILITY_READ_TOKEN: token }), invalidToken);
    }
    env.OBSERVABILITY_READ_TOKEN = "m".repeat(256);
    assert.throws(
      () =>
        parseConfig({
          ...env,
          OPS_API_URL: "https://ops.test",
          OPS_READ_TOKEN: env.OBSERVABILITY_READ_TOKEN,
        }),
      { message: "OBSERVABILITY_READ_TOKEN must differ from OPS_READ_TOKEN" },
    );
    assert.throws(() => parseConfig(env), {
      message: "Use only OBSERVABILITY_* settings for the isolated trace exporter",
    });
    env.OTEL_EXPORTER_OTLP_HEADERS = "";
    assert.throws(() => parseConfig(env), {
      message: "OBSERVABILITY_OTLP_TRACES_ENDPOINT must be an absolute endpoint",
    });
    assert.deepEqual(parseConfig({ ...env, OBSERVABILITY_TRACES_ENABLED: "false" }).observability, {
      metricsToken: env.OBSERVABILITY_READ_TOKEN,
      otlpEndpoint: null,
    });
  });

  it("bounds trace endpoints to the existing protocols, origins and path", () => {
    const env = {
      ...production,
      OBSERVABILITY_TRACES_ENABLED: "true",
      OBSERVABILITY_METRICS_ENABLED: "",
      OBSERVABILITY_READ_TOKEN: "ignored",
    };
    const readEndpoint = (endpoint: string) =>
      parseConfig({ ...env, OBSERVABILITY_OTLP_TRACES_ENDPOINT: endpoint }).observability;
    for (const endpoint of [
      "https://collector.example.test/v1/traces",
      "http://collector/v1/traces",
    ])
      assert.deepEqual(readEndpoint(` ${endpoint} `), {
        metricsToken: null,
        otlpEndpoint: endpoint,
      });
    for (const endpoint of [
      "https://collector/v1/metrics",
      "https://user@collector/v1/traces",
      "https://:synthetic@collector/v1/traces",
      "https://collector/v1/traces?synthetic",
      "https://collector/v1/traces#synthetic",
      "ftp://collector/v1/traces",
      "http://collector.example.test/v1/traces",
      "http://localhost/v1/traces",
      "http://127.0.0.1/v1/traces",
    ])
      assert.throws(() => readEndpoint(endpoint), {
        message:
          "OBSERVABILITY_OTLP_TRACES_ENDPOINT needs https or a private service and /v1/traces",
      });
    for (const host of ["localhost", "127.0.0.1"]) {
      const endpoint = `http://${host}/v1/traces`;
      assert.equal(
        parseConfig({
          BACKOFFICE_ENVIRONMENT: "test",
          OBSERVABILITY_TRACES_ENABLED: "true",
          OBSERVABILITY_OTLP_TRACES_ENDPOINT: endpoint,
        }).observability.otlpEndpoint,
        endpoint,
      );
    }
  });
});
