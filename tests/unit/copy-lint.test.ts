import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  baselineFor,
  checkBaseline,
  extractCopyStrings,
  findVoseo,
  scanRepository,
  shrinkBaseline,
} from "../../scripts/copy-lint.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("copy extraction", () => {
  it("extracts JSX text, attributes and expressions with source lines", () => {
    assert.deepEqual(
      extractCopyStrings(
        'const view = <p aria-label="Ingresá">\n  Elegí una opción {"para vos"}<b>Volvé</b>\n</p>;',
      ),
      [
        { line: 1, text: "Ingresá" },
        { line: 2, text: "Elegí una opción" },
        { line: 2, text: "para vos" },
        { line: 2, text: "Volvé" },
      ],
    );
  });
  it("extracts quoted strings and template segments, including expression strings", () => {
    assert.deepEqual(
      extractCopyStrings(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: lexer input, not an evaluated template.
        "const a = 'tenés'; const b = `Hola ${name}, podés ${ok ? 'elegí' : `volvé`} acá`;",
      ),
      [
        { line: 1, text: "tenés" },
        { line: 1, text: "Hola" },
        { line: 1, text: ", podés" },
        { line: 1, text: "elegí" },
        { line: 1, text: "volvé" },
        { line: 1, text: "acá" },
      ],
    );
  });
  it("skips comments and import/re-export specifiers, preserving line numbers", () => {
    const source = `import x from "vos";
export { x } from 'sos';
import "che";
const lazy = import("dale");
// "tenés"
/* 'podés' */
const view = <><p>{/* "mirá" */}Usá esto</p><p>No // comentario</p></>;
const text = "https://example.com";`;
    assert.deepEqual(extractCopyStrings(source), [
      { line: 7, text: "Usá esto" },
      { line: 7, text: "No // comentario" },
      { line: 8, text: "https://example.com" },
    ]);
  });
  it("decodes escaped letters and does not treat apostrophes in JSX as strings", () => {
    assert.deepEqual(
      extractCopyStrings('const x = "ten\\u00e9s"; const y = <p>Elegí ' + "'esto'" + "</p>;"),
      [
        { line: 1, text: "tenés" },
        { line: 1, text: "Elegí 'esto'" },
      ],
    );
  });
});

it("keeps literals after generics, comparisons, regexes and nested template objects", () => {
  for (const source of [
    'const x: Promise<string> = "vos";',
    'const x = /"/; const y = "vos";',
    'const x = a < b; const y = "vos";',
    "const view = ok && <p>vos</p>;",
    'const identity = <T>(x: T) => x; const y = "vos";',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: lexer fixture.
    'const view = <p>{`Hola ${({ value: "vos" }).value}`}</p>;',
  ])
    assert.ok(extractCopyStrings(source).some((copy) => copy.text === "vos"));
});

describe("voseo matching", () => {
  it("matches whole words case-insensitively with Unicode accents", () => {
    assert.deepEqual(findVoseo("¡VOS! Tenés, PODÉS; elegí. tene\u0301s plata dale"), [
      "vos",
      "tenés",
      "podés",
      "elegí",
      "tenés",
      "plata",
      "dale",
    ]);
    const denylist = JSON.parse(
      readFileSync(join(root, "quality/copy/voseo-denylist.json"), "utf8"),
    ) as string[];
    for (const word of denylist) assert.deepEqual(findVoseo(word), [word]);
  });
  it("does not match neutral Spanish, substrings or unaccented forms", () => {
    assert.deepEqual(
      findVoseo(
        "tienes puedes sobre voseo vosotros soso plataforma tenes podes elegíais ñvos vosñ",
      ),
      [],
    );
  });
});

describe("copy baseline", () => {
  const findings = [
    { file: "src/a.tsx", line: 2, word: "vos" },
    { file: "src/a.tsx", line: 8, word: "vos" },
  ];
  const baseline = [{ file: "src/a.tsx", word: "vos", count: 2 }];
  it("uses counts rather than lines and rejects new findings and stale entries", () => {
    assert.deepEqual(baselineFor(findings), baseline);
    assert.deepEqual(
      checkBaseline(
        findings.map((f) => ({ ...f, line: 99 })),
        baseline,
      ),
      [],
    );
    assert.ok(
      checkBaseline([...findings, { file: "src/b.ts", line: 1, word: "che" }], baseline).length,
    );
    assert.ok(checkBaseline(findings.slice(1), baseline).length);
    assert.ok(checkBaseline([], baseline).length);
  });
  it("allows removing or lowering counts, refusing additions without init", () => {
    const lower = shrinkBaseline(findings.slice(1), baseline);
    assert.deepEqual(lower, [{ file: "src/a.tsx", word: "vos", count: 1 }]);
    assert.deepEqual(checkBaseline(findings.slice(1), lower), []);
    assert.deepEqual(shrinkBaseline([], baseline), []);
    assert.throws(() => shrinkBaseline([...findings, ...findings], baseline), /--init/);
    assert.throws(
      () => shrinkBaseline([{ file: "src/b.ts", line: 1, word: "che" }], baseline),
      /--init/,
    );
    assert.deepEqual(shrinkBaseline(findings, [], true), baseline);
  });
  it("scans only source TS/TSX, excludes tests, and sorts findings", () => {
    const fixture = mkdtempSync(join(tmpdir(), "copy-lint-"));
    try {
      mkdirSync(join(fixture, "src/tests"), { recursive: true });
      for (const [file, text] of Object.entries({
        "z.tsx": "<p>vos\nche</p>",
        "a.ts": '"tenés"',
        "ignore.test.tsx": '"vos"',
        "ignore.spec.ts": '"vos"',
        "tests/a.ts": '"vos"',
        "a.js": '"vos"',
      }))
        writeFileSync(join(fixture, "src", file), text);
      assert.deepEqual(scanRepository(fixture), [
        { file: "src/a.ts", line: 1, word: "tenés" },
        { file: "src/z.tsx", line: 1, word: "vos" },
        { file: "src/z.tsx", line: 2, word: "che" },
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
  it("keeps the repository scan equal to the committed baseline", () => {
    const baseline = JSON.parse(
      readFileSync(join(root, "quality/copy/voseo-baseline.json"), "utf8"),
    );
    assert.deepEqual(checkBaseline(scanRepository(root), baseline), []);
  });
});

it("validates the future Spanish dictionary", async (t) => {
  const dictionary = new URL("../../src/messages/es.ts", import.meta.url);
  if (!existsSync(dictionary)) {
    t.skip("src/messages/es.ts arrives in M4.5");
    return;
  }
  const exports = await import(dictionary.href);
  function validate(value: unknown): void {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      assert.ok(Object.keys(value).length > 0, "dictionary objects must not be empty");
      for (const child of Object.values(value)) validate(child);
    } else {
      assert.equal(typeof value, "string");
      assert.ok((value as string).trim().length > 0);
      assert.deepEqual(findVoseo(value as string), []);
    }
  }
  validate(exports);
});
