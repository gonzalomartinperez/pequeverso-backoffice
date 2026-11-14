import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Static half of the RSC/DTO leak scan: pages, layouts and presentation components (everything
// that can serialize into the HTML or the RSC payload) must never name secret-bearing fields or
// browser storage. The rendered-HTML half needs the built app (browser suite) and is separate.
const root = path.resolve(import.meta.dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    return item.isDirectory() ? walk(full) : [full];
  });
}

const rendered = [
  ...walk(path.join(root, "src/app")),
  ...walk(path.join(root, "src/features")).filter((f) =>
    f.includes(`${path.sep}presentation${path.sep}`),
  ),
  ...walk(path.join(root, "src/shared")),
].filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"));

const FORBIDDEN: [string, RegExp][] = [
  ["token digest", /tokenDigest|token_digest/],
  ["OAuth tokens", /accessToken|refreshToken|idToken/],
  ["secrets", /clientSecret|authSecret|AUTH_SECRET|DATABASE_URL/],
  ["environment", /process\.env/],
  ["browser storage", /\b(?:localStorage|sessionStorage)\b/],
  ["session cookie access", /document\.cookie/],
];

describe("render-surface leak scan (static)", () => {
  it("scans the real tree", () => {
    assert.ok(rendered.length > 20, `only ${rendered.length} files scanned`);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`no page, layout or presentation file references ${label}`, () => {
      const hits = rendered
        .filter((file) => pattern.test(readFileSync(file, "utf8")))
        .map((file) => path.relative(root, file));
      assert.deepEqual(hits, []);
    });
  }

  it("the scan itself detects a planted violation", () => {
    for (const [, pattern] of FORBIDDEN)
      assert.ok(
        pattern.test(
          "x = accessToken + tokenDigest + clientSecret + process.env + localStorage + document.cookie",
        ),
      );
  });
});
