import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignOutButton } from "#features/auth/presentation/account-controls.tsx";
import { BackofficeFrame } from "#features/auth/presentation/backoffice-frame.tsx";
import { PanelNav } from "#features/auth/presentation/panel-nav.tsx";
import { requireActor } from "#server/auth.ts";
import { es } from "#shared/i18n/es.ts";

export const metadata: Metadata = {
  title: es.common.siteTitle,
  robots: { index: false, follow: false },
};

/** Every page under /panel requires an account with a role; the role is re-read per request. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor("read_operations");
  return (
    <BackofficeFrame
      nav={<PanelNav owner={actor.role === "owner"} />}
      account={
        <>
          <span
            className="hidden max-w-56 truncate text-tiny text-muted sm:inline"
            data-testid="actor"
          >
            {actor.email} · {actor.role === "owner" ? es.panel.ownerInline : es.panel.viewerInline}
          </span>
          <span className="text-tiny text-muted sm:hidden" data-testid="actor-role">
            {actor.role === "owner" ? es.common.owner : es.common.viewer}
          </span>
          <SignOutButton />
        </>
      }
    >
      {children}
    </BackofficeFrame>
  );
}
