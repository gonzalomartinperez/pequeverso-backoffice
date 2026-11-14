// Renders docs/reference/permissions.md from the authz matrix (tests/authz/matrix.ts). The file is
// generated, never hand-edited: `node scripts/generate-permissions.ts` rewrites it and
// tests/unit/permissions-doc.test.ts fails when the committed copy is stale.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Caller, expectedOutcome, MATRIX } from "../tests/authz/matrix.ts";

export const PERMISSIONS_DOC = "docs/reference/permissions.md";
const CALLERS: Caller[] = ["owner", "viewer", "anonymous"];

export function renderPermissions(): string {
  const lines = [
    "# Permissions matrix",
    "",
    "Generated from `tests/authz/matrix.ts` by `scripts/generate-permissions.ts`; do not edit by hand.",
    "Each row is one server action, route handler or panel page. Outcomes derive from `can()` in",
    "`src/features/auth/domain/access.ts`; `tests/unit/authz-matrix.test.ts` fails when this list and the",
    "source drift apart.",
    "",
    "| Kind | Entry | Guard | Owner | Viewer | Anonymous |",
    "|---|---|---|---|---|---|",
  ];
  for (const row of MATRIX) {
    const [kind = "", rest = ""] = [
      row.id.slice(0, row.id.indexOf(":")),
      row.id.slice(row.id.indexOf(":") + 1),
    ];
    const cells = CALLERS.map((caller) => `\`${expectedOutcome(row.guard, caller)}\``);
    lines.push(
      `| ${kind} | \`${rest.replaceAll("|", "\\|")}\` | \`${row.guard}\` | ${cells.join(" | ")} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.resolve(import.meta.dirname, "..", PERMISSIONS_DOC), renderPermissions());
}
