// Enumerates the authorization surface of the app from source (static, TS compiler API): every
// server action, every route handler and every page/layout under src/app/panel. The authz matrix
// (tests/authz/matrix.ts) must list exactly this set; see tests/unit/authz-matrix.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "@typescript/typescript6";

export type SurfaceKind = "action" | "route" | "page";
export type SurfaceEntry = {
  /** Stable key: `<kind>:<posix path from root>#<export>`. */
  id: string;
  kind: SurfaceKind;
  file: string;
  name: string;
  /** Anything but a GET route handler, and every server action, may change state. */
  mutating: boolean;
  /** String literals passed to `requireActor(...)` inside this entry's own code. */
  guards: string[];
};

const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const posix = (root: string, file: string) => path.relative(root, file).split(path.sep).join("/");

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

const hasExport = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const hasDefault = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

function isDirective(statement: ts.Statement, text: string): boolean {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === text
  );
}

/** Literals of `requireActor("…")` calls under a node. A non-literal argument is reported as `?`. */
function guardsIn(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (child: ts.Node): void => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "requireActor"
    ) {
      const [arg] = child.arguments;
      found.push(arg && ts.isStringLiteralLike(arg) ? arg.text : "?");
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

type Exported = { name: string; node: ts.Node };

/** Every exported binding of a module; `export *` and `export … from` cannot be enumerated. */
function exportsOf(source: ts.SourceFile): Exported[] {
  const local = new Map<string, ts.Node>();
  const out: Exported[] = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      local.set(statement.name.text, statement);
      if (hasExport(statement))
        out.push({
          name: hasDefault(statement) ? "default" : statement.name.text,
          node: statement,
        });
      else if (hasDefault(statement)) out.push({ name: "default", node: statement });
    } else if (ts.isFunctionDeclaration(statement) && hasDefault(statement)) {
      out.push({ name: "default", node: statement });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        local.set(declaration.name.text, declaration);
        if (hasExport(statement)) out.push({ name: declaration.name.text, node: declaration });
      }
    } else if (ts.isExportAssignment(statement)) {
      out.push({ name: "default", node: statement });
    } else if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause || statement.moduleSpecifier)
        out.push({
          name: `*:${statement.moduleSpecifier ? statement.moduleSpecifier.getText(source).slice(1, -1) : "all"}`,
          node: statement,
        });
      else if (ts.isNamedExports(statement.exportClause) && !statement.isTypeOnly)
        for (const element of statement.exportClause.elements)
          if (!element.isTypeOnly)
            out.push({
              name: element.name.text,
              node: local.get((element.propertyName ?? element.name).text) ?? element,
            });
    } else if (
      (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      hasExport(statement) &&
      statement.name
    ) {
      out.push({ name: statement.name.text, node: statement });
    }
  }
  return out;
}

function inlineActions(source: ts.SourceFile): Exported[] {
  const found: Exported[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.body &&
      ts.isBlock(node.body) &&
      node.body.statements.some((s) => isDirective(s, "use server"))
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : `inline@${line}`;
      found.push({ name: `inline:${name}`, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

export function discoverSurface(root: string): SurfaceEntry[] {
  const entries: SurfaceEntry[] = [];
  const src = path.join(root, "src");
  for (const file of walk(src).sort()) {
    const rel = posix(root, file);
    const base = path.basename(file);
    if (!/\.(ts|tsx)$/.test(base) || /\.d\.ts$/.test(base)) continue;
    const source = parse(file);
    const add = (kind: SurfaceKind, item: Exported, mutating: boolean) =>
      entries.push({
        id: `${kind}:${rel}#${item.name}`,
        kind,
        file: rel,
        name: item.name,
        mutating,
        guards: guardsIn(item.node),
      });

    if (source.statements.some((s) => isDirective(s, "use server"))) {
      for (const item of exportsOf(source)) add("action", item, true);
    } else {
      for (const item of inlineActions(source)) add("action", item, true);
    }
    if (/^src\/app\/(?:.*\/)?route\.ts$/.test(rel)) {
      for (const item of exportsOf(source)) {
        if (HTTP_METHODS.has(item.name) || item.name.startsWith("*:"))
          add("route", item, item.name !== "GET");
      }
    }
    if (/^src\/app\/panel\/(?:.*\/)?(?:page|layout)\.tsx$/.test(rel)) {
      for (const item of exportsOf(source).filter((e) => e.name === "default"))
        add("page", item, false);
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/** Guards that apply to a panel page: its own plus those of every ancestor layout. */
export function inheritedGuards(entries: SurfaceEntry[], entry: SurfaceEntry): string[] {
  if (entry.kind !== "page") return entry.guards;
  const chain = new Set<string>(entry.guards);
  let dir = path.posix.dirname(entry.file);
  while (dir.startsWith("src/app/panel")) {
    for (const other of entries)
      if (other.kind === "page" && other.file === `${dir}/layout.tsx`)
        for (const guard of other.guards) chain.add(guard);
    dir = path.posix.dirname(dir);
  }
  return [...chain].sort();
}
