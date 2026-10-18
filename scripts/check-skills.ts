// Portable two-client discovery: one procedure, one relative directory link.
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

const catalog = ["web-change-backoffice", "web-review-delivery", "web-verify-backoffice"];
const secret =
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

type Metadata = { name: string; description: string };

function metadata(source: string): { meta: Metadata; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(source);
  if (!match) throw new Error("Missing frontmatter or procedure body");
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const field = /^(name|description):[ \t]+(.+)$/.exec(line);
    if (!field?.[1] || !field[2] || fields.has(field[1]))
      throw new Error("Frontmatter requires unique single-line name and description only");
    const value = field[2];
    let parsed: unknown = value;
    if (value.startsWith('"')) {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("Invalid quoted metadata");
      }
    } else if (value.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("Invalid quoted metadata");
      parsed = value.slice(1, -1).replaceAll("''", "'");
    } else if (/^[[\]{}>&*!|%@`]|:\s|\s#/.test(value)) {
      throw new Error("Only portable string metadata is supported");
    }
    if (typeof parsed !== "string") throw new Error("Metadata must be strings");
    fields.set(field[1], parsed);
  }
  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!/^web-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64)
    throw new Error("Invalid skill name");
  if (description.trim().length < 40 || description.length > 1024)
    throw new Error("Description must contain 40–1024 characters");
  return { meta: { name, description }, body: match[2] ?? "" };
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
  const canonical = path.join(root, ".claude/skills");
  const discovery = path.join(root, ".agents/skills");
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
    fail(canonical, "Canonical catalog must preserve the three backoffice skills");
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
    });
    const link = path.join(discovery, folder);
    attempt(link, () => {
      if (!lstatSync(link).isSymbolicLink())
        throw new Error("Discovery must be a directory symlink, never an editable copy");
      if (
        readlinkSync(link) !== `../../.claude/skills/${folder}` ||
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
