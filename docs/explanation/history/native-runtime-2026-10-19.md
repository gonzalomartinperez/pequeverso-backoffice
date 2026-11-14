# Native backoffice evidence — 2026-10-19

The exact V22 local fixture pair passed at `2026-10-19T04:19:04.912914Z`. All nine criteria
A–I completed, with zero skips and zero provider SDK calls. Root inspected the three native
PNGs and approved byte-for-byte delivery as an agent review; this is not human or physical-device
review. No failed-run image is accepted.

## Exact sources and separate artifacts

The local pair binds API `850e78cf84df78f0ea66e2811e92aeb15a6f5d04` and backoffice `ee06832910882dc37b9916a6248ecde5841c1c85`
(tree `37b73c7c2f06f7913b7cd06cc6cf6baa5e4b5e92`). Five committed analytics artifacts are
byte-equal and the consumer pins that exact API producer. The privately authenticated report
uses separate API aggregates and IAM databases, a local fake identity provider, and clearly
synthetic event data. It does not join operator identity to site events.

The fresh native backoffice build finished at `2026-10-19T04:00:03.012382Z`; its build step took
32.471 seconds. Source before/after remained clean. Build proof SHA256:
`50a3b58836f8209549ed43087ca8f309cc2532b2fa347711ac382c56676a2123`;
compiled payload SHA256:
`63a0ed2acb8d0d68188da8279c1a955a69a9ca9762d73b297fbb6efbfe3ba86c`.
The payload has one explicitly bound external dependency-directory link. It is a local fixture
artifact, not portable; the source and installed locks are independently bound in its proof.

The separately built exact backoffice image is
`sha256:344bb23f301b6e108dec096a0c94cbc74b9c2fea70ae82ce044005132ec1e0b7`;
its OCI config digest is
`sha256:d8ef03eb2a1722636a358e6149d64c907733dfe9134e1964da4563890de3ae1b`.
On Docker 29 the saved legacy `config_id` field equals the image manifest identifier; it must
not be confused with the independently extracted OCI config digest above. The image's native
synthetic smoke passed at `2026-10-19T04:02:50.739274Z`: UID65532, read-only filesystem,
no-network identity probe, legal notices, health/readiness, unauthenticated access, database
loss and graceful application shutdown. Its own runtime resources were removed and its own
builder was stopped and retained. This image smoke is separate from authenticated paired UI
acceptance and does not establish a VPS deployment or real OAuth.

## Advisory image scan

The offline cached-database scan completed at `2026-10-19T04:08:15.960272Z`.
Independent scan audit SHA256:
`d8b107636481d2a3bbfaa447b8b2669130d8149a5166f38a6b4b4c5ded7811eb`.
For the exact backoffice image above it recorded 31 affected package/advisory rows:
0 critical, 0 high, 23 medium and 8 low (25 unique advisories). No row reported a FixedVersion;
that does not prove no fix exists. Debian and Node result sets were present; the Node set
reported no findings. Coverage is not an exhaustive audit of all vendored/native code.
Findings remain advisory under the current owner policy; they are not suppressed or waived.
The scanner's raw zero-finding gate remained blocked. This is not a zero-CVE PASS.

The same scan also examined the historical API121 image. It is not relabelled as an API850
image; the current pair executes the actual API850 archive. Recorded runtime-byte equivalence
is a separate source fact, not a new native image build.

## Paired runtime and capture acceptance

V22 executed the actual API850 archive and the fresh exact EE native Next payload. Both browser
phases passed. Three axe scans reported zero violations. Native owner invitation, fake OAuth
viewer admission, viewer access denial, synthetic event reconciliation, private response-body
privacy checks and source/pin guards completed. The selected report remains nine received events;
the global fixture count also includes the real local collector receipts and is not labelled nine.

The owner invitation response is drained before creating the viewer context. Native private
navigation has prefetch disabled; explicit navigation and strict response-body scanning remain.
All body limits and the existing eight-second body-completion gate are retained. This successful
run is not proof that every historical canceled response had the same cause.

After query clients stopped, Neo completed its normal admitted shutdown with exit0, PID0 and
no OOM before the cold data copy. The independent emergency cleanup deadline was not extended.
Six backup artifacts were produced. Root checked the dump headers, strict005+006 analytics TOCs,
IAM, password-free globals and safe Neo tar before issuing the proof-bound deletion ACK.
Backup proof SHA256: `ea8936517517d806f8cc2256b3639940cfdcb3685f9a8f09eb8f2512185acf04`.
Root ACK SHA256: `114a6ebf791d734e6adfbff65084a5e1cc414a6941ef421b84d068b72fb03c4a`.
FIN SHA256: `0211e5d9fc57d7ab81ec563795e6b504127e725743f7fef206033a0165ed2f13`.
This proves the recorded backup and custody gate; a fresh restore of these artifacts was not run.

FIN records controller exit0, a reaped controller, A–I true, no owned live groups, listeners,
resources or inspection errors, and completion before the deadline. These are this run's owned
resources only. Earlier failed-run custody and the retained builder are separate; no global
Docker-empty claim is made. Earlier failures remain preserved and are not relabelled as passes.

The [capture manifest](analytics-native-2026-10-19/capture-manifest.json) binds each original's
SHA256, byte size, dimensions, exact sources and agent visual approval. Root reviewed the actual
desktop OFF/ON and mobile390 images: controls and cards were readable, mobile content wrapped
naturally, and the wide table retained its own horizontal scroll region. Screenshot inspection
is not an exhaustive device or accessibility certification. Native files:

- [Disabled desktop](analytics-native-2026-10-19/off-desktop.png).
- [Enabled desktop, nine synthetic events](analytics-native-2026-10-19/on-desktop-nine.png).
- [Enabled mobile, nine synthetic events](analytics-native-2026-10-19/on-mobile-nine.png).

The historical [availability gallery](compact-availability-2026-10-13/README.md) and all its
26 existing light/dark image links retain their original bytes and provenance. No new dark
site-activity capture is claimed. These are agent-reviewed local fixtures, not human/holdout
review, production activation, real OAuth, provider/model quality or deployed trusted-country
provenance. Historical countries and retention remain governed by the pinned contract.
