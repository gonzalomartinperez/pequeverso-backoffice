// Documentation table for docs/reference/env.md (scripts/generate-env.ts). Descriptive only: the
// parser in env-parse.ts is the behaviour, and tests/unit/env-doc.test.ts keeps both in step.
export type EnvironmentVariable = readonly [
  name: string,
  requirement: "Optional" | "Required" | `Required ${string}`,
  defaultValue: string,
  purpose: string,
];

/** Documentation metadata for the runtime parser, delegated settings and Next.js listener. */
export const ENVIRONMENT_VARIABLES = {
  runtime: [
    [
      "NODE_ENV",
      "Optional",
      "—",
      "When `production`, selects production mode by default and restricts test mode to a loopback origin.",
    ],
    [
      "BACKOFFICE_ENVIRONMENT",
      "Optional",
      "`production` if `NODE_ENV=production`, otherwise `development`",
      "Selects `development`, `test` or `production`. A production build refuses development mode.",
    ],
    [
      "BACKOFFICE_ORIGIN",
      "Required in production",
      "`http://localhost:3201` outside production",
      "Exact public origin for the app and OAuth callbacks. Production requires HTTPS.",
    ],
    [
      "BETTER_AUTH_SECRET",
      "Required outside test mode",
      "Built-in test secret in test mode",
      "Better Auth signing secret. Supply at least 32 characters outside test mode.",
    ],
    [
      "DATABASE_URL",
      "Required in production and with test-only auth settings",
      "`postgres://localhost:5432/backoffice` outside production",
      "Backoffice PostgreSQL connection string. Test-only auth settings require an explicit disposable loopback database.",
    ],
    [
      "OWNER_EMAIL",
      "Required in production",
      "—",
      "Provider-verified email admitted as owner without an invitation.",
    ],
    [
      "GOOGLE_CLIENT_ID",
      "Required when configuring Google",
      "—",
      "Google OAuth client ID. Set with `GOOGLE_CLIENT_SECRET`.",
    ],
    [
      "GOOGLE_CLIENT_SECRET",
      "Required when configuring Google",
      "—",
      "Google OAuth client secret. Set with `GOOGLE_CLIENT_ID`.",
    ],
    [
      "GITHUB_CLIENT_ID",
      "Required when configuring GitHub",
      "—",
      "GitHub OAuth client ID. Set with `GITHUB_CLIENT_SECRET`.",
    ],
    [
      "GITHUB_CLIENT_SECRET",
      "Required when configuring GitHub",
      "—",
      "GitHub OAuth client secret. Set with `GITHUB_CLIENT_ID`.",
    ],
    [
      "AUTH_TEST_ISSUER",
      "Optional",
      "—",
      "Loopback fake OIDC issuer for automated tests. Refused in production.",
    ],
    [
      "AUTH_DISABLE_RATE_LIMIT",
      "Optional",
      "Limiter enabled",
      "Set to `1` to disable per-IP sign-in rate limiting for automated tests. Refused in production.",
    ],
    [
      "OPS_API_URL",
      "Required when setting `OPS_READ_TOKEN`",
      "—",
      "Private operations API base URL. Use HTTPS or an allowed internal HTTP host.",
    ],
    [
      "OPS_READ_TOKEN",
      "Required when setting `OPS_API_URL`",
      "—",
      "Private operations API bearer token of at least 32 characters.",
    ],
    [
      "OPS_API_INSECURE_INTERNAL_HOSTS",
      "Optional",
      "—",
      "Comma-separated additional internal hosts allowed for HTTP operations API requests.",
    ],
    [
      "OPS_TELEMETRY_ENABLED",
      "Optional",
      "`false`",
      "Enables reads of private operational telemetry when set to `true`.",
    ],
    [
      "PRODUCT_ANALYTICS_READ_ENABLED",
      "Optional",
      "`false`",
      "Enables reads of private product analytics aggregates when set to `true`.",
    ],
    [
      "TRUSTED_PROXY_IPS",
      "Optional",
      "No trusted proxies",
      "Comma-separated IP addresses or narrow CIDRs trusted to supply `X-Forwarded-For`.",
    ],
    [
      "VERSION",
      "Optional",
      "`0.0.0-dev`",
      "Build label set by the image (`ARG VERSION`); reported as `version` by `/healthz` and `/readyz`.",
    ],
  ],
  observability: [
    [
      "OBSERVABILITY_METRICS_ENABLED",
      "Optional",
      "`false`",
      "Enables the private metrics endpoint when set to `true`.",
    ],
    [
      "OBSERVABILITY_READ_TOKEN",
      "Required when metrics are enabled",
      "—",
      "Private metrics bearer token of 32–256 characters without whitespace. Must differ from `OPS_READ_TOKEN`.",
    ],
    [
      "OBSERVABILITY_TRACES_ENABLED",
      "Optional",
      "`false`",
      "Enables the isolated trace exporter when set to `true`. Ambient `OTEL_*` settings are refused while enabled.",
    ],
    [
      "OBSERVABILITY_OTLP_TRACES_ENDPOINT",
      "Required when traces are enabled",
      "—",
      "Private OTLP HTTP JSON endpoint at `/v1/traces`. Use HTTPS or an allowed internal HTTP host.",
    ],
  ],
  next: [
    ["PORT", "Optional", "`3000`", "Listening port for the standalone Next.js server."],
    ["HOSTNAME", "Optional", "`0.0.0.0`", "Listening host for the standalone Next.js server."],
  ],
} as const satisfies Record<string, readonly EnvironmentVariable[]>;
