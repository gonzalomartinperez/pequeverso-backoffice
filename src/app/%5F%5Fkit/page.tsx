import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Kit (solo desarrollo)", robots: { index: false } };
// Rendered per request so the gate below is evaluated by the running server, never prerendered.
export const dynamic = "force-dynamic";

/**
 * Development-only component kit (skeleton for M2: every shared component in every state).
 * The gate is the build mode, not an environment flag: `next build` and `next start` always run
 * with NODE_ENV=production, so there is no variable that could turn this page on in production.
 * The folder is `%5F%5Fkit` because a leading underscore would make it a private folder.
 * tests/browser/sign-in.spec.ts proves the production server answers 404.
 */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="contenido" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Kit de componentes</h1>
      <p data-testid="kit-marker" className="text-copy">
        Esqueleto de desarrollo: los componentes se añaden aquí con todos sus estados.
      </p>
    </main>
  );
}
