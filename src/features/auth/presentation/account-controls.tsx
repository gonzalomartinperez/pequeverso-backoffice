"use client";
import { Link2, LogOut } from "lucide-react";
import { useState } from "react";
import { es } from "#shared/i18n/es.ts";
import { Button } from "#shared/ui/button.tsx";
import { authClient } from "./auth-client.ts";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        window.location.assign("/ingresar");
      }}
    >
      <LogOut aria-hidden="true" />
      {es.account.signOut}
    </Button>
  );
}

/**
 * Explicit linking of another provider to the signed-in account. Better Auth only links an
 * identity whose verified e-mail equals this account's e-mail (different e-mails are refused).
 */
export function LinkProviderButton({ provider, label }: { provider: string; label: string }) {
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={state === "pending"}
        onClick={async () => {
          setState("pending");
          const result = await authClient.linkSocial({ provider, callbackURL: "/panel/cuenta" });
          if (result.error) setState("failed");
        }}
      >
        <Link2 aria-hidden="true" />
        {es.account.linkProvider(label)}
      </Button>
      {state === "failed" ? (
        <p role="alert" className="text-tiny text-danger">
          {es.account.linkFailed}
        </p>
      ) : null}
    </div>
  );
}
