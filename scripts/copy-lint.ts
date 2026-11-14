import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type CopyString = { line: number; text: string };
type Finding = { file: string; line: number; word: string };
type BaselineEntry = { file: string; word: string; count: number };

const denylist: string[] = JSON.parse(
  readFileSync(new URL("../quality/copy/voseo-denylist.json", import.meta.url), "utf8"),
);
const words = new Set(denylist.map((word) => word.normalize("NFC").toLowerCase()));

export function findVoseo(text: string): string[] {
  return (
    text
      .normalize("NFC")
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}_]+/gu) ?? []
  ).filter((word) => words.has(word));
}

/** Conservative copy candidates: all literals and JSX text, without language guessing.
 * Small lexer, not a TS parser: JSX is recognized by an opening tag/fragment.
 * Template expressions recurse into code; only their literal segments become copy.
 */
export function extractCopyStrings(source: string): CopyString[] {
  const result: CopyString[] = [];
  let i = 0;
  let line = 1;
  const take = () => {
    const char = source[i++] ?? "";
    if (char === "\n") line++;
    return char;
  };
  const add = (text: string, startLine: number) => {
    const leading = text.match(/^\s*/)?.[0] ?? "";
    if (text.trim())
      result.push({ line: startLine + (leading.match(/\n/g)?.length ?? 0), text: text.trim() });
  };
  const escaped = () => {
    const char = take();
    const unicode =
      char === "u" ? source.slice(i).match(/^(?:\{([\da-f]+)\}|([\da-f]{4}))/i) : null;
    const hex = char === "x" ? source.slice(i).match(/^([\da-f]{2})/i) : null;
    const match = unicode ?? hex;
    if (match) {
      i += match[0].length;
      const point = Number.parseInt(match[1] ?? match[2] ?? "", 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "";
    }
    return ({ n: "\n", r: "\r", t: "\t", "\n": "" } as Record<string, string>)[char] ?? char;
  };
  function literal(quote: string, skip = false): void {
    take();
    let startLine = line;
    let text = "";
    while (i < source.length) {
      if (source[i] === quote) {
        take();
        break;
      }
      if (source[i] === "\\") {
        take();
        text += escaped();
      } else if (quote === "`" && source.startsWith("${", i)) {
        if (!skip) add(text, startLine);
        text = "";
        take();
        take();
        code(true);
        startLine = line;
      } else text += take();
    }
    if (!skip) add(text, startLine);
  }
  function jsx(): void {
    take(); // <
    const closing = source[i] === "/";
    if (closing) take();
    let selfClosing = false;
    while (i < source.length && source[i] !== ">") {
      if (source[i] === '"' || source[i] === "'") literal(source[i] ?? "");
      else if (source[i] === "{") {
        take();
        code(true);
      } else {
        selfClosing = source[i] === "/";
        take();
      }
    }
    if (source[i] === ">") take();
    if (closing || selfClosing) return;
    while (i < source.length) {
      if (source.startsWith("</", i)) {
        jsx();
        return;
      }
      if (source[i] === "<") jsx();
      else if (source[i] === "{") {
        take();
        code(true);
      } else {
        const startLine = line;
        let text = "";
        while (i < source.length && source[i] !== "<" && source[i] !== "{") text += take();
        add(text, startLine);
      }
    }
  }
  function code(expression = false): void {
    let braces = 0;
    let previous = "";
    while (i < source.length) {
      const char = source[i] ?? "";
      if (source.startsWith("//", i)) {
        while (i < source.length && source[i] !== "\n") take();
      } else if (source.startsWith("/*", i)) {
        take();
        take();
        while (i < source.length && !source.startsWith("*/", i)) take();
        if (i < source.length) {
          take();
          take();
        }
      } else if (char === "/" && /^(?:|=|\(|\[|\{|:|,|;|!|\?|return|=>)$/.test(previous)) {
        // Ignore regex bodies, including escaped slashes and character classes.
        take();
        let characterClass = false;
        while (i < source.length) {
          const part = take();
          if (part === "\\") take();
          else if (part === "[") characterClass = true;
          else if (part === "]") characterClass = false;
          else if (part === "/" && !characterClass) break;
        }
        while (/[a-z]/i.test(source[i] ?? "")) take();
        previous = "regex";
      } else if (char === '"' || char === "'" || char === "`") {
        // A module specifier follows import/from, or import( (including import types).
        literal(char, previous === "from" || previous === "import" || previous === "import(");
        previous = "literal";
      } else if (
        char === "<" &&
        /^(?:|=|\(|\[|\{|:|,|;|\?|>|return|&|\|)$/.test(previous) &&
        /^<(?:[A-Za-z][\w.:-]*(?:\s|\/?>)|>)/.test(source.slice(i)) &&
        !/^<[\w,\s]+>\s*\([^)]*\)\s*(?::[^=]+)?=>/.test(source.slice(i))
      ) {
        jsx();
        previous = "jsx";
      } else if (char === "{") {
        braces++;
        take();
        previous = "{";
      } else if (char === "}") {
        take();
        if (expression && braces === 0) return;
        braces--;
        previous = "}";
      } else if (/[\w$]/.test(char)) {
        let token = "";
        while (i < source.length && /[\w$]/.test(source[i] ?? "")) token += take();
        previous = token;
      } else {
        take();
        if (!/\s/.test(char)) previous = char === "(" && previous === "import" ? "import(" : char;
      }
    }
  }
  code();
  return result;
}

export function scanRepository(root: string): Finding[] {
  const findings: Finding[] = [];
  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!/^(?:tests?|__tests__)$/.test(entry.name)) walk(path);
      } else if (
        entry.isFile() &&
        /\.(?:ts|tsx)$/.test(entry.name) &&
        !/\.(?:test|spec)\./.test(entry.name)
      ) {
        for (const copy of extractCopyStrings(readFileSync(path, "utf8"))) {
          for (const [offset, text] of copy.text.split("\n").entries()) {
            for (const word of findVoseo(text))
              findings.push({
                file: relative(root, path).split("\\").join("/"),
                line: copy.line + offset,
                word,
              });
          }
        }
      }
    }
  }
  walk(join(root, "src"));
  return findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.word.localeCompare(b.word),
  );
}

export function baselineFor(findings: Finding[]): BaselineEntry[] {
  const entries = new Map<string, BaselineEntry>();
  for (const { file, word } of findings) {
    const key = JSON.stringify([file, word]);
    const entry = entries.get(key) ?? { file, word, count: 0 };
    entry.count++;
    entries.set(key, entry);
  }
  return [...entries.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.word.localeCompare(b.word),
  );
}

export function checkBaseline(findings: Finding[], baseline: BaselineEntry[]): string[] {
  const current = baselineFor(findings);
  const key = (entry: BaselineEntry) => JSON.stringify([entry.file, entry.word]);
  const allowed = new Map(baseline.map((entry) => [key(entry), entry.count]));
  const actual = new Map(current.map((entry) => [key(entry), entry.count]));
  const errors: string[] = [];
  for (const entry of current) {
    if (entry.count > (allowed.get(key(entry)) ?? 0)) {
      for (const finding of findings.filter((f) => f.file === entry.file && f.word === entry.word))
        errors.push(
          `${finding.file}:${finding.line}: ${finding.word} (count ${entry.count}, baseline ${allowed.get(key(entry)) ?? 0})`,
        );
    }
  }
  for (const entry of baseline) {
    if (entry.count > (actual.get(key(entry)) ?? 0))
      errors.push(
        `${entry.file}: stale baseline for ${entry.word} (${entry.count} → ${actual.get(key(entry)) ?? 0})`,
      );
  }
  return errors;
}

export function shrinkBaseline(
  findings: Finding[],
  baseline: BaselineEntry[],
  init = false,
): BaselineEntry[] {
  const current = baselineFor(findings);
  if (!init) {
    for (const entry of current) {
      const previous = baseline.find((b) => b.file === entry.file && b.word === entry.word);
      if (entry.count > (previous?.count ?? 0))
        throw new Error("Baseline additions require --init; existing baselines may only shrink.");
    }
  }
  return current;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const path = join(root, "quality/copy/voseo-baseline.json");
  const exists = existsSync(path);
  const baseline: BaselineEntry[] = exists ? JSON.parse(readFileSync(path, "utf8")) : [];
  const findings = scanRepository(root);
  if (process.argv.includes("--write-baseline")) {
    const next = shrinkBaseline(findings, baseline, !exists || process.argv.includes("--init"));
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Copy baseline: ${next.length} file/word entries.`);
  } else {
    const errors = checkBaseline(findings, baseline);
    if (!exists)
      errors.push("Missing copy baseline; run node scripts/copy-lint.ts --write-baseline.");
    for (const error of errors) console.error(error);
    console.log(`Copy lint: ${errors.length} errors.`);
    if (errors.length) process.exitCode = 1;
  }
}
