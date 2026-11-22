import { LinkProviderButton } from "#features/auth/presentation/account-controls.tsx";
import { accessDeps, enabledProviders, requireActor } from "#server/auth.ts";
import { es } from "#shared/i18n/es.ts";
import { Section } from "#shared/ui/sections.tsx";

export default async function AccountPage() {
  const actor = await requireActor("read_operations");
  const member = await accessDeps().store.memberByEmail(actor.email);
  const linked = new Set(member?.providers ?? []);
  // Explicit linking is offered to owners only (Better Auth's /link-social is also refused
  // server-side for anyone else).
  const available =
    actor.role === "owner" ? enabledProviders().filter((provider) => !linked.has(provider.id)) : [];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading">{es.account.title}</h1>
      <Section
        id="identities"
        title={es.account.linkedIdentities}
        description={es.account.linkPolicy}
      >
        <p className="text-small text-copy">
          {es.account.identitySummary(
            actor.email,
            [...linked].join(", ") || es.account.noIdentities,
          )}
        </p>
        {available.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {available.map((provider) => (
              <LinkProviderButton key={provider.id} provider={provider.id} label={provider.label} />
            ))}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
