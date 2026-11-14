import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import fc from "fast-check";
import { parseAnalyticsReport } from "../../src/features/analytics/adapters/validate.ts";
import type { Selection } from "../../src/features/analytics/domain/report.ts";
import { parseOpsTelemetry } from "../../src/features/operations/adapters/telemetry-validate.ts";
import {
  OpsPayloadError,
  parseOpsSummary,
} from "../../src/features/operations/adapters/validate.ts";
import { propertyOptions } from "./support/property.ts";

type Row = Record<string, unknown>;
type Path = string[];
const load = (path: string) => JSON.parse(readFileSync(`contracts/${path}`, "utf8"));
const analytics = load("analytics/product-analytics.example.json").report;
const suites = [
  { name: "ops", example: load("ops/ops.summary.example.json"), parse: parseOpsSummary },
  {
    name: "telemetry",
    example: load("telemetry/ops.telemetry.example.json"),
    parse: parseOpsTelemetry,
  },
  {
    name: "analytics",
    example: analytics,
    parse: (value: unknown) => parseAnalyticsReport(value, analytics.selection as Selection),
  },
];

// All existing fields, including nested array entries, are mutation targets.
function paths(value: unknown, prefix: Path = []): Path[] {
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = [...prefix, key];
    return [path, ...paths(child, path)];
  });
}
function at(root: Row, path: Path): Row {
  return path.reduce<Row>((row, key) => row[key] as Row, root);
}
function safeModel(value: unknown): void {
  if (value === null) return;
  if (value instanceof Date) assert.ok(Number.isFinite(value.getTime()));
  else if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (typeof value === "object") for (const child of Object.values(value)) safeModel(child);
  else assert.ok(typeof value === "string" || typeof value === "boolean");
}

const replacements = {
  "wrong type": fc.constant(null), // Replaced below with a guaranteed different type.
  NaN: fc.constant(Number.NaN),
  negative: fc.integer({ min: -2147483648, max: -1 }),
  oversized: fc.integer({ min: 4096, max: 16384 }).map((length) => "x".repeat(length)),
  "lone surrogate and non-UTF8-like text": fc.constantFrom(
    "\ud800",
    "\udfff",
    "\ufffd\u0000\u00c0\u00af",
  ),
  nesting: fc.integer({ min: 1, max: 20 }).map((depth) => {
    let value: unknown = "nested";
    for (let i = 0; i < depth; i++) value = { nested: [value] };
    return value;
  }),
};

for (const suite of suites) {
  const targets = paths(suite.example);
  const objects = [
    [],
    ...targets.filter((path) => {
      const value = at(suite.example, path);
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }),
  ];
  const baseline = suite.parse(suite.example);
  test(`${suite.name}: committed synthetic example is accepted`, () => {
    safeModel(baseline);
    assert.deepEqual(suite.parse(structuredClone(suite.example)), baseline);
  });

  function check(payload: unknown): void {
    let model: unknown;
    try {
      model = suite.parse(payload);
    } catch (error) {
      // Analytics deliberately uses a plain Error; matching its exact API excludes
      // TypeError, RangeError and assertion failures instead of swallowing them.
      if (suite.name === "analytics") {
        assert.ok(error instanceof Error && error.constructor === Error);
        assert.equal(error.message, "Invalid analytics aggregate");
      } else assert.ok(error instanceof OpsPayloadError);
      return;
    }
    safeModel(model);
    assert.equal(typeof model, "object");
    assert.ok(model !== null);
    assert.deepEqual(suite.parse(payload), model);
    if (suite.name === "analytics") assert.deepEqual(suite.parse(model), model);
  }

  for (const [name, arbitrary] of Object.entries(replacements)) {
    test(`${suite.name}: fuzz ${name}`, () => {
      fc.assert(
        fc.property(fc.constantFrom(...targets), arbitrary, (path, replacement) => {
          const payload = structuredClone(suite.example);
          const parent = at(payload, path.slice(0, -1));
          const key = path.at(-1);
          assert.ok(key !== undefined);
          parent[key] =
            name === "wrong type"
              ? typeof parent[key] === "string"
                ? 42
                : "wrong type"
              : replacement;
          check(payload);
        }),
        propertyOptions("fuzz"),
      );
    });
  }
  test(`${suite.name}: fuzz unknown fields at every object level`, () => {
    fc.assert(
      fc.property(fc.constantFrom(...objects), fc.jsonValue(), (path, value) => {
        const payload = structuredClone(suite.example);
        at(payload, path).__fuzz_unknown = value;
        check(payload);
      }),
      propertyOptions("fuzz"),
    );
  });
  test(`${suite.name}: fuzz deletion including required schema version`, () => {
    fc.assert(
      fc.property(fc.constantFrom(...targets), (path) => {
        const payload = structuredClone(suite.example);
        const key = path.at(-1);
        assert.ok(key !== undefined);
        delete at(payload, path.slice(0, -1))[key];
        check(payload);
        delete payload.schema_version;
        assert.throws(() => suite.parse(payload));
      }),
      propertyOptions("fuzz"),
    );
  });
}
