# Private site analytics

The owner-authorized read-only capability reads a separate Peque API report at
`GET /internal/v1/ops/product-analytics`. It preserves the existing operational summary1.2
and telemetry1.0 dashboard. It adds no collector or visitor tracking to this application
or the storefront. Advertising, Meta/CAPI, consent/banner and checkout behavior stay outside
this feature. Production capability does not authorize deployment or activate collection. Consent is owned by
the separate storefront collector and remains independent of advertising consent.

`PRODUCT_ANALYTICS_READ_ENABLED=false` is the server-only default in every environment. Explicit
opt-in permits a production read without enabling ingestion. The adapter uses the existing validated private `OPS_API_URL`
and server-only `OPS_READ_TOKEN`; no token or private origin reaches the browser. Every read
awaits `requireActor("read_operations")` first, including the loader itself because a layout
may render concurrently with its page. Existing owner/viewer access remains unchanged.

The `/panel/analitica` page inherits the panel's private/no-store/noindex headers and nonce CSP.
Its adapter has a four-second whole-response deadline, a 256 KiB actual-byte cap, strict UTF-8,
no redirects, cache, cookies, browser-header forwarding or retries. HTTP404 is disabled; other
failures or invalid payloads are unavailable, never a fabricated zero. Disabled reads do no IO.
Only a closed schema1 Peque report with boolean `synthetic` is accepted. The UI labels synthetic
data as a local test and `synthetic: false` as API-classified production data; this classification
is not deployment evidence, event provenance or proof of any edge configuration. The API stores
these classes separately, so changing its configuration does not relabel old fixture aggregates. The generated example's
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

The country table counts all three event types together. The closed producer country list is
ISO249 alpha-2 plus `unknown` and `withheld`. Visible country/unknown buckets need at least3
events. Each smaller country bucket is merged into one `withheld` row, whose combined count
may be3 or more. Rows are unique, sorted ISO codes then unknown then withheld, at most250,
and reconcile with all received events; an empty valid report has no country rows.
`country_collection` describes the current API configuration (`disabled` or
`trusted_proxy_header`), not a verified edge or the provenance of historical events. Known
historical countries remain valid with collection currently disabled. No nationality or personal
location is inferred. An exact route and section make the8×8 pointer grid available; cells
below3 are withheld. Visible, withheld and unselected counts reconcile with received clicks.
An absent cell is not invented zero. Captioned server-rendered tables accompany the visual grid;
Peque semantic tokens, native controls and visible keyboard focus preserve the owned identity.

## Development provenance and acceptance

The schema, example and source profile under `contracts/analytics` were copied with `git show`
from the actual source-reviewed API candidate recorded in `contracts/analytics/source.json`.
File SHA256 values are checked by focused tests. These five generated copies retain producer
formatting through exact Biome path exclusions, matching the existing ops/telemetry convention;
the local provenance stays checked. This producer is a candidate, with no main or deployed
freshness claim. Its status is `committed-reviewed-candidate`; the canonical source pin is API
`850e78cf84df78f0ea66e2811e92aeb15a6f5d04`, integrated into API `develop` by squash
[PR95](https://github.com/gonzalomartinperez/pequeverso-assistant-api/pull/95) and independently
reviewed. Its five contract blobs and canonical country allowlist are byte-identical to the
previously reviewed `121d3dc` cohort. Existing ops and telemetry pins remain separate. Candidate provenance is not
production proof. Five exact
artifacts include14 socket-country and8 UTC-calendar semantic fixtures. The local ISO label
module is derived from that same commit’s canonical API allowlist and checked against its schema;
it is not a separately maintained country policy. Five real isolated PostgreSQL integration
tests passed on the byte-identical analytics implementation at `ddf5fafe` on 2026-10-19;
the canonical pin records their scope. Country ingress/edge trust and final paired browser
verification remain separate gates; no working-tree export is accepted as committed provenance.
`generated_at` is a logical receipt watermark, not database read completion or complete
concurrent-event coverage. The adapter retains the producer calendar and observation invariants.

Focused units cover strict wire/calendar/count validation, bounded reads and disabled/error states.
The architecture checker explicitly admits the analytics feature's four existing layer names,
retaining purity, same-feature application types and all cross-feature/client restrictions.
Source/light checks are not browser, IAM, PostgreSQL, restore, paired harness or production proof.

Local acceptance uses the finite fixture path: explicit saved opt-in/withdrawal harness → real API →
isolated synthetic PostgreSQL → authenticated BO, exact counts and source hashes, runtime grants,
calendar/privacy negative cases, accessible tables and required CI. Database/browser/container
execution needs a fresh authorized resource lease. No provider/model call is part of this work.
