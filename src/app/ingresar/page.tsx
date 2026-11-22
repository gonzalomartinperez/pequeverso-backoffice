import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackofficeFrame } from "#features/auth/presentation/backoffice-frame.tsx";
import { SignInPanel } from "#features/auth/presentation/sign-in-panel.tsx";
import { authReady, currentActor, enabledProviders } from "#server/auth.ts";
import { es } from "#shared/i18n/es.ts";
import { Callout } from "#shared/ui/callout.tsx";

export const metadata: Metadata = { title: es.signIn.metadataTitle };

const ERRORS: Record<string, string> = {
  invitation_invalid: es.signIn.errors.invitationInvalid,
  unable_to_create_user: es.signIn.errors.unableToCreateUser,
  account_not_linked: es.signIn.errors.accountNotLinked,
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ready = await authReady();
  if (ready) {
    let signedIn = false;
    try {
      signedIn = (await currentActor()) !== null;
    } catch {
      signedIn = false;
    }
    if (signedIn) redirect("/panel");
  }
  const error = typeof params.error === "string" ? params.error : null;
  const invited = params.invitacion === "1";
  const providers = ready ? enabledProviders() : [];
  return (
    <BackofficeFrame>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-heading">{es.signIn.title}</h1>
          <p className="text-small text-copy">{es.signIn.description}</p>
        </header>
        {!ready || error === "unavailable" ? (
          <Callout tone="danger" role="alert" data-testid="sign-in-unavailable">
            <p>{es.signIn.errors.unavailable}</p>
          </Callout>
        ) : null}
        {invited && ready ? (
          <Callout tone="info" role="status">
            <p>{es.signIn.invited}</p>
          </Callout>
        ) : null}
        {error && error !== "unavailable" ? (
          <Callout tone="danger" role="alert" data-testid="sign-in-error">
            <p>{ERRORS[error] ?? es.signIn.errors.noAccess}</p>
          </Callout>
        ) : null}
        {ready ? <SignInPanel providers={providers} /> : null}
      </div>
    </BackofficeFrame>
  );
}
