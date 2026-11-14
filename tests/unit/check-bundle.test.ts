import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import {
  findViolations,
  measureBundle,
  RECHARTS_MARKER,
  renderMarkdown,
} from "../../scripts/check-bundle.ts";

// SYNTHETIC fixture: a miniature Next 16 webpack build output, not real build data.
const files: Record<string, string> = {
  "static/chunks/main.js": "m".repeat(2000),
  "static/chunks/shared.js": "s".repeat(3000),
  "static/chunks/charts.js": `x${RECHARTS_MARKER}wrapper`.repeat(500),
  "static/chunks/app/a/page.js": "a".repeat(1000),
  "static/chunks/app/b/page.js": "b".repeat(1500),
};
const gz = (key: string) => gzipSync(Buffer.from(files[key] ?? ""), { level: 9 }).length;

function clientManifest(route: string, chunks: string[][]): string {
  const clientModules = Object.fromEntries(
    chunks.map((list, index) => [`/src/m${index}.tsx`, { id: index, name: "*", chunks: list }]),
  );
  return `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(route)}]=${JSON.stringify({ clientModules })}`;
}

function fixture(): { dist: string; publicDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "bundle-"));
  const dist = join(root, ".next");
  const publicDir = join(root, "public");
  const put = (path: string, body: string | Buffer) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  };
  for (const [key, body] of Object.entries(files)) put(join(dist, key), body);
  put(
    join(dist, "build-manifest.json"),
    JSON.stringify({
      rootMainFiles: ["static/chunks/main.js"],
      polyfillFiles: ["static/chunks/polyfills.js"],
    }),
  );
  put(
    join(dist, "server/app-paths-manifest.json"),
    JSON.stringify({
      "/a/page": "app/a/page.js",
      "/b/page": "app/b/page.js",
      "/page": "app/page.js",
      "/healthz/route": "app/healthz/route.js",
    }),
  );
  put(
    join(dist, "server/app/a/page_client-reference-manifest.js"),
    clientManifest("/a/page", [
      ["1", "static/chunks/shared.js", "2", "static/chunks/app/a/page.js"],
      ["1", "static/chunks/shared.js"],
      [],
    ]),
  );
  put(
    join(dist, "server/app/b/page_client-reference-manifest.js"),
    clientManifest("/b/page", [
      ["1", "static/chunks/shared.js", "3", "static/chunks/charts.js"],
      ["4", "static/chunks/app/b/page.js"],
    ]),
  );
  put(join(dist, "server/app/page_client-reference-manifest.js"), clientManifest("/page", []));
  put(join(publicDir, "fonts/a.woff2"), Buffer.alloc(1000));
  put(join(publicDir, "fonts/OFL.txt"), "licence");
  return { dist, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("check-bundle", () => {
  it("sums each route's first-load JS as shared main chunks plus its client manifest", () => {
    const { dist, publicDir, cleanup } = fixture();
    try {
      const report = measureBundle(dist, publicDir);
      const byRoute = Object.fromEntries(report.routes.map((r) => [r.route, r]));
      assert.deepEqual(Object.keys(byRoute).sort(), ["/", "/a", "/b"]);
      assert.equal(byRoute["/"]?.gzBytes, gz("static/chunks/main.js"));
      assert.equal(
        byRoute["/a"]?.gzBytes,
        gz("static/chunks/main.js") +
          gz("static/chunks/shared.js") +
          gz("static/chunks/app/a/page.js"),
      );
      assert.equal(byRoute["/a"]?.chunks, 3);
      assert.equal(
        byRoute["/b"]?.rawBytes,
        2000 + 3000 + (files["static/chunks/charts.js"] ?? "").length + 1500,
      );
      assert.deepEqual(report.fonts, { files: report.fonts.files, bytes: 1000 });
      assert.equal(report.fonts.files.length, 1);
    } finally {
      cleanup();
    }
  });

  it("records the chunk that contains Recharts and the routes that load it", () => {
    const { dist, publicDir, cleanup } = fixture();
    try {
      const { recharts } = measureBundle(dist, publicDir);
      assert.deepEqual(
        recharts.chunks.map((c) => c.path),
        ["static/chunks/charts.js"],
      );
      assert.equal(recharts.gzBytes, gz("static/chunks/charts.js"));
      assert.deepEqual(recharts.routes, ["/b"]);
    } finally {
      cleanup();
    }
  });

  it("reports budget overruns and regressions, and stays quiet within budget", () => {
    const { dist, publicDir, cleanup } = fixture();
    try {
      const report = measureBundle(dist, publicDir);
      assert.deepEqual(findViolations(report), []);
      const tight = { budgets: { routeFirstLoadGzBytes: 100, fontsBytes: 10 } };
      const messages = findViolations(report, tight);
      assert.equal(messages.filter((m) => m.includes("exceeds budget")).length, 3);
      const regressed = findViolations(report, {
        baseline: { routes: { "/a": 1 }, fontsBytes: 1, rechartsGzBytes: 1 },
      });
      assert.equal(regressed.length, 3);
      assert.match(
        renderMarkdown(report, messages),
        /Recharts chunk\(s\): static\/chunks\/charts\.js/,
      );
    } finally {
      cleanup();
    }
  });
});
