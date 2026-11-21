import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ROUTES_DOC, renderRoutes } from "../../scripts/generate-routes.ts";

describe("docs/reference/routes.md", () => {
  it("is up to date with the app and matrix (run: node scripts/generate-routes.ts)", () => {
    const committed = readFileSync(path.resolve(import.meta.dirname, "../..", ROUTES_DOC), "utf8");
    assert.equal(committed, renderRoutes());
  });

  it("renders URL conventions and labels development pages", () => {
    const page = "export default function Page() {}";
    const rendered = renderRoutes({
      "src/app/(group)/page.tsx": page,
      "src/app/(group)/%5Ffolder/[param]/page.dev.tsx": page,
      "src/app/(group)/layout.tsx": page,
      "src/app/_private/page.tsx": page,
      "src/app/api/auth/[...all]/route.ts": "export function GET() {} export function POST() {}",
      "src/app/actions.ts": '"use server"; export async function save() {}',
      "src/proxy.ts": "export function proxy() {}",
    });
    assert.ok(rendered.includes("| Page | `/` | `src/app/(group)/page.tsx` | — |"));
    assert.ok(
      rendered.includes(
        "| Page (development only) | `/_folder/[param]` | `src/app/(group)/%5Ffolder/[param]/page.dev.tsx` | — |",
      ),
    );
    for (const method of ["GET", "POST"])
      assert.ok(
        rendered.includes(
          `| Route handler | \`${method} /api/auth/[...all]\` | \`src/app/api/auth/[...all]/route.ts\` | \`better-auth\` |`,
        ),
      );
    assert.ok(rendered.includes("| Server action | `save` | `src/app/actions.ts` | — |"));
    assert.doesNotMatch(rendered, /layout\.tsx|_private|proxy\.ts/);
  });
});
