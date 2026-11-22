# ADR 0017: Audit names by live join; session listing privacy

- Status: accepted
- Date: 2026-11-22
- Task: M4.6 (roadmap)

## Context and problem statement

M5 adds an audit view for owners and a session list for every account. Two questions follow.

- The audit table (`backoffice_access_audit`, migration 0002) stores ids only: actor, subject,
  action and time. Where do names come from, and what happens once an account or invitation is
  gone?
- Better Auth's session table holds the full client address, the raw user agent and the session
  token. What may the list show?

## Considered options

1. Copy names into the audit row when it is written.
2. Resolve names at read time with a live join, and keep the stored row id-only.
3. Show ids only.

For sessions: show the raw stored values, or reduce them in the domain before they reach a view.

## Decision outcome

Option 2, and reduce session data.

- **Audit.** `PostgresAccessStore.listAudit` joins the actor's current e-mail and the subject's:
  the invitation e-mail for invitation entries, the member's e-mail for `member_removed`. A
  removed account resolves to null, never to a stale copy. The audit row stays free of e-mails
  and tokens, as migration 0002 promises. Pages are keyset-ordered by (`at`, `id`) at millisecond
  precision, the precision of the cursor. They neither skip nor repeat entries.
- **Audit access.** Owners only: `listAudit` checks `manage_access` before reading.
  `requireActor` re-reads the role on every request.
- **Sessions.** Only the account's own sessions are listed or ended. The token is never selected.
  The client address is shown as its network prefix (IPv4 /24, IPv6 /48). IPv4-mapped and 6to4
  addresses are reduced to the IPv4 /24, and anything unparseable is withheld. The user agent is
  reduced to browser and system families. Ending other sessions requires the current session to
  be one of the actor's live sessions, so a bad id cannot end them all.
- **No schema change.** Ending one's own session is not audited: the audit's action set is fixed
  by migration 0002, and the session list itself is the user's record. The optional migration
  0003 for an audit cursor index is not added. The page query orders by a millisecond-truncated
  expression that a plain `(at, id)` index would not serve. The table holds a few rows per
  member, so a sequential scan is cheaper than maintaining the index. Revisit if the audit
  grows past a few thousand rows.

### Consequences

- Good: names are current and honest, and the stored audit stays minimal.
- Good: the session view cannot leak a full address, a raw agent or a token.
- Bad: a removed member's audit entries show no name. That is the honest state.

### Confirmation

- `tests/integration/account.test.ts`: live names (including removed accounts), keyset pages
  over ties and sub-millisecond times, no token or full address in session views, and actor
  scoping.
- `tests/unit/account.test.ts`: the reductions and the paging properties.
