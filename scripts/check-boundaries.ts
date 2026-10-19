// Static source policy, not an authorization sandbox. TS6's official compatibility API is
// dev-only; the application continues to typecheck with the root TypeScript7 compiler.

import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "@typescript/typescript6";

const LAYERS = ["domain", "application", "adapters", "presentation"] as const;
type Layer = (typeof LAYERS)[number] | "shared" | "server" | "app";
type Place = { layer: Layer; feature: string | null };
type Edge = { specifier: string | null; typeOnly: boolean; names: string[] | null };
type Module = {
  file: ts.SourceFile;
  place: Place | null;
  edges: Edge[];
  client: boolean;
  action: boolean;
};
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ["domain"],
  application: ["domain", "application"],
  adapters: ["domain", "application", "adapters"],
  presentation: ["domain", "application", "presentation", "shared"],
  shared: ["domain", "shared"],
  server: ["domain", "application", "adapters", "server", "shared"],
  app: ["domain", "application", "presentation", "shared", "server", "app"],
};
const IMPURE = new Set([
  "window",
  "document",
  "fetch",
  "localStorage",
  "sessionStorage",
  "AbortController",
  "AbortSignal",
  "setTimeout",
  "setInterval",
  "process",
  "globalThis",
  "ReadableStream",
  "TextDecoder",
]);
const CODE = /\.(?:[cm]?[jt]sx?)$/;
const LEAF = /\.(?:css|json|svg|png|webp|avif|woff2)$/;
const ROOT = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const PACKAGES = new Set([
  ...Object.keys(manifest.dependencies),
  ...Object.keys(manifest.devDependencies),
]);
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const posix = (value: string) => value.split(path.sep).join("/");
const packageRoot = (specifier: string) =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : (specifier.split("/")[0] ?? "");
const privatePackage = (specifier: string) =>
  ["pg", "server-only"].includes(packageRoot(specifier)) ||
  specifier.startsWith("node:") ||
  BUILTINS.has(specifier);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : CODE.test(full) || LEAF.test(full) ? [full] : [];
  });
}
function place(src: string, file: string): Place | null {
  const rel = posix(path.relative(src, file));
  const feature =
    /^features\/(auth|operations|analytics)\/(domain|application|adapters|presentation)\//.exec(
      rel,
    );
  if (feature) return { feature: feature[1] ?? null, layer: feature[2] as Layer };
  if (rel.startsWith("shared/ui/")) return { feature: null, layer: "shared" };
  if (rel.startsWith("server/")) return { feature: null, layer: "server" };
  if (rel.startsWith("app/") || rel === "proxy.ts" || rel === "instrumentation.ts")
    return { feature: null, layer: "app" };
  return null;
}
function directive(file: ts.SourceFile, name: string): boolean {
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === name) return true;
  }
  return false;
}
const has = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some((item) => item.kind === kind));
function actionExports(file: ts.SourceFile): Set<string> | null {
  if (!directive(file, "use server")) return null;
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return null;
    if (!has(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    if (
      !ts.isFunctionDeclaration(statement) ||
      !statement.name ||
      !has(statement, ts.SyntaxKind.AsyncKeyword) ||
      has(statement, ts.SyntaxKind.DefaultKeyword)
    )
      return null;
    names.add(statement.name.text);
  }
  return names.size ? names : null;
}
function literal(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}
function edges(file: ts.SourceFile): Edge[] {
  const result: Edge[] = [];
  const add = (node: ts.Node | undefined, typeOnly = false, names: string[] | null = null) =>
    result.push({ specifier: literal(node), typeOnly, names });
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const allTypes = Boolean(
        clause?.isTypeOnly ||
          (!clause?.name &&
            bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length &&
            bindings.elements.every((item) => item.isTypeOnly)),
      );
      add(
        node.moduleSpecifier,
        allTypes,
        bindings && ts.isNamedImports(bindings) && !clause?.name
          ? bindings.elements
              .filter((item) => !item.isTypeOnly)
              .map((item) => item.propertyName?.text ?? item.name.text)
          : null,
      );
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      add(
        node.moduleSpecifier,
        node.isTypeOnly ||
          Boolean(
            clause &&
              ts.isNamedExports(clause) &&
              clause.elements.length &&
              clause.elements.every((item) => item.isTypeOnly),
          ),
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (ts.isImportTypeNode(node)) {
      add(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined, true);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}
function reference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    (ts.isBindingElement(parent) && parent.propertyName === node)
  )
    return false;
  if ("name" in parent && parent.name === node && !ts.isShorthandPropertyAssignment(parent))
    return false;
  return true;
}

/** Analyze snapshots only: fixture modules are parsed, never imported or executed. */
export function checkBoundaries(modules: ReadonlyMap<string, string>, root: string): string[] {
  const src = path.join(root, "src");
  const problems: string[] = [];
  const parsed = new Map<string, Module>();
  const graph = new Map<string, { target: string; runtime: boolean; rpc: boolean }[]>();
  const report = (file: string, message: string) =>
    problems.push(`${posix(path.relative(root, file))}: ${message}`);
  for (const [file, source] of modules) {
    if (!CODE.test(file)) continue;
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const classification = place(src, file);
    if (!classification)
      report(file, "feature modules must belong to a recognized layer; unknown source placement");
    const diagnostics = (ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
      .parseDiagnostics;
    for (const diagnostic of diagnostics)
      report(
        file,
        `invalid source syntax: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      );
    if (/NEXT_PUBLIC_/.test(source))
      report(file, "NEXT_PUBLIC_* configuration is not used by this app");
    const action = /\/app\/.+\/actions\.ts$/.test(posix(file)) && actionExports(ast) !== null;
    parsed.set(file, {
      file: ast,
      place: classification,
      edges: edges(ast),
      client: directive(ast, "use client"),
      action,
    });
    graph.set(file, []);
  }
  const host = ts.createCompilerHost({ noResolve: true, noLib: true });
  host.getSourceFile = (file) => parsed.get(file)?.file;
  host.fileExists = (file) => parsed.has(file);
  host.readFile = (file) => modules.get(file);
  const program = ts.createProgram(
    [...parsed.keys()],
    { noResolve: true, noLib: true, target: ts.ScriptTarget.Latest },
    host,
  );
  const checker = program.getTypeChecker();
  for (const [file, module] of parsed) {
    const from = module.place;
    if (!from) continue;
    if (from.layer === "domain" || from.layer === "application") {
      function purity(node: ts.Node): void {
        if (ts.isIdentifier(node) && IMPURE.has(node.text) && reference(node)) {
          const symbol = ts.isShorthandPropertyAssignment(node.parent)
            ? checker.getShorthandAssignmentValueSymbol(node.parent)
            : checker.getSymbolAtLocation(node);
          const local = symbol?.declarations?.some((declaration) =>
            parsed.has(declaration.getSourceFile().fileName),
          );
          if (!local) report(file, `${from?.layer} must stay pure (${node.text})`);
        }
        // Reject acquiring an ambient capability as well as calling it: a later alias
        // invocation must not make a direct global method read look like an injected port.
        const ambientMethod = (owner: string, member: string | null) =>
          ((owner === "Date" || owner === "performance") && member === "now") ||
          (owner === "Math" && member === "random");
        let clockOwner: ts.Identifier | undefined;
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ambientMethod(node.expression.text, node.name.text)
        ) {
          clockOwner = node.expression;
        } else if (
          ts.isElementAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ambientMethod(node.expression.text, literal(node.argumentExpression))
        ) {
          clockOwner = node.expression;
        } else if (
          (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
          ts.isObjectBindingPattern(node.name) &&
          node.initializer &&
          ts.isIdentifier(node.initializer)
        ) {
          const owner = node.initializer;
          if (
            node.name.elements.some((element) => {
              const property = element.propertyName ?? element.name;
              const member = ts.isIdentifier(property)
                ? property.text
                : ts.isComputedPropertyName(property)
                  ? literal(property.expression)
                  : literal(property);
              return !element.dotDotDotToken && ambientMethod(owner.text, member);
            })
          )
            clockOwner = owner;
        } else if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "Date" &&
          (node.arguments?.length ?? 0) === 0
        ) {
          clockOwner = node.expression;
        }
        if (clockOwner) {
          const symbol = checker.getSymbolAtLocation(clockOwner);
          if (
            !symbol?.declarations?.some((declaration) =>
              parsed.has(declaration.getSourceFile().fileName),
            )
          )
            report(file, `${from?.layer} must stay pure (ambient clock or randomness)`);
        }
        ts.forEachChild(node, purity);
      }
      purity(module.file);
    }
    for (const edge of module.edges) {
      const specifier = edge.specifier;
      if (!specifier) {
        report(file, "computed module specifier is not allowed");
        continue;
      }
      const local =
        specifier.startsWith("@/") || specifier.startsWith(".") || path.isAbsolute(specifier);
      if (!local) {
        const pkg = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (!BUILTINS.has(specifier) && !PACKAGES.has(pkg ?? ""))
          report(file, `undeclared package ${specifier}`);
        if (from.layer === "domain" || from.layer === "application")
          report(file, `${from.layer} may not import package ${specifier}`);
        if (from.layer === "presentation" && privatePackage(specifier))
          report(file, `presentation may not import ${specifier}`);
        continue;
      }
      const target = specifier.startsWith("@/")
        ? path.resolve(src, specifier.slice(2))
        : path.resolve(path.dirname(file), specifier);
      if (path.isAbsolute(specifier) || !target.startsWith(`${src}${path.sep}`)) {
        report(file, `imports outside src (${specifier})`);
        continue;
      }
      const candidates = [
        target,
        ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"].map((suffix) => `${target}${suffix}`),
        path.join(target, "index.ts"),
        path.join(target, "index.tsx"),
      ].filter((candidate) => modules.has(candidate));
      if (candidates.length !== 1) {
        report(
          file,
          `${candidates.length ? "ambiguous" : "unresolved"} local target (${specifier})`,
        );
        continue;
      }
      const resolved = candidates[0];
      if (!resolved) continue;
      if (!CODE.test(resolved)) {
        if (!LEAF.test(resolved)) report(file, `unsupported local resource (${specifier})`);
        const resourcePlace = place(src, resolved);
        if (!resourcePlace || !ALLOWED[from.layer].includes(resourcePlace.layer))
          report(file, `resource violates layer boundary (${specifier})`);
        graph.get(file)?.push({ target: resolved, runtime: !edge.typeOnly, rpc: false });
        continue;
      }
      const to = parsed.get(resolved);
      if (!to?.place) {
        report(file, `dependency has unknown source placement (${specifier})`);
        continue;
      }
      const exported = actionExports(to.file);
      const rpc =
        (from.layer === "presentation" || from.layer === "app") &&
        !edge.typeOnly &&
        to.action &&
        edge.names !== null &&
        edge.names.length > 0 &&
        edge.names.every((name) => exported?.has(name));
      graph.get(file)?.push({ target: resolved, runtime: !edge.typeOnly, rpc });
      if (!rpc && !ALLOWED[from.layer].includes(to.place.layer))
        report(file, `${from.layer} may not import ${to.place.layer} (${specifier})`);
      else if (from.feature && to.place.feature && from.feature !== to.place.feature)
        report(
          file,
          `feature ${from.feature} may not import feature ${to.place.feature} (${specifier})`,
        );
      if (from.layer === "presentation" && to.place.layer === "application" && !edge.typeOnly)
        report(file, "presentation may only import application types");
    }
  }
  // All source edges count for cycles, including type-only edges; RPC changes runtime reachability only.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function cycle(file: string, chain: string[]): void {
    if (visiting.has(file)) {
      report(
        file,
        `dependency cycle: ${[...chain, file].map((name) => posix(path.relative(src, name))).join(" -> ")}`,
      );
      return;
    }
    if (visited.has(file)) return;
    visiting.add(file);
    for (const edge of graph.get(file) ?? []) cycle(edge.target, [...chain, file]);
    visiting.delete(file);
    visited.add(file);
  }
  for (const file of parsed.keys()) cycle(file, []);
  for (const [entry, module] of parsed) {
    if (!module.client) continue;
    const seen = new Set<string>();
    function client(file: string): void {
      if (seen.has(file)) return;
      seen.add(file);
      const current = parsed.get(file);
      if (place(src, file)?.layer === "server")
        report(
          entry,
          `client runtime reaches private server module ${posix(path.relative(src, file))}`,
        );
      if (!current) return;
      function privateEnvironment(node: ts.Node): void {
        if (
          ts.isIdentifier(node) &&
          (node.text === "process" || node.text === "globalThis") &&
          reference(node)
        ) {
          const symbol = checker.getSymbolAtLocation(node);
          if (
            !symbol?.declarations?.some((declaration) =>
              parsed.has(declaration.getSourceFile().fileName),
            )
          )
            report(entry, "client runtime accesses process/global environment");
        }
        ts.forEachChild(node, privateEnvironment);
      }
      privateEnvironment(current.file);
      for (const edge of current.edges)
        if (!edge.typeOnly && edge.specifier && privatePackage(edge.specifier))
          report(entry, `client runtime reaches server package ${edge.specifier}`);
      for (const edge of graph.get(file) ?? []) if (edge.runtime && !edge.rpc) client(edge.target);
    }
    client(entry);
  }
  return [...new Set(problems)].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = walk(path.join(ROOT, "src"));
  const problems = checkBoundaries(
    new Map(files.map((file) => [file, readFileSync(file, "utf8")])),
    ROOT,
  );
  for (const problem of problems) console.error(problem);
  console.log(
    `Boundaries: ${files.filter((file) => CODE.test(file)).length} modules checked, ${problems.length} violations.`,
  );
  if (problems.length) process.exitCode = 1;
}
