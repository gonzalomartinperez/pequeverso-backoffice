"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { es } from "#shared/i18n/es.ts";
import { cn } from "#shared/lib/cn.ts";

const LINKS = [
  { href: "/panel", label: es.panel.status, owner: false },
  { href: "/panel/analitica", label: es.analytics.title, owner: false },
  { href: "/panel/accesos", label: es.access.title, owner: true },
  { href: "/panel/cuenta", label: es.panel.account, owner: false },
] as const;

export function PanelNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label={es.panel.name}>
      <ul className="flex flex-wrap gap-1">
        {LINKS.filter((link) => owner || !link.owner).map((link) => {
          const current = path === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill px-3 text-small font-extrabold no-underline",
                  current ? "bg-chip text-on-chip" : "text-copy hover:bg-ink/5",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
