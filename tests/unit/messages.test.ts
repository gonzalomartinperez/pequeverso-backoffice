import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { es } from "#shared/i18n/es.ts";
import { extractCopyStrings, findVoseo } from "../../scripts/copy-lint.ts";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

const ALLOWED: readonly string[] = [
  // Next.js module directive.
  "use client",
  // CSS border shorthand passed to the chart tooltip.
  "1px solid var(--line)",
  // The root layout's static pre-paint theme script.
  '(()=>{try{document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}})()',
];

const classToken = /^(?:[a-z0-9:/_.[\]%#()-]+|[a-z0-9-]+-\[\S+\]|(?:[a-z][\w-]*|\[\S+\]):\S+)$/;
const classUtility =
  /^(?:[\w-]+:\S|\[|(?:bg|border|duration|font|gap|grid|items|justify|p[xytrbl]?|ring|rounded|size|text|tracking|w)-)/;

function inlineCopy(source: string) {
  return extractCopyStrings(source, ({ text }, { kind, offset }) => {
    if (ALLOWED.includes(text) || !/\p{L}/u.test(text)) return false;
    // JSX text with any letter is copy; so is any value of a copy-bearing attribute or key.
    if (kind === "jsxText") return true;
    if (kind === "literal") {
      const prefix = source.slice(Math.max(0, offset - 100), offset);
      if (
        /(?:\b(?:title|placeholder|alt|label|description|heading|aria-label)\s*=\s*\{?\s*|\b(?:title|description|label)\s*:\s*)["'`]$/.test(
          prefix,
        )
      )
        return true;
      if (
        /\b(?:id|data-testid|aria-(?:describedby|labelledby|controls|owns))\s*=\s*\{?\s*["'`]$/.test(
          prefix,
        )
      )
        return false;
      if (/^(?:[a-z][\w+.-]*:\/\/|\.{0,2}\/|#)[^\s]*$/i.test(text)) return false;
      if (/^(?:application|audio|font|image|text|video)\/[\w.+-]+$/i.test(text)) return false;
      const tokens = text.split(/\s+/);
      if (
        tokens.every((token) => classToken.test(token)) &&
        (/\bclassName\s*=\s*\{?\s*["'`]$/.test(prefix) ||
          tokens.some((token) => classUtility.test(token)))
      )
        return false;
    }

    // Other literals: multiword text and Spanish marks are strong signals. Class lists
    // require technical context or a recognizable utility so lowercase prose is still flagged.
    return /\p{L}\p{P}*\s+\p{P}*\p{L}/u.test(text) || /[áéíóúüñ¿¡]/iu.test(text.normalize("NFC"));
  });
}

function checkMessages(value: unknown, path: string): void {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    assert.ok(Object.keys(value).length > 0, `${path} has no messages`);
    for (const [key, message] of Object.entries(value)) {
      const child = `${path}.${key}`;
      assert.match(key, /^[a-z][a-zA-Z0-9]*$/, child);
      checkMessages(message, child);
    }
    return;
  }

  // Interpolation functions accept display-ready strings.
  const text: unknown =
    typeof value === "function"
      ? Reflect.apply(
          value,
          undefined,
          Array.from({ length: value.length }, () => "muestra"),
        )
      : value;
  assert.ok(typeof text === "string" && text.length > 0, `${path} must produce a string`);
  assert.equal(text, text.trim(), `${path} has leading or trailing whitespace`);
  assert.deepEqual(findVoseo(text), [], `${path} contains voseo`);
}

it("keeps dictionary keys camelCase and messages trimmed and free of voseo", () => {
  checkMessages(es, "es");
});

it("rejects inline copy in a synthetic component", () => {
  const source = `
    import Component from "Ignored import path";
    export const view = <section className="flex grid" id="sección" data-testid="vista-pública">
      <p>Hola mundo</p>
      <p>Hola, mundo</p>
      <p>hola mundo</p>
      <p>Salir</p>
      <p>continuar: revisa los datos</p>
      <p>{"continuar: revisa los datos"}</p>
      <input title="Día" placeholder="Escribe tu nombre" />
      <a href="/sección">{"Puedes continuar"}</a>
      <p>lectura</p>
      <b title="Cuenta" placeholder="correo" aria-label="cerrar" />
    </section>;
    export const metadata = { title: "Accesos" };
  `;
  assert.deepEqual(
    inlineCopy(source).map(({ text }) => text),
    [
      "Hola mundo",
      "Hola, mundo",
      "hola mundo",
      "Salir",
      "continuar: revisa los datos",
      "continuar: revisa los datos",
      "Día",
      "Escribe tu nombre",
      "Puedes continuar",
      "lectura",
      "Cuenta",
      "correo",
      "cerrar",
      "Accesos",
    ],
  );
});

it("keeps user-visible Spanish copy out of TSX files", () => {
  const findings = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx"))
    .sort()
    .flatMap((path) =>
      inlineCopy(readFileSync(join(src, path), "utf8")).map(
        ({ line, text }) => `src/${path}:${line}: ${text}`,
      ),
    );
  assert.deepEqual(findings, [], findings.join("\n"));
});
