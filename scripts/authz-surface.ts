// Enumerates the authorization surface of the app from source (static, TS compiler API): every
// server action, every route handler and every page/layout/template/default under src/app, and
// verifies which guards each entry really runs. The authz matrix (tests/authz/matrix.ts) must list
// exactly this set; tests/authz/check.ts compares them. Fail closed: shapes that cannot be
// resolved (`export *`, the pages router) become entries or problems that no matrix row can match.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "@typescript/typescript6";

export type SurfaceKind = "action" | "route" | "page" | "proxy";
export type SurfaceEntry = {
  /** Stable key: `<kind>:<posix path from root>#<export>`; inline actions are scope-qualified. */
  id: string;
  kind: SurfaceKind;
  file: string;
  name: string;
  /** Anything but a GET route handler, and every server action, may change state. */
  mutating: boolean;
  /** Literals of `requireActor(...)` that run unconditionally at the top of the entry (or of a verified helper). */
  guards: string[];
  /** Imported helpers whose own top-level guard supplies some of `guards`. */
  via: string[];
  /** Recognized non-session mechanisms in a route handler. */
  markers: ("better-auth" | "bearer-token")[];
  /** Re-exported from another module: its body (and guards) cannot be verified here. */
  reexport: boolean;
  problems: string[];
};

/** Source files by posix path relative to the project root (only `src/` is read). */
export type Files = Record<string, string>;

const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const SOURCE = /\.[cm]?[jt]sx?$/;
const DECLARATION = /\.d\.[cm]?ts$/;
const ROUTE = /^src\/app\/(?:.*\/)?route\.[cm]?[jt]sx?$/;
const PAGE =
  /^src\/app\/(?:.*\/)?(?:page|layout|template|default|not-found|error|loading|global-error|sitemap|robots|manifest|(?:opengraph-image|twitter-image|icon|apple-icon)\d*)\.[cm]?[jt]sx?$/;
/** Edge entry (`proxy`, formerly `middleware`): it must live in src/ next to app/. */
const PROXY = /^(?:src\/)?(?:proxy|middleware)\.[cm]?[jt]sx?$/;
/** Routers outside src/app: Next would pick them up, the matrix does not cover them. */
const FORBIDDEN_ROUTER = /^(?:src\/pages|pages|app)\//;
const AUTH_MODULE = "src/server/auth";
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

export function readTree(root: string): Files {
  const files: Files = {};
  const dirs = ["src", "app", "pages"].filter((dir) => existsSync(path.join(root, dir)));
  const rootFiles = readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isFile() && PROXY.test(item.name))
    .map((item) => path.join(root, item.name));
  for (const file of [...dirs.flatMap((dir) => walk(path.join(root, dir))), ...rootFiles].sort()) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (SOURCE.test(rel) && !DECLARATION.test(rel)) files[rel] = readFileSync(file, "utf8");
  }
  return files;
}

type Exported = { name: string; node: ts.Node; reexport: boolean };
type Parsed = {
  file: string;
  source: ts.SourceFile;
  imports: Map<string, { spec: string; imported: string }>;
  local: Map<string, ts.Node>;
  exported: Exported[];
};

const modifiers = (node: ts.Node) =>
  ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  modifiers(node).some((m) => m.kind === kind);

function isDirective(statement: ts.Statement, text: string): boolean {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === text
  );
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  );
}

function parseFile(file: string, text: string): Parsed {
  const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const imports = new Map<string, { spec: string; imported: string }>();
  const local = new Map<string, ts.Node>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements)
          imports.set(element.name.text, {
            spec: statement.moduleSpecifier.text,
            imported: (element.propertyName ?? element.name).text,
          });
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      local.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        for (const name of bindingNames(declaration.name)) local.set(name, declaration);
    }
  }
  const exported: Exported[] = [];
  for (const statement of source.statements) {
    const exports = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      exports
    ) {
      const name = isDefault ? "default" : statement.name?.text;
      if (name) exported.push({ name, node: statement, reexport: false });
    } else if (ts.isVariableStatement(statement) && exports) {
      for (const declaration of statement.declarationList.declarations)
        for (const name of bindingNames(declaration.name))
          exported.push({ name, node: declaration, reexport: false });
    } else if (ts.isExportAssignment(statement)) {
      exported.push({ name: "default", node: statement.expression, reexport: false });
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const spec =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : null;
      const clause = statement.exportClause;
      if (!clause || ts.isNamespaceExport(clause)) {
        exported.push({ name: `*:${spec ?? "local"}`, node: statement, reexport: true });
      } else {
        for (const element of clause.elements) {
          if (element.isTypeOnly) continue;
          const target = local.get((element.propertyName ?? element.name).text);
          exported.push({
            name: element.name.text,
            node: spec ? element : (target ?? element),
            reexport: spec !== null,
          });
        }
      }
    }
  }
  return { file, source, imports, local, exported };
}

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function unwrap(node: ts.Node): ts.Node {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression;
  return current;
}

function functionOf(node: ts.Node, parsed: Parsed, hops = 2): FunctionLike | null {
  if (ts.isFunctionDeclaration(node)) return node;
  const target = ts.isVariableDeclaration(node) ? node.initializer : node;
  if (!target) return null;
  const inner = unwrap(target);
  if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)) return inner;
  if (ts.isIdentifier(inner) && hops > 0) {
    const next = parsed.local.get(inner.text);
    return next ? functionOf(next, parsed, hops - 1) : null;
  }
  return null;
}

/** `await f(...)` as the whole statement or as the initializer of its first declaration. */
function awaitedCall(statement: ts.Statement): ts.CallExpression | null {
  let expression: ts.Node | undefined;
  if (ts.isExpressionStatement(statement)) expression = statement.expression;
  else if (ts.isVariableStatement(statement))
    expression = statement.declarationList.declarations[0]?.initializer;
  if (!expression) return null;
  const inner = unwrap(expression);
  if (!ts.isAwaitExpression(inner)) return null;
  const call = unwrap(inner.expression);
  return ts.isCallExpression(call) ? call : null;
}

/** Statements allowed before the guard: directives, hoisted functions, call-free declarations. */
function isPureSetup(statement: ts.Statement): boolean {
  if (ts.isFunctionDeclaration(statement) || ts.isEmptyStatement(statement)) return true;
  if (ts.isExpressionStatement(statement)) return ts.isStringLiteral(statement.expression);
  if (!ts.isVariableStatement(statement)) return false;
  const impure = (node: ts.Node): boolean => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return false;
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isYieldExpression(node)
    )
      return true;
    return ts.forEachChild(node, (child) => (impure(child) ? true : undefined)) === true;
  };
  return !statement.declarationList.declarations.some(
    (d) => d.initializer && impure(d.initializer),
  );
}

/** True when `name` is declared anywhere inside the function (a parameter, `var`, `const`, function). */
function declaresName(fn: FunctionLike, name: string): boolean {
  if (fn.parameters.some((parameter) => bindingNames(parameter.name).includes(name))) return true;
  const visit = (node: ts.Node): boolean => {
    if (ts.isVariableDeclaration(node) && bindingNames(node.name).includes(name)) return true;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) return true;
    if (ts.isFunctionLike(node) && node !== fn) return false; // an inner scope does not shadow ours
    return ts.forEachChild(node, (child) => (visit(child) ? true : undefined)) === true;
  };
  return (
    !!fn.body && ts.forEachChild(fn.body, (child) => (visit(child) ? true : undefined)) === true
  );
}

function resolveModule(files: Files, from: string, spec: string): string | null {
  const base = moduleBase(from, spec);
  if (base === null) return null;
  for (const ext of EXTENSIONS) {
    if (base + ext in files) return base + ext;
    if (`${base}/index${ext}` in files) return `${base}/index${ext}`;
  }
  return null;
}

function moduleBase(from: string, spec: string): string | null {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) return path.posix.join(path.posix.dirname(from), spec);
  return null;
}

/** Does the import specifier resolve to src/server/auth (the only `requireActor`)? */
function isAuthModule(from: string, spec: string): boolean {
  const base = moduleBase(from, spec);
  return base !== null && EXTENSIONS.some((ext) => base === AUTH_MODULE + ext);
}

type Verified = { guards: string[]; via: string[] };

/**
 * Guards that run before anything else can: the function body may start only with directives,
 * hoisted functions and call-free declarations, then awaited guard calls. A guard that follows a
 * mutation (or any other call) is not credited. One import level of helper is resolved (`depth` 0).
 */
function verifiedGuards(
  fn: FunctionLike,
  parsed: Parsed,
  files: Files,
  cache: Map<string, Parsed>,
  depth: number,
): Verified {
  const result: Verified = { guards: [], via: [] };
  if (!fn.body || !ts.isBlock(fn.body)) return result;
  for (const statement of fn.body.statements) {
    if (isPureSetup(statement)) continue;
    const call = awaitedCall(statement);
    const callee = call && ts.isIdentifier(call.expression) ? call.expression.text : null;
    if (!call || !callee) break;
    const binding = parsed.imports.get(callee);
    if (!binding || declaresName(fn, callee)) break;
    if (callee === "requireActor" && isAuthModule(parsed.file, binding.spec)) {
      const [arg] = call.arguments;
      result.guards.push(arg && ts.isStringLiteralLike(arg) ? arg.text : "?");
      continue;
    }
    if (depth !== 0) break;
    const target = resolveModule(files, parsed.file, binding.spec);
    const text = target ? files[target] : undefined;
    if (!target || text === undefined) break;
    const helper = cache.get(target) ?? parseFile(target, text);
    cache.set(target, helper);
    const item = helper.exported.find((e) => e.name === binding.imported && !e.reexport);
    const helperFn = item ? functionOf(item.node, helper) : null;
    const inner = helperFn ? verifiedGuards(helperFn, helper, files, cache, 1) : null;
    if (!inner || inner.guards.length === 0) break;
    result.guards.push(...inner.guards);
    result.via.push(callee);
  }
  return result;
}

function markersOf(node: ts.Node, source: ts.SourceFile): SurfaceEntry["markers"] {
  const text = node.getText(source);
  const markers: SurfaceEntry["markers"] = [];
  if (/\btoNextJsHandler\s*\(/.test(text)) markers.push("better-auth");
  if (/\.authorize\s*\([^)]*authorization/i.test(text) && /\b401\b/.test(text))
    markers.push("bearer-token");
  return markers;
}

function inlineActions(source: ts.SourceFile): { name: string; node: FunctionLike }[] {
  const found: { name: string; node: FunctionLike }[] = [];
  const anonymous = new Map<string, number>();
  const visit = (node: ts.Node, scope: string[]): void => {
    let next = scope;
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      let own: string | null = null;
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name)
        own = node.name.text;
      else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
        own = node.parent.name.text;
      if (own === null) {
        const key = scope.join(">");
        const count = anonymous.get(key) ?? 0;
        anonymous.set(key, count + 1);
        own = `anon${count}`;
      }
      next = [...scope, own];
      if (
        node.body &&
        ts.isBlock(node.body) &&
        node.body.statements.some((s) => isDirective(s, "use server"))
      )
        found.push({ name: `inline:${next.join(">")}`, node });
    }
    ts.forEachChild(node, (child) => visit(child, next));
  };
  visit(source, []);
  return found;
}

export function surfaceOf(files: Files): SurfaceEntry[] {
  const entries: SurfaceEntry[] = [];
  const cache = new Map<string, Parsed>();
  for (const rel of Object.keys(files).sort()) {
    const text = files[rel] ?? "";
    if (PROXY.test(rel)) {
      entries.push({
        id: `proxy:${rel}#proxy`,
        kind: "proxy",
        file: rel,
        name: "proxy",
        mutating: false,
        guards: [],
        via: [],
        markers: [],
        reexport: false,
        problems: rel.startsWith("src/") ? [] : ["proxy/middleware must live in src/, beside app/"],
      });
      continue;
    }
    if (FORBIDDEN_ROUTER.test(rel)) {
      entries.push({
        id: `page:${rel}#pages-router`,
        kind: "page",
        file: rel,
        name: "pages-router",
        mutating: false,
        guards: [],
        via: [],
        markers: [],
        reexport: false,
        problems: ["the pages router and a root app/ are not covered by the matrix; use src/app"],
      });
      continue;
    }
    const parsed = parseFile(rel, text);
    cache.set(rel, parsed);
    const add = (
      kind: SurfaceKind,
      name: string,
      node: ts.Node,
      reexport: boolean,
      mutating: boolean,
    ) => {
      const fn = functionOf(node, parsed);
      const verified = fn ? verifiedGuards(fn, parsed, files, cache, 0) : { guards: [], via: [] };
      entries.push({
        id: `${kind}:${rel}#${name}`,
        kind,
        file: rel,
        name,
        mutating,
        guards: verified.guards,
        via: verified.via,
        markers: kind === "route" ? markersOf(node, parsed.source) : [],
        reexport,
        problems: name.startsWith("*:") ? ["`export *` cannot be enumerated"] : [],
      });
    };
    if (parsed.source.statements.some((s) => isDirective(s, "use server"))) {
      for (const item of parsed.exported) add("action", item.name, item.node, item.reexport, true);
    } else {
      for (const item of inlineActions(parsed.source))
        add("action", item.name, item.node, false, true);
    }
    if (ROUTE.test(rel))
      for (const item of parsed.exported)
        if (HTTP_METHODS.has(item.name) || item.name.startsWith("*:"))
          add("route", item.name, item.node, item.reexport, item.name !== "GET");
    if (PAGE.test(rel))
      for (const item of parsed.exported)
        if (item.name === "default" || item.name.startsWith("*:"))
          add("page", item.name, item.node, item.reexport, false);
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export function discoverSurface(root: string): SurfaceEntry[] {
  return surfaceOf(readTree(root));
}
