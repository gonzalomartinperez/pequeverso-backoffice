import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { calendarWindow } from "../../src/features/analytics/adapters/calendar.ts";
import { parseAnalyticsReport } from "../../src/features/analytics/adapters/validate.ts";
import { countryCodes } from "../../src/features/analytics/domain/countries.ts";
import {
  defaultSelection,
  profileSource,
  type Selection,
} from "../../src/features/analytics/domain/report.ts";
import { reportSelection } from "../../src/features/analytics/domain/selection.ts";
import { parseConfig } from "../../src/server/parse-config.ts";

const example = JSON.parse(
  readFileSync(
    new URL("../../contracts/analytics/product-analytics.example.json", import.meta.url),
    "utf8",
  ),
);
const selection: Selection = example.report.selection;
describe("private analytics contract", () => {
  it("verifies all five committed producer artifact bytes and the owned profile", () => {
    const source = JSON.parse(readFileSync("contracts/analytics/source.json", "utf8"));
    assert.match(source.api_revision, /^[a-f0-9]{40}$/);
    assert.equal(source.api_repository, "gonzalomartinperez/pequeverso-assistant-api");
    assert.equal(Object.keys(source.files).length, 5);
    for (const file of Object.values(source.files) as { local: string; sha256: string }[]) {
      assert.ok(file.local.startsWith("contracts/analytics/"));
      assert.equal(
        createHash("sha256").update(readFileSync(file.local)).digest("hex"),
        file.sha256,
      );
    }
    const profile = JSON.parse(readFileSync("contracts/analytics/profile.source.json", "utf8"));
    assert.equal(profile.profile_source_revision, profileSource);
    assert.equal(profile.source_repository, "gonzalomartinperez/pequeverso");
    assert.equal(profile.country_collection, "disabled");
    const schema = JSON.parse(
      readFileSync("contracts/analytics/product-analytics.schema.json", "utf8"),
    );
    assert.equal(schema.properties.synthetic.type, "boolean");
    assert.equal(schema.additionalProperties, false);
    assert.equal(countryCodes.length, 249);
    assert.deepEqual(schema.$defs.Country.properties.code.enum, [
      ...countryCodes,
      "unknown",
      "withheld",
    ]);
    assert.equal(
      createHash("sha256").update(JSON.stringify(countryCodes)).digest("hex"),
      source.derived_country_codes.labels_sha256,
    );
  });
  it("accepts the committed Peque report and keeps country events distinct from page views", () => {
    const report = parseAnalyticsReport(example.report, selection);
    assert.equal(report.synthetic, true);
    assert.equal(report.totals.page_views, 2);
    assert.deepEqual(report.countries, [{ code: "unknown", count: 9 }]);
    assert.equal(report.grid.visible_clicks + report.grid.withheld_clicks, 4);
    assert.throws(() => parseAnalyticsReport(example, selection));
  });
  it("rejects unknown fields, invalid classifications, wrong identities and inconsistent aggregates", () => {
    const mutations: ((r: typeof example.report) => void)[] = [
      (r) => {
        r.unrecognized = 1;
      },
      (r) => {
        r.synthetic = "false";
      },
      (r) => {
        r.project = "portfolio";
      },
      (r) => {
        r.profile_source_revision = "0".repeat(40);
      },
      (r) => {
        r.retention_days = 90;
      },
      (r) => {
        r.country_collection = "proxy";
      },
      (r) => {
        r.totals.page_views = true;
      },
      (r) => {
        r.totals.public_clicks = -1;
      },
      (r) => {
        r.daily[0].page_views = 1;
      },
      (r) => {
        r.daily.push(r.daily[0]);
      },
      (r) => {
        r.daily[0].day = "2026-02-30";
      },
      (r) => {
        r.countries[0].count = 2;
      },
      (r) => {
        r.countries[0].code = "ZZ";
      },
      (r) => {
        r.grid.cells[0].count = 2;
      },
      (r) => {
        r.grid.cells.push(r.grid.cells[0]);
      },
      (r) => {
        r.grid.cells[0].x = 8;
      },
      (r) => {
        r.grid.unselected_clicks = 1;
      },
      (r) => {
        r.grid.available = false;
      },
      (r) => {
        r.first_observed_at = null;
      },
      (r) => {
        r.last_observed_at = "2026-10-19T12:00:00Z";
      },
      (r) => {
        r.start = "2026-10-17T00:00:00Z";
      },
      (r) => {
        r.partial = false;
      },
      (r) => {
        r.selection.viewport_bucket = "mobile";
      },
    ];
    for (const mutate of mutations) {
      const report = structuredClone(example.report);
      mutate(report);
      assert.throws(() => parseAnalyticsReport(report, selection));
    }
  });
  it("shares the producer UTC calendar fixtures without importing any server/header trust into BO", () => {
    const shared = JSON.parse(
      readFileSync("contracts/analytics/analytics-semantics.examples.json", "utf8"),
    );
    assert.equal(shared.fixture, true);
    assert.equal(shared.country_cases.length, 14);
    assert.equal(shared.periods.length, 8);
    for (const row of shared.periods) {
      const window = calendarWindow(row.instant, {
        ...defaultSelection,
        period: row.period,
        offset: row.offset,
      });
      assert.equal(window.start.slice(0, 10), row.start);
      assert.equal(window.end.slice(0, 10), row.end);
      assert.equal(window.partial, row.partial);
    }
  });
  it("accepts both dataset classes without treating proxy configuration as provenance", () => {
    for (const synthetic of [true, false])
      for (const country_collection of ["disabled", "trusted_proxy_header"]) {
        const report = { ...structuredClone(example.report), synthetic, country_collection };
        const parsed = parseAnalyticsReport(report, selection);
        assert.equal(parsed.synthetic, synthetic);
        assert.equal(parsed.country_collection, country_collection);
      }
  });
  it("accepts historical country buckets with collection OFF and merged small groups", () => {
    const report = structuredClone(example.report);
    report.countries = [
      { code: "AR", count: 5 },
      { code: "withheld", count: 4 },
    ];
    assert.deepEqual(parseAnalyticsReport(report, selection).countries, report.countries);
    report.countries = [
      { code: "AR", count: 3 },
      { code: "unknown", count: 3 },
      { code: "withheld", count: 3 },
    ];
    assert.deepEqual(parseAnalyticsReport(report, selection).countries, report.countries);
    for (const countries of [
      [
        { code: "AR", count: 2 },
        { code: "withheld", count: 7 },
      ],
      [
        { code: "unknown", count: 2 },
        { code: "withheld", count: 7 },
      ],
      [
        { code: "AR", count: 3 },
        { code: "AR", count: 6 },
      ],
      [
        { code: "BR", count: 3 },
        { code: "AR", count: 6 },
      ],
      [
        { code: "unknown", count: 3 },
        { code: "AR", count: 6 },
      ],
      [
        { code: "withheld", count: 3 },
        { code: "unknown", count: 6 },
      ],
      [{ code: "ZZ", count: 9 }],
      [{ code: "ar", count: 9 }],
      [{ code: "US", count: 8 }],
    ])
      assert.throws(() => parseAnalyticsReport({ ...report, countries }, selection));
  });
  it("accepts the full closed country set while keeping the aggregate and row bounds", () => {
    const report = structuredClone(example.report);
    report.totals.page_views = 743;
    report.daily = [{ ...report.totals, day: "2026-10-18" }];
    report.countries = [...countryCodes, "unknown"].map((code) => ({ code, count: 3 }));
    assert.equal(parseAnalyticsReport(report, selection).countries.length, 250);
    assert.throws(() =>
      parseAnalyticsReport(
        { ...report, countries: [...report.countries, { code: "withheld", count: 1 }] },
        selection,
      ),
    );
  });
  it("accepts empty and withheld-country reports without inventing data", () => {
    for (const amount of [0, 1, 2, 3]) {
      const report = structuredClone(example.report);
      report.totals = { page_views: amount, section_views: 0, public_clicks: 0 };
      report.daily = amount ? [{ ...report.totals, day: "2026-10-18" }] : [];
      report.countries = amount
        ? [{ code: amount < 3 ? "withheld" : "unknown", count: amount }]
        : [];
      report.first_observed_at = amount ? report.generated_at : null;
      report.last_observed_at = amount ? report.generated_at : null;
      report.grid = {
        available: true,
        visible_clicks: 0,
        withheld_clicks: 0,
        unselected_clicks: 0,
        cells: [],
      };
      assert.equal(parseAnalyticsReport(report, selection).totals.page_views, amount);
    }
  });
  it("requires exact route and section for a grid and reconciles unselected clicks", () => {
    const report = structuredClone(example.report);
    report.selection.route = "all";
    report.selection.section_id = "all";
    report.grid = {
      available: false,
      visible_clicks: 0,
      withheld_clicks: 0,
      unselected_clicks: 4,
      cells: [],
    };
    const expected = { ...selection, route: "all", section_id: "all" } as const;
    assert.equal(parseAnalyticsReport(report, expected).grid.available, false);
    report.grid.withheld_clicks = 1;
    assert.throws(() => parseAnalyticsReport(report, expected));
  });
  it("accepts an approved section across all routes without inventing a blended grid", () => {
    for (const section of ["hero", "leer", "bebe", "preguntas", "incluye", "metodo"])
      assert.equal(reportSelection({ route: "all", section_id: section })?.section_id, section);
    const report = structuredClone(example.report);
    report.selection.route = "all";
    report.grid = {
      available: false,
      visible_clicks: 0,
      withheld_clicks: 0,
      unselected_clicks: 4,
      cells: [],
    };
    const expected = { ...selection, route: "all" } as const;
    const parsed = parseAnalyticsReport(report, expected);
    assert.equal(parsed.totals.public_clicks, 4);
    assert.equal(parsed.grid.available, false);
    assert.equal(parsed.grid.unselected_clicks, parsed.totals.public_clicks);
    assert.deepEqual(parsed.grid.cells, []);
  });
  it("rejects duplicate/unknown query parameters and invalid profile pairs", () => {
    assert.deepEqual(reportSelection({}), defaultSelection);
    assert.equal(reportSelection({ offset: ["0", "1"] }), null);
    for (const params of [
      { unknown: "x" },
      { offset: "01" },
      { locale: "en" },
      { route: "/bad/" },
      { route: "all", section_id: "unknown" },
      { route: "/", section_id: "metodo" },
    ])
      assert.equal(reportSelection(params), null);
    assert.equal(
      reportSelection({ route: "/grafismo-fonetico/", section_id: "metodo" })?.section_id,
      "metodo",
    );
  });
  it("uses actual UTC leap, ISO week, month and year boundaries for eight calendar cases", () => {
    const cases = [
      ["2024-03-01T00:00:00Z", "day", 1, "2024-02-29", "2024-03-01"],
      ["2021-01-01T12:00:00Z", "week", 0, "2020-12-28", "2021-01-04"],
      ["2026-03-10T12:00:00Z", "month", 1, "2026-02-01", "2026-03-01"],
      ["2026-03-10T12:00:00Z", "month", 2, "2026-01-01", "2026-02-01"],
      ["2026-01-01T00:00:00Z", "day", 1, "2025-12-31", "2026-01-01"],
      ["2026-10-18T12:00:00Z", "week", 1, "2026-10-05", "2026-10-12"],
      ["2026-10-18T12:00:00Z", "day", 0, "2026-10-18", "2026-10-19"],
      ["2026-01-01T12:00:00Z", "month", 2, "2025-11-01", "2025-12-01"],
    ] as const;
    for (const [time, period, offset, start, end] of cases) {
      const window = calendarWindow(time, { ...defaultSelection, period, offset });
      assert.equal(window.start, `${start}T00:00:00.000Z`);
      assert.equal(window.end, `${end}T00:00:00.000Z`);
      assert.equal(window.partial, offset === 0);
    }
  });
  it("defaults reads off in every environment and allows explicit production opt-in", () => {
    assert.equal(parseConfig({ BACKOFFICE_ENVIRONMENT: "test" }).analyticsReadEnabled, false);
    assert.equal(
      parseConfig({ BACKOFFICE_ENVIRONMENT: "test", PRODUCT_ANALYTICS_READ_ENABLED: "true" })
        .analyticsReadEnabled,
      true,
    );
    assert.throws(() =>
      parseConfig({ BACKOFFICE_ENVIRONMENT: "test", PRODUCT_ANALYTICS_READ_ENABLED: "yes" }),
    );
    assert.equal(
      parseConfig({
        NODE_ENV: "production",
        BACKOFFICE_ORIGIN: "https://fixture.invalid",
        BETTER_AUTH_SECRET: "fixture-secret-".repeat(4),
        DATABASE_URL: "postgres://fixture:fixture@database/backoffice",
        OWNER_EMAIL: "owner@fixture.invalid",
        GOOGLE_CLIENT_ID: "fixture",
        GOOGLE_CLIENT_SECRET: "fixture",
        PRODUCT_ANALYTICS_READ_ENABLED: "true",
      }).analyticsReadEnabled,
      true,
    );
  });
});
