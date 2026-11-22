import type { Metadata } from "next";
import { es } from "#shared/i18n/es.ts";

export const metadata: Metadata = { title: es.kit.metadataTitle, robots: { index: false } };

/**
 * Development-only component kit (skeleton for M2: every shared component in every state).
 * `page.dev.tsx` is a route only outside production builds (`pageExtensions` in next.config.ts),
 * so production never contains it (tests/browser/sign-in.spec.ts checks the 404 and the route
 * manifest). The page reads no environment (tests/unit/leak-scan.test.ts).
 * The folder is `%5F%5Fkit` because a leading underscore would make it a private folder.
 */
export default function KitPage() {
  return (
    <main id="contenido" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">{es.kit.title}</h1>
      <p data-testid="kit-marker" className="text-copy">
        {es.kit.description}
      </p>
    </main>
  );
}
