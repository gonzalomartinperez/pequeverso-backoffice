# Local fixture site analytics

The owner-authorized local fixture capability reads a separate Peque API report at
`GET /internal/v1/ops/product-analytics`. It preserves the existing operational summary1.2
and telemetry1.0 dashboard. It adds no collector or visitor tracking to this application
or the storefront. Advertising, Meta/CAPI, consent/banner and checkout behavior stay outside
this feature. Production collection and activation need separate authorization.

`PRODUCT_ANALYTICS_READ_ENABLED=false` is the server-only default. Turning it on is refused
in the production environment. The fixture uses the existing validated private `OPS_API_URL`
and server-only `OPS_READ_TOKEN`; no token or private origin reaches the browser. Every read
awaits `requireActor("read_operations")` first, including the loader itself because a layout
may render concurrently with its page. Existing owner/viewer access remains unchanged.

The `/panel/analitica` page inherits the panel's private/no-store/noindex headers and nonce CSP.
Its adapter has a four-second whole-response deadline, a 256 KiB actual-byte cap, strict UTF-8,
no redirects, cache, cookies, browser-header forwarding or retries. HTTP404 is disabled; other
failures or invalid payloads are unavailable, never a fabricated zero. Disabled reads do no IO.
Only a closed schema1 Peque report with `synthetic: true` is accepted. The generated example's
`fixture/scope/report` envelope is test metadata; HTTP returns the report at the top level.

## Measures and filters

Day, ISO Monday week and calendar month selections use UTC half-open intervals and offsets0–2.
The current interval is partial. Every filter applies uniformly to every aggregate. Route/section
pairs come from the reviewed Peque profile, not arbitrary paths or Portfolio identifiers. Native
GET controls submit only on request; changing a page resets its section without a network read.

Counts measure received `page_view`, `section_view` and pointer-only `public_click` events.
Keyboard activations emit no pointer event in this increment; no grid coordinates are invented.
These are not people, unique visits, sales or attribution. First/last receipt timestamps describe
observed events, not enablement or uptime. An empty valid report means no received events for
the selection and does not establish that the site had no traffic.

Country collection is disabled. The country table counts all three event types together:
zero yields no row;1–2 events yield `withheld`;3 or more yield `unknown`. It never estimates
nationality or location. An exact route and section make the8×8 pointer grid available; cells
below3 are withheld. Visible, withheld and unselected counts reconcile with received clicks.
An absent cell is not invented zero. Captioned server-rendered tables accompany the visual grid;
Peque semantic tokens, native controls and visible keyboard focus preserve the owned identity.

## Development provenance and acceptance

The schema, example and source profile under `contracts/analytics` were copied with `git show`
from the actual source-reviewed API candidate recorded in `contracts/analytics/source.json`.
File SHA256 values are checked by focused tests. These four generated copies retain producer
formatting through exact Biome path exclusions, matching the existing ops/telemetry convention;
the local provenance stays checked. This producer is a candidate, with no main or deployed
freshness claim. Its status is `committed-reviewed-candidate`, with integration pending.
Before a ready PR, Root must accept the producer integration and update this revision if it
changes. Existing ops and telemetry pins remain separate. Candidate provenance is not runtime
or production proof.

Focused units cover strict wire/calendar/count validation, bounded reads and disabled/error states.
The architecture checker explicitly admits the analytics feature's four existing layer names,
retaining purity, same-feature application types and all cross-feature/client restrictions.
Source/light checks are not browser, IAM, PostgreSQL, restore, paired harness or production proof.

Closure requires the finite fixture path: explicit saved opt-in/withdrawal harness → real API →
isolated synthetic PostgreSQL → authenticated BO, exact counts and source hashes, runtime grants,
calendar/privacy negative cases, accessible tables and required CI. Database/browser/container
execution needs a fresh authorized resource lease. No provider/model call is part of this work.
