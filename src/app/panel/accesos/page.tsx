import { invitationState } from "#features/auth/domain/access.ts";
import { ConfirmAction } from "#features/auth/presentation/confirm-action.tsx";
import { InviteForm } from "#features/auth/presentation/invite-form.tsx";
import { accessDeps, requireActor } from "#server/auth.ts";
import { config } from "#server/env.ts";
import { es } from "#shared/i18n/es.ts";
import { when } from "#shared/lib/format.ts";
import { Section, TableRegion, td, th } from "#shared/ui/sections.tsx";
import { inviteAction, removeMemberAction, revokeInvitationAction } from "./actions.ts";

export default async function AccessPage() {
  const actor = await requireActor("manage_access");
  const deps = accessDeps();
  const [members, invitations] = await Promise.all([
    deps.store.listMembers(),
    deps.store.listInvitations(),
  ]);
  const now = new Date();
  const ownerEmail = config().ownerEmail;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading">{es.access.title}</h1>
        <p className="text-small text-muted">{es.access.description}</p>
      </header>
      <Section id="invite" title={es.access.invitePerson}>
        <InviteForm action={inviteAction} />
      </Section>
      <Section id="members" title={es.access.members}>
        <TableRegion label={es.access.members}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  {es.access.email}
                </th>
                <th scope="col" className={th}>
                  {es.access.role}
                </th>
                <th scope="col" className={th}>
                  {es.access.providers}
                </th>
                <th scope="col" className={th}>
                  {es.access.activeSessions}
                </th>
                <th scope="col" className={th}>
                  {es.access.membershipStart}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">{es.access.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <th
                    scope="row"
                    className={`${td} text-left font-normal [overflow-wrap:break-word]`}
                  >
                    {member.email}
                  </th>
                  <td className={td}>
                    {member.role === "owner" ? es.common.owner : es.common.viewer}
                  </td>
                  <td className={td}>{member.providers.join(", ") || es.common.dash}</td>
                  <td className={td}>{member.activeSessions}</td>
                  <td className={`${td} whitespace-nowrap`}>{when(member.createdAt)}</td>
                  <td className={td}>
                    {member.id === actor.id ? (
                      <span className="text-tiny text-muted">{es.account.title}</span>
                    ) : member.email === ownerEmail ? (
                      <span className="text-tiny text-muted">{es.access.configuredOwner}</span>
                    ) : (
                      <ConfirmAction
                        label={es.access.removeAccess}
                        subject={member.email}
                        title={es.access.removeTitle}
                        description={es.access.removeDescription}
                        confirmLabel={es.access.removeAccess}
                        fallbackFocusId="members-title"
                        action={removeMemberAction.bind(null, member.id)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </Section>
      <Section id="invitations" title={es.access.invitations}>
        {invitations.length === 0 ? (
          <p className="text-small text-copy">{es.access.noInvitations}</p>
        ) : (
          <TableRegion label={es.access.invitations}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {es.access.email}
                  </th>
                  <th scope="col" className={th}>
                    {es.access.role}
                  </th>
                  <th scope="col" className={th}>
                    {es.access.status}
                  </th>
                  <th scope="col" className={th}>
                    {es.access.expires}
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{es.access.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const state = invitationState(invitation, now);
                  return (
                    <tr key={invitation.id}>
                      <th
                        scope="row"
                        className={`${td} text-left font-normal [overflow-wrap:break-word]`}
                      >
                        {invitation.email}
                      </th>
                      <td className={td}>
                        {invitation.role === "owner" ? es.common.owner : es.common.viewer}
                      </td>
                      <td className={td}>{es.access.invitationStatus[state]}</td>
                      <td className={`${td} whitespace-nowrap`}>{when(invitation.expiresAt)}</td>
                      <td className={td}>
                        {state === "pending" ? (
                          <ConfirmAction
                            label={es.access.revoke}
                            subject={invitation.email}
                            title={es.access.revokeTitle}
                            description={es.access.revokeDescription}
                            confirmLabel={es.access.revokeInvitation}
                            fallbackFocusId="invitations-title"
                            action={revokeInvitationAction.bind(null, invitation.id)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableRegion>
        )}
      </Section>
    </div>
  );
}
