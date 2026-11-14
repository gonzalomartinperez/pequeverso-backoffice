import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  [
    "OAuth tokens",
    /accessToken|refreshToken|idToken|access_token|refresh_token|id_token|ACCESS_TOKEN/,
  ],
  ["secrets", /clientSecret|authSecret|AUTH_SECRET|BETTER_AUTH_SECRET|DATABASE_URL|OPS_READ_TOKEN/],
  [
    "environment",
    /\bprocess\s*(?:\.\s*env\b|\[\s*["'`]env["'`]\s*\])|import\.meta\.env|\{[^}]*\benv\b[^}]*\}\s*=\s*process\b/,
  ],
  ["browser storage", /\b(?:localStorage|sessionStorage)\b/],
  ["session cookie access", /document\.cookie/],
];

/** Files whose text matches the pattern, relative to the root (or absolute when outside it). */
function scan(files: string[], pattern: RegExp): string[] {
  return files
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
}

describe("render-surface leak scan (static)", () => {
  it("scans the real tree", () => {
    assert.ok(rendered.length > 20, `only ${rendered.length} files scanned`);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`no page, layout or presentation file references ${label}`, () => {
      assert.deepEqual(scan(rendered, pattern), []);
    });
  }

  it("flags a planted file for every pattern and spelling, and passes a clean one", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "leak-scan-"));
    try {
      const planted: [string, string][] = [
        ["token digest", "const x = invitation.tokenDigest;"],
        ["OAuth tokens", "const a = account.access_token; const b = ACCESS_TOKEN;"],
        ["secrets", "const s = BETTER_AUTH_SECRET + OPS_READ_TOKEN;"],
        ["environment", 'const v = process["env"].X;'],
        ["environment", "const { env } = process;"],
        ["environment", "const m = import.meta.env.X;"],
        ["environment", "const { OPS_READ_TOKEN } = process.env;"],
        ["browser storage", "localStorage.setItem('a', 'b');"],
        ["session cookie access", "const c = document.cookie;"],
      ];
      for (const [index, [label, source]] of planted.entries()) {
        const file = path.join(dir, `planted-${index}.tsx`);
        writeFileSync(file, source);
        const pattern = FORBIDDEN.find(([name]) => name === label)?.[1];
        assert.ok(pattern, label);
        assert.deepEqual(scan([file], pattern).length, 1, `${label}: ${source}`);
      }
      const clean = path.join(dir, "clean.tsx");
      writeFileSync(clean, "export const Label = () => <p>Hola</p>;");
      for (const [, pattern] of FORBIDDEN) assert.deepEqual(scan([clean], pattern), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
