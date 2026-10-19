import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import ts from "@typescript/typescript6";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseAnalyticsReport } from "../../src/features/analytics/adapters/validate.ts";
import { defaultSelection } from "../../src/features/analytics/domain/report.ts";

// Native Node does not parse JSX. Compile the real owned presentation modules, without a server.
const sourceRoot = new URL("../../src/", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    // Match the existing project alias used by the real shared section primitive.
    if (specifier === "@/shared/ui/cn")
      return nextResolve(new URL("../../src/shared/ui/cn.ts", import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    return nextLoad(url, context);
  },
});
const { AnalyticsReport } = await import("../../src/features/analytics/presentation/report.tsx");
hooks.deregister();
const fixture = JSON.parse(
  readFileSync(
    new URL("../../contracts/analytics/product-analytics.example.json", import.meta.url),
    "utf8",
  ),
).report;

test("real report markup distinguishes synthetic and production-class data with accessible tables", () => {
  for (const synthetic of [true, false]) {
    const report = parseAnalyticsReport({ ...fixture, synthetic }, fixture.selection);
    const html = renderToStaticMarkup(
      createElement(AnalyticsReport, {
        reading: { status: "available", report },
        selection: report.selection,
      }),
    );
    assert.ok(
      html.includes(
        synthetic ? "Datos sintéticos." : "Datos clasificados como producción por la API.",
      ),
    );
    assert.equal(html.includes("Datos sintéticos."), synthetic);
    assert.equal((html.match(/<table\b/g) ?? []).length, 3);
    assert.equal((html.match(/<caption\b/g) ?? []).length, 3);
    assert.ok(html.includes("Esta vista no activa la"));
    assert.ok(html.includes("Puede haber agregados históricos con país"));
  }
});
test("real production country markup retains merged withholding and discloses config uncertainty", () => {
  const report = parseAnalyticsReport(
    {
      ...fixture,
      synthetic: false,
      country_collection: "trusted_proxy_header",
      countries: [
        { code: "AR", count: 5 },
        { code: "withheld", count: 4 },
      ],
    },
    fixture.selection,
  );
  const html = renderToStaticMarkup(
    createElement(AnalyticsReport, {
      reading: { status: "available", report },
      selection: report.selection,
    }),
  );
  assert.ok(html.includes('<th scope="row"'));
  assert.ok(html.includes("AR"));
  assert.ok(html.includes("menos de 3 por país"));
  assert.ok(html.includes("Esta vista no verifica el proxy ni la procedencia de cada evento"));
});
test("disabled and unavailable markup do not invent a dataset classification or counts", () => {
  for (const reading of [
    { status: "disabled" },
    { status: "unavailable", reason: "invalid_or_unreachable" },
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(AnalyticsReport, {
        reading,
        selection: defaultSelection,
      }),
    );
    assert.ok(html.includes("Sin clasificación de datos disponible."));
    assert.ok(html.includes('role="status"'));
    assert.equal(html.includes("<table"), false);
    assert.equal(html.includes("Datos sintéticos."), false);
    assert.equal(html.includes("Datos clasificados como producción"), false);
  }
});
