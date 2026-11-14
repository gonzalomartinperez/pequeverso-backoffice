// Portable two-client discovery: one canonical procedure in .agents, one relative link in .claude.
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const catalog = [
  "implement-task",
  "resume-refactor",
  "review-change",
  "score-repo",
  "update-dependencies",
  "verify-release",
  "write-adr",
];
const secret =
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

type Metadata = { name: string; description: string };

function scalar(value: string): string {
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Falls through to the shared error below.
    }
    throw new Error("Invalid quoted metadata");
  }
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("Invalid quoted metadata");
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/^[[\]{}>&*!|%@`]|:\s|\s#/.test(value))
    throw new Error("Only portable string metadata is supported");
  return value;
}

/** Plain tool names only: no parameterised Bash patterns and no network tools in a skill. */
const ALLOWED_TOOLS = new Set(["Read", "Grep", "Glob", "Bash", "Edit", "Write"]);

// Strict subset: single-line name, description and allowed-tools plus one `metadata:` block
// holding single-line owner, last-reviewed and version strings.
function metadata(source: string): { meta: Metadata; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(source);
  if (!match) throw new Error("Missing frontmatter or procedure body");
  const fields = new Map<string, string>();
  const nested = new Map<string, string>();
  let inBlock = false;
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const child = /^ {2}(owner|last-reviewed|version):[ \t]+(.+)$/.exec(line);
    if (inBlock && child?.[1] && child[2]) {
      if (nested.has(child[1])) throw new Error("Duplicate metadata field");
      nested.set(child[1], scalar(child[2]));
      continue;
    }
    if (line === "metadata:" && !inBlock && !fields.has("metadata")) {
      inBlock = true;
      fields.set("metadata", "");
      continue;
    }
    inBlock = false;
    const field = /^(name|description|allowed-tools):[ \t]+(.+)$/.exec(line);
    if (!field?.[1] || !field[2] || fields.has(field[1]))
      throw new Error("Frontmatter allows unique single-line fields and one metadata block only");
    fields.set(field[1], scalar(field[2]));
  }
  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64)
    throw new Error("Invalid skill name");
  if (description.trim().length < 40 || description.length > 1024)
    throw new Error("Description must contain 40–1024 characters");
  if (!description.includes("Use when") || !description.includes("Not for"))
    throw new Error('Description must contain "Use when" and "Not for"');
  const tools = (fields.get("allowed-tools") ?? "").split(",").map((tool) => tool.trim());
  if (fields.has("allowed-tools") && tools.some((tool) => !ALLOWED_TOOLS.has(tool)))
    throw new Error(`allowed-tools may only list ${[...ALLOWED_TOOLS].join(", ")}`);
  const reviewed = nested.get("last-reviewed") ?? "";
  const date = new Date(`${reviewed}T00:00:00Z`);
  if (
    !nested.get("owner") ||
    !nested.get("version") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reviewed) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== reviewed
  )
    throw new Error("Metadata requires owner, version and last-reviewed (YYYY-MM-DD)");
  const body = match[2] ?? "";
  if (body.split("\n").length - 1 > 120) throw new Error("Procedure body exceeds 120 lines");
  return { meta: { name, description }, body };
}

function evaluations(directory: string): void {
  const read = (file: string): Record<string, unknown> => {
    const data: unknown = JSON.parse(readFileSync(path.join(directory, "evals", file), "utf8"));
    if (typeof data !== "object" || data === null || Array.isArray(data))
      throw new Error(`evals/${file} must be a JSON object`);
    return data as Record<string, unknown>;
  };
  const list = (value: unknown, what: string, minimum: number): Record<string, unknown>[] => {
    if (!Array.isArray(value) || value.length < minimum)
      throw new Error(`${what} needs at least ${minimum} entries`);
    return value.map((entry): Record<string, unknown> => {
      if (typeof entry !== "object" || entry === null) throw new Error(`${what} entry invalid`);
      return entry as Record<string, unknown>;
    });
  };
  const queries = list(read("triggers.json").queries, "evals/triggers.json queries", 10);
  for (const query of queries) {
    if (
      typeof query.query !== "string" ||
      !query.query ||
      typeof query.should_trigger !== "boolean" ||
      (query.split !== "train" && query.split !== "validation")
    )
      throw new Error("Each trigger query needs query, should_trigger and split");
  }
  const positive = queries.filter((query) => query.should_trigger).length;
  const validation = queries.filter((query) => query.split === "validation").length;
  if (positive < 3 || queries.length - positive < 3)
    throw new Error("Triggers need at least 3 positive and 3 negative queries");
  if (validation / queries.length < 0.3 || validation / queries.length > 0.5)
    throw new Error("Validation share of trigger queries must be 30–50%");
  for (const item of list(read("evals.json").evals, "evals/evals.json evals", 3)) {
    if (
      typeof item.prompt !== "string" ||
      !item.prompt ||
      !Array.isArray(item.assertions) ||
      item.assertions.length === 0 ||
      item.assertions.some((assertion) => typeof assertion !== "string" || !assertion)
    )
      throw new Error("Each output eval needs a prompt and non-empty string assertions");
  }
}

export function validateSkills(directoryRoot: string): { names: string[]; errors: string[] } {
  const root = realpathSync(directoryRoot);
  const errors: string[] = [];
  const names: string[] = [];
  const inside = (target: string) => target === root || target.startsWith(root + path.sep);
  const fail = (file: string, message: string) =>
    errors.push(`${path.relative(root, file)}: ${message}`);
  const attempt = (file: string, action: () => void) => {
    try {
      action();
    } catch (error) {
      fail(file, error instanceof Error ? error.message : String(error));
    }
  };
  const scripts = (
    JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts;
  const canonical = path.join(root, ".agents/skills");
  const discovery = path.join(root, ".claude/skills");
  const entries = (directory: string): string[] => {
    try {
      if (!lstatSync(directory).isDirectory() || realpathSync(directory) !== directory)
        throw new Error("Catalog must be a real directory inside the repository");
      return readdirSync(directory).sort();
    } catch (error) {
      fail(directory, error instanceof Error ? error.message : String(error));
      return [];
    }
  };
  const folders = entries(canonical);
  const links = entries(discovery);
  if (JSON.stringify(folders) !== JSON.stringify(catalog))
    fail(canonical, "Canonical catalog must preserve the standard seven-skill catalog");
  if (JSON.stringify(folders) !== JSON.stringify(links)) fail(discovery, "Client catalogs differ");
  attempt(path.join(root, "CLAUDE.md"), () => {
    if (readFileSync(path.join(root, "CLAUDE.md"), "utf8") !== "@AGENTS.md\n")
      throw new Error("CLAUDE.md must import only AGENTS.md");
  });

  function reference(file: string, target: string): void {
    attempt(file, () => {
      const decoded = decodeURIComponent(target.split("#")[0] ?? "");
      const resolved = path.resolve(path.dirname(file), decoded);
      if (!inside(resolved) || !existsSync(resolved) || !inside(realpathSync(resolved)))
        throw new Error(`Missing or external reference: ${target}`);
    });
  }

  function inspect(directory: string): void {
    const children = readdirSync(directory);
    if (!children.length) fail(directory, "Empty scaffold directory");
    for (const name of children) {
      const file = path.join(directory, name);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) {
        fail(file, "Canonical resources must not be symlinks");
      } else if (stat.isDirectory()) {
        inspect(file);
      } else if (stat.isFile()) {
        const source = readFileSync(file, "utf8");
        if (secret.test(source)) fail(file, "Secret-like token");
        if (/\b(?:TODO|FIXME|TBD)\b|\[INSERT\b|<skill-name>/.test(source))
          fail(file, "Unfinished scaffold");
        if (/(?:\/home\/|\/Users\/|\/mnt\/[cd]\/|[A-Z]:\\Users\\|~\/|\$HOME\b)/.test(source))
          fail(file, "Machine-specific or global path");
        if (/allow_implicit_invocation\s*:\s*false/.test(source))
          fail(file, "Automatic discovery must remain enabled");
        if (!file.endsWith(".md")) continue;
        for (const [, target = ""] of source.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
          if (/^(?:https?:|mailto:|#)/.test(target)) continue;
          reference(file, target);
        }
        for (const [, command = ""] of source.matchAll(/\bnpm run ([a-z][a-z0-9:-]*)/g))
          if (!Object.hasOwn(scripts, command)) fail(file, `Unknown npm command: ${command}`);
        for (const match of source.matchAll(/\bscripts\/[\w./-]+/g)) {
          const target = path.resolve(root, match[0]);
          if (!inside(target) || !existsSync(target) || !inside(realpathSync(target)))
            fail(file, `Missing or external executable reference: ${match[0]}`);
        }
      } else fail(file, "Unsupported canonical resource type");
    }
  }

  for (const folder of folders) {
    const directory = path.join(canonical, folder);
    const file = path.join(directory, "SKILL.md");
    attempt(file, () => {
      if (!lstatSync(directory).isDirectory() || !lstatSync(file).isFile())
        throw new Error("Canonical skill and entrypoint must be real directory/file");
      const { meta } = metadata(readFileSync(file, "utf8"));
      if (meta.name !== folder) throw new Error("Directory and skill name differ");
      names.push(meta.name);
      inspect(directory);
      evaluations(directory);
    });
    const link = path.join(discovery, folder);
    attempt(link, () => {
      if (!lstatSync(link).isSymbolicLink())
        throw new Error("Discovery must be a directory symlink, never an editable copy");
      if (
        readlinkSync(link) !== `../../.agents/skills/${folder}` ||
        realpathSync(link) !== directory
      )
        throw new Error("Discovery must resolve to its exact canonical folder by a relative link");
      if (!lstatSync(path.join(link, "SKILL.md")).isFile())
        throw new Error("Discovered entrypoint must be the canonical file");
    });
  }
  return { names: names.sort(), errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = validateSkills(process.argv[2] ?? path.resolve(import.meta.dirname, ".."));
  for (const error of result.errors) console.error(error);
  console.log(`Skills: ${result.names.length} canonical entries, ${result.errors.length} errors.`);
  if (result.errors.length) process.exitCode = 1;
}
