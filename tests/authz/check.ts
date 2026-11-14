import { readFileSync } from "node:fs";
import path from "node:path";
import type { SurfaceEntry } from "../../scripts/authz-surface.ts";
import { type Action, can } from "../../src/features/auth/domain/access.ts";
import type { Row } from "./matrix.ts";

const ROLES = ["owner", "viewer"] as const;
const SESSION = new Set<string>(["manage_access", "read_operations"]);

export type CheckOptions = {
  /** Reads a project file for the coverage check; null when absent. Default: from `root`. */
  read?: (file: string) => string | null;
  root?: string;
};

function defaultReader(root: string) {
  return (file: string) => {
    try {
      return readFileSync(path.join(root, file), "utf8");
    } catch {
      return null;
    }
  };
}

/** Roles for which every guard in the list passes (the entry's effective audience). */
const audience = (guards: readonly string[]) =>
  ROLES.filter((role) => guards.every((guard) => can(role, guard as Action)));

/**
 * Every disagreement between the enumerated surface and the matrix; empty means in sync.
 * Guards count only when verified (awaited, unconditional, top-level); a layout never covers a page.
 */
export function checkGuards(
  surface: readonly SurfaceEntry[],
  matrix: readonly Row[],
  options: CheckOptions = {},
): string[] {
  const problems: string[] = [];
  const read = options.read ?? defaultReader(options.root ?? process.cwd());
  const ids = surface.map((entry) => entry.id);
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index)))
    problems.push(`duplicate surface id: ${id}`);
  const rows = new Map<string, Row>();
  for (const row of matrix) {
    if (rows.has(row.id)) problems.push(`duplicate matrix row: ${row.id}`);
    rows.set(row.id, row);
  }
  const found = new Map(surface.map((entry) => [entry.id, entry]));
  for (const id of found.keys()) if (!rows.has(id)) problems.push(`unlisted: ${id}`);
  for (const id of rows.keys()) if (!found.has(id)) problems.push(`stale: ${id}`);

  for (const entry of surface) {
    for (const problem of entry.problems) problems.push(`${entry.id}: ${problem}`);
    const row = rows.get(entry.id);
    if (!row) continue;
    const at = entry.id;
    if (row.guard === "public") {
      if (entry.guards.length > 0) problems.push(`${at}: listed public but runs ${entry.guards}`);
    } else if (row.guard === "better-auth" || row.guard === "bearer-token") {
      if (!entry.markers.includes(row.guard))
        problems.push(`${at}: no recognizable ${row.guard} check in the source`);
    } else {
      if (entry.reexport) problems.push(`${at}: guard cannot be verified through a re-export`);
      else if (entry.guards.length === 0)
        problems.push(
          `${at}: no verified requireActor guard: make \`await requireActor("<literal>")\` (imported from src/server/auth) the first statement of the function body; only directives and call-free const declarations may precede it`,
        );
      else if (entry.guards.includes("?"))
        problems.push(`${at}: requireActor needs a literal action`);
      else {
        const wanted = ROLES.filter((role) => can(role, row.guard as Action));
        if (audience(entry.guards).join() !== wanted.join())
          problems.push(`${at}: source guards ${entry.guards} do not match ${row.guard}`);
        if (entry.kind === "action" && entry.guards.join() !== row.guard)
          problems.push(
            `${at}: an action must re-check exactly ${row.guard}, found ${entry.guards}`,
          );
      }
    }
    if (SESSION.has(row.guard) && entry.kind === "route" && entry.markers.length > 0)
      problems.push(`${at}: mixes session guard and ${entry.markers}`);
    if (row.covers !== "static-only") {
      const text = read(row.covers.file);
      if (text === null) problems.push(`${at}: covering test ${row.covers.file} does not exist`);
      else if (!text.includes(row.covers.needle))
        problems.push(`${at}: ${row.covers.file} never mentions ${row.covers.needle}`);
    }
  }
  return problems;
}
