# 12. Backoffice redesign foundation: one standard, two identities

Date: 2026-11-09. Scope: `portfolio-backoffice` (PB) and `pequeverso-assistant-backoffice` (PQB), read from `origin/develop`. Planning only, no code changed.

Method note. I read both repos' design docs, CSS, shell/nav code and the verification screenshots (viewed: PB `docs/assets/gallery/02-availability.png`, `06-access.png`; PQB `docs/verification/availability-2026-10-12/desktop-light-overview.png`). I did not use WebSearch/WebFetch in this pass: the best-in-class product conclusions (Linear, Vercel, Stripe, Supabase, PostHog, Langfuse, LangSmith, Grafana, Tremor/shadcn blocks) come from my own working knowledge of those products and WCAG 2.2, not from freshly fetched pages. Every contrast ratio below was computed (OKLCH to sRGB to WCAG 2.x luminance); proposed hex values are rounded outputs of that script. Treat vendor-specific claims as "pattern observed", not citations.

---

## 1. Current-state critique

### 1.1 portfolio-backoffice (PB)

Stack: Next 16.4.2, React 19.3.1, TS 7.0.2, CSS Modules, owned `shared/ui/button`, Recharts 3.10.1. No Tailwind, no CVA. Routes: `/` (operations + embedded product overview + feedback), `/analytics`, `/access`, `/sign-in`, `/privacy`; APIs `/api/operations`, `/api/health`, `/api/ready`. Locale EN/ES via typed dictionaries (`features/*/presentation/copy.ts`), selected by `?locale=` or cookie. Theme via `data-theme`, replaying a stored preference.

What works (keep):

- Honesty rules are already designer-grade: "Unavailable is not zero", synthetic fixture banner, "Estimated from configured prices, not an OpenAI invoice", relative phase bars labeled as "not start times". These are the product's character; the redesign must elevate them, not smooth them away.
- A real token vocabulary (`src/app/style.css`): `--surface-void/base/raised`, `--line-subtle/strong/control`, text primary/secondary/muted, cyan accent with wash and ink, signal success/warning, 6/12/20 radii, 140/320 ms motion, `--ease-out`. `--line-control` is a deliberate 3:1 control border.
- Native-first accessibility (labelled selects, `details`, native `dialog` for revoke, chart + always-visible table, 200% text and WebKit regressions).

Problems, with evidence:

1. **No application shell.** `src/app/page.tsx` renders one `Dashboard` that stacks `projectOverview` and `assistantFeedback` into the operations page; the "navigation" is two in-page anchors (`#overview`, `#execution-details`, `dashboard.tsx` ~L88) plus top-right buttons "Manage access / Preferences / Sign out". `docs/design-system.md` explicitly avoids "a speculative sidebar". Result: three different questions (operate the assistant, understand the site, review feedback) share one scroll and one header, and IAM is a different-looking page.
2. **The IAM page looks unfinished** (`06-access.png`): no shell or brand, headings at `letter-spacing:-0.035em` at every size so "Link another sign-in account" and "Members" visibly collide letters, a full-width primary button under a 1216px input, members as bordered rows with `email · Role` text (no avatar, provider, last access, status), an "Invitations" heading with nothing under it in the capture, no sessions, no audit log. Back-link is a bare underlined anchor at the top.
3. **Overview hierarchy is inverted** (`02-availability.png`). The two hero cards ("Service: Ready", "Knowledge: Fresh") are ~370px tall and mostly empty, whereas the actual operational data (latency, traces) sits below the fold. A 3-bar chart receives the largest panel on the page while the same numbers repeat in a table directly under it (chart + table twin shown at the same time rather than toggled). The budget ring is decoration for 0.3%; research doc itself says it should become a bullet bar.
4. **Mixed visual grammar.** Mono tracking-wide uppercase micro labels ("FIRST OUTPUT LATENCY", "CURRENT UTC MONTH") appear on some cards and not on the KPI cards; headline sizes differ per card (Ready/Fresh 40px, $0.02 36px, 320 ms 32px); card padding differs; the select control is square-ish with the native chevron while buttons are 12px radius.
5. **Pure `#000` void behind `#0d0f14` cards.** Very low surface separation (`--surface-void #000` vs `--surface-raised #12151b`): hairline borders do all the elevation work; light mode relies on borders and a faint shadow. Dark is "default-feel", light is a port.
6. **Traces are a list of disclosures, not an explorer.** `trace-explorer.tsx` filters by outcome and an ID substring; each trace shows two phase bars normalised to the longest phase. There is no shared time axis, no start offsets, no sort, no table, no keyboard row navigation, no run detail route. Latency is 2 numbers (p50/p95) with no distribution.
7. **No time-range control.** Windows are fixed ("rolling 30-day", "current UTC month"); product analytics has its own filter form; feedback has none. There is no global range, refresh affordance beyond a button, or last-updated pill that survives scroll.
8. **Tooling debt against owner decisions:** CSS Modules (~441 lines in `workbench.module.css` alone), no semantic-token layer for charts (`--viz-*` is only planned in the master plan), no density modes, no command palette, no breadcrumbs.

### 1.2 pequeverso-assistant-backoffice (PQB)

Stack: Next 16.4.2, React 19.3.1, TS 7.0.2, Tailwind 4.3.3, CVA 0.7.1, tailwind-merge 3.7, lucide-react 1.55, Recharts 3.10.1. Routes: `/panel` (Estado), `/panel/analitica`, `/panel/accesos` (owner), `/panel/cuenta`, `/ingresar`, `/invitacion/[token]`; `/healthz`, `/readyz`, `/internal/v1/ops/metrics`. UI Spanish only (tú). Theme from system preference only, no toggle (`docs/design-system.md`).

What works (keep):

- A real token pipeline: raw `--pv-*` OKLCH, semantic roles, `@theme inline`, documented contrast notes, `cn.ts` registry for custom sizes. This is the closest thing to the target architecture.
- Owned CVA primitives (`Button`, `Badge`, `Callout`, `Section`, `Facts`, `TableRegion`, `BrandMark`), native `<meter>` for budget, native modal `<dialog>` in `ConfirmAction`, 44px targets.
- Copy that is calm, honest and in tuteo/neutral Spanish, including "No es la factura del proveedor" and "un día ausente no se interpreta como cero".

Problems, with evidence:

1. **One 4,800 CSS-px page.** `desktop-light-overview.png` (2880×9644 @2x) stacks seven cards: "¿Puede responder ahora?", "Estado técnico", Servicio + Catálogo, Presupuesto, Solicitudes 24 h, Solicitudes 30 días, Actividad diaria, Últimas ejecuciones. Jump chips (Presupuesto / Solicitudes / Actividad / Últimas ejecuciones) are the only wayfinding. An operator asking one question scrolls past six others.
2. **Cards inside cards** ("Estado técnico" contains three mini-cards and a disclosure, inside a bordered card; the budget block contains a table inside a card). Many 12px-radius sunken sky boxes of equal weight: nothing is the hero.
3. **KPI design is label-heavy.** Metrics are uppercase 13px label + value + sentence ("RESPUESTAS COMPLETADAS · 24 H / 52 / No mide disponibilidad; las omisiones no se convierten en cero."). The honesty is good but the explanation competes with the number; there is no delta, no sparkline, no comparison to the previous window. Cohort labels such as "PRIMER TEXTO (P50 / P95)" wrap to two or three lines.
4. **Tables wrap their data.** In "Últimas ejecuciones" the timestamp "5 oct 2026, 11:58 UTC" breaks over two lines in every row; run IDs are 16-char hex in a column at the far right; no sorting, no filter, no row link (`dashboard.tsx` is 647 lines and renders tables inline). Headers use uppercase, tracked 13px labels in teal-on-sky that read as chips.
5. **Header is a marketing header**, not an app bar: logo + "Backoffice" pill + pill links + email + "Salir" in a `max-w-6xl` bar (`backoffice-frame.tsx`). No breadcrumbs, no environment/data-source strip (the synthetic-data notice is a loud lemon banner inside the content), no time range, no search.
6. **Accent and status colors are thin.** Status uses teal/navy/gold only (coral reserved for commerce). Completed teal vs failed navy as chart series is hostile to quick scanning and to colour-blind users when adjacent (see `--chart-failed: var(--pv-navy)`); danger text uses `--pv-coral-hover`, so the store's "buy" colour doubles as error colour despite the reservation rule.
7. **Pill-everything** (`rounded-pill` buttons, chips, nav) inherited from the storefront makes dense UI feel toy-like on a data page; the storefront's friendliness is right for the brand but not applied with hierarchy (table headers, filters and nav all look like chips).
8. **No theme toggle, no density modes, no command palette, no time controls, no audit log.** `Accesos`/`Cuenta` are simple forms. Dark theme exists and is tested but is only reachable via OS setting.

### 1.3 What they share (the real opportunity)

Same architecture (clean-architecture feature folders), same owner, same data concepts (service readiness, catalog/knowledge freshness, executions with outcomes, first-token latency p50/p95, tokens, estimated spend vs monthly limit, sampled traces, product analytics with thresholded counts, IAM owner/viewer with invitations), same auth (Better Auth, PostgreSQL IAM), same honesty doctrine. They already diverged in tooling (CSS Modules vs Tailwind) and in layout metaphor. A shared standard removes that divergence while identity lives only in tokens, type, illustration and a few signature details.

---

## 2. Shared standard

### 2.1 Principles (pragmatic, no ceremony)

1. **One question per view.** Each route answers one operator question and leads with its answer.
2. **Answer first, evidence second, raw third.** Status/KPI row, then visual evidence, then a table twin, then provenance.
3. **Unavailable is not zero.** Every metric is a tagged value (`ok | empty | unavailable | stale | withheld`), rendered by one `Metric` component.
4. **Dense but legible.** Compact density is the default on desktop for tables, comfortable on touch; 24px minimum target (WCAG 2.5.8), 44px for primary mobile controls.
5. **Light and dark are separate designs** over the same semantic tokens: each gets its own surface elevation model, not an inversion.
6. **Native first, Base UI when behavior is nontrivial** (Dialog, Menu, Popover, Tooltip, Tabs, Select, Combobox for the command palette, Toast, Switch, Checkbox).
7. **No new runtime dependency without a measured need.** Allowed set: Tailwind 4, CVA, tailwind-merge, Base UI, lucide-react, Recharts (kept, wrapped), `cmdk` only if Base UI Combobox proves insufficient.

### 2.2 Information architecture

One skeleton, six top-level destinations, same order and same URL structure in both apps. Labels localised; slugs follow each app's language (PB English, PQB Spanish) because both already do.

| Slot | Purpose | PB route | PQB route |
|---|---|---|---|
| 1 Overview | Is it healthy, did it change, what did it cost | `/` | `/panel` |
| 2 Assistant | Runs list and run detail (traces) | `/runs`, `/runs/[id]` | `/panel/ejecuciones`, `/panel/ejecuciones/[id]` |
| 3 Usage and cost | Tokens, latency distribution, budget, errors | `/usage` | `/panel/consumo` |
| 4 Audience (product analytics) | What visitors do on the site | `/analytics` | `/panel/analitica` |
| 5 Feedback (PB) / Catalog (PQB) | PB: ratings and comments on answers; PQB: catalog and knowledge sync state | `/feedback` | `/panel/catalogo` |
| 6 Access | Members, invitations, sessions, audit | `/access`, `/access/audit` | `/panel/accesos`, `/panel/accesos/auditoria` |
| Account | Profile, linked providers, preferences, sign out (user menu, not sidebar) | `/account` | `/panel/cuenta` |
| Utility | `/sign-in`, `/privacy` | existing | `/ingresar`, `/invitacion/[token]` |

Notes:

- PQB moves from one scroll to routes: today's "Solicitudes 24 h / 30 días" and "Presupuesto" become Usage and cost; "Servicio / Catálogo / Estado técnico" collapse into the Overview status strip plus Catalog; "Últimas ejecuciones" becomes the Runs list with the 16-char ID as a copyable link into Run detail.
- PB's embedded product overview and feedback leave `/` for their own routes; `/` keeps three summary tiles linking to them ("Audience: 1,204 views, 7 d", "Feedback: 82% helpful").
- Viewer role sees every route except Access (and Audit). Hidden items are removed from nav, and direct URL returns a typed 403 state, never a blank page.
- URL state: time range, filters, sort, density-independent selection live in the query string (`?range=7d&outcome=failed&sort=-duration`), so any view is linkable and the back button works. Locale (PB) is a preference stored server-side with a `?locale=` override.

### 2.3 App shell

Desktop (≥1024px):

```
+-------------------------------------------------------------+
| status strip (32px, sticky)  Env · Data source · Updated ·  |
+--------+----------------------------------------------------+
| side   | topbar (48px): breadcrumbs | range | search ⌘K | user |
| nav    +----------------------------------------------------+
| 232px  | page header: title, one-line description, actions   |
| (56px  | content (max 1280px, 12-col grid, 24px gutters)     |
| rail)  |                                                    |
+--------+----------------------------------------------------+
```

- **Sidebar**: 6 destinations + collapsed rail (icon-only, tooltips) toggled with `[`; remembers state. Group label per section only when more than 6 items. Current item has an indicator bar plus `aria-current="page"` (never color alone). Footer: environment pill, version/commit (`build-info`) as a copyable chip.
- **Topbar**: breadcrumbs (`Runs / 9f3a…c21`) with last crumb non-link; global **time range** control (see 2.6); **command palette** trigger (`Search or jump to… ⌘K`); user menu (avatar initial, role badge, theme, density, language (PB), account, sign out).
- **Status strip** (the "environment/status strip"): one 32px row that replaces the loud banners. Segments: `Environment` (production, preview, fixture), `Data` source (live API, **synthetic fixture**, degraded, stale since 14 min), `Checked 10:42 UTC` with a refresh button (`aria-live=polite` announces "Updated"). Synthetic/fixture swaps the strip to the warning tone with an icon and the text "Synthetic data, not production telemetry". Clicking opens a popover with provenance (API commit, pricing revision, corpus hash).
- **Tablet (640–1023)**: sidebar becomes an overlay drawer; topbar keeps breadcrumbs + palette + user.
- **Mobile (<640)**: 56px header (menu, title, user); bottom nothing; navigation in a full-height Base UI Dialog drawer; range control moves into the page header; tables become card lists or scroll regions with a sticky first column; safe-area insets respected.
- Skip link first in tab order ("Skip to content" / "Saltar al contenido"); landmarks: `header`, `nav aria-label`, `main#content`, `aside` for detail panels.

### 2.4 Page templates

All templates share the page header (title 24/28px display, description 14px secondary max 70ch, right-aligned actions, optional tabs) and the 12-column grid.

1. **Overview**: status strip (shell) then a KPI row of 4 tiles (1 per question), then 2 primary panels (trend + composition) at 8/4 columns, then a "Needs attention" panel (up to 5 items: failed runs, stale catalog, budget at 80%) with deep links, then footer provenance. No tile taller than 120px, no panel nested in a panel.
2. **List + Detail** (Runs, Feedback, Members, Catalog): toolbar (search, filter chips, density, column menu, export) over a table; row click or `Enter` opens a **side sheet** (peek, 480px, `aside`) while `Cmd+Enter` or the ID link opens the full route; sheet has prev/next (`J`/`K`). On mobile the sheet is a full-screen route.
3. **Trace/Run detail**: header with outcome badge, ID (copy), timestamp, total duration, model/locale/cohort facts; waterfall (2.9) with a stage table twin and a detail inspector on selection; sibling facts (tokens in/out/cached, cost estimate, error code) and "Related runs" list. Never renders prompts/answers (both products forbid it).
4. **Settings/IAM**: two-column (nav of sections left, forms right), each section a `fieldset` card with a single primary action: Members, Invitations, Sessions, Linked accounts, Preferences. Destructive actions use the confirm dialog pattern and show the consequence in text ("alice@… will be signed out of 2 sessions").
5. **Audit log**: append-only table with sticky filter bar (actor, action, target, range), monospace event IDs, relative + absolute time on hover/focus, expandable row for before/after JSON-safe summary (no secrets), export CSV (owner only), "Events are retained N days" notice.

### 2.5 Component inventory

Primitives (CVA, Tailwind 4 utilities reading semantic tokens only; Base UI where marked B):

| Component | Variants / sizes | Required states |
|---|---|---|
| `Button`, `LinkButton` | primary, secondary, ghost, destructive, link; sm 28, md 32, lg 40 (touch 44 on coarse pointers); icon | default, hover, focus-visible, active, disabled, loading (spinner replaces icon, width locked, `aria-busy`) |
| `IconButton` | sm/md, tooltip required | same |
| `Input`, `Textarea`, `Field` (label, hint, error) | sm/md | default, focus, invalid (icon + text), disabled, read-only |
| `Select` B, `Combobox` B, `Checkbox` B, `Switch` B, `RadioGroup` B | | + indeterminate, checked |
| `SegmentedControl` (range/density) B Tabs-based | | selected, roving tabindex |
| `Tabs` B, `Breadcrumb`, `Pagination`, `Disclosure` | | |
| `Badge` (neutral, info, success, warning, critical, accent) | solid, soft, outline; dot | always icon or text, never color only |
| `StatusDot`/`StatusPill` | ok, warn, critical, unknown, stale | pulse only for "live", respects reduced motion |
| `Dialog` B, `Sheet` B, `Popover` B, `Menu` B, `Tooltip` B, `Toast` B | | focus trap/restore, Escape |
| `Avatar` (initial + provider glyph), `Kbd`, `CopyButton`, `RelativeTime` (`<time>` with title), `Skeleton`, `Spinner`, `Progress`/`Meter`, `Separator` | | |
| `Card` (flat, raised, inset), `Callout` (info, success, warning, critical) | | |

Composites:

| Composite | Contents | States |
|---|---|---|
| `AppShell`, `Sidebar`, `Topbar`, `StatusStrip`, `CommandPalette`, `RangePicker`, `UserMenu` | | collapsed/expanded, offline, degraded |
| `PageHeader`, `Toolbar`, `FilterChips` (removable, "Reset") | | |
| `Metric` (value, unit, label, delta, sparkline, context, source) | | `ok`, `loading`, `empty`, `unavailable` (+ reason), `stale`, `withheld`, `error` |
| `KpiTile`, `KpiRow` | 4 columns on desktop, 2 on tablet, scroll-snap on phone | as `Metric` |
| `DataTable` (sticky header, sortable columns, column menu, density, row selection optional, row actions, sticky first col on mobile, keyboard grid navigation) | | loading skeleton rows, empty (no data), empty-filtered (with "Clear filters"), error (retry), partial (banner) |
| `ChartFrame` (`<figure>`, caption, summary sentence, legend, "View as table" toggle, data source note) | | all `Metric` states |
| `ProportionBar`, `BulletBar`, `Sparkline`, `LineChart`, `ColumnChart`, `HBarList`, `Heatmap`, `Waterfall` | | |
| `EmptyState`, `ErrorState`, `UnavailableState`, `ForbiddenState`, `NotFoundState` | | see 2.8 |
| `MemberRow`, `InviteForm`, `InvitationRow` (pending/expired/consumed/revoked + TTL), `SessionRow` (device, last active, current badge, revoke), `AuditRow` | | |
| `ConfirmDialog` | typed confirmation for destructive+irreversible | |

### 2.6 Time-range control

- Position: topbar, a `SegmentedControl` of presets `24h · 7d · 30d · Month` plus "Custom" (Popover with two date inputs and presets); on mobile inside the page header.
- Semantics: all dates in UTC (both backends are UTC) and the control says so (`UTC` suffix; hover shows local equivalent). The selected range is in the URL (`range=7d` or `from=2026-10-01&to=2026-10-31`).
- Each view declares which ranges it supports from its data contract; unsupported presets are `aria-disabled` with a tooltip reason ("Daily history starts 29 Sep 2026"). PB/PQB today have fixed windows; the control ships first as a **window label** (read-only chip "Rolling 30 days") and becomes interactive as soon as a contract exists (PQB analytics already has `period` and `offset`).
- Compare toggle ("vs previous period") appears only where history exists.

### 2.7 Command palette and keyboard shortcuts

`⌘K` / `Ctrl+K` and `/` open a Base UI Combobox in a Dialog. Sources: navigate (all routes), actions (switch theme, density, language, refresh data, copy build info), recent runs (ID prefix match), members (owner only). Results grouped, with shortcut hints, no network search of conversation content. Palette never exposes viewer-forbidden destinations.

| Shortcut | Action |
|---|---|
| `⌘/Ctrl+K`, `/` | Command palette |
| `g` then `o/r/u/a/f/s` | Go to Overview/Runs/Usage/Audience/Feedback(Catalog)/Access (Settings) |
| `[` | Collapse sidebar |
| `r` | Refresh data |
| `t` | Cycle theme |
| `d` | Toggle density |
| `j`/`k`, `Enter`, `Esc` | Row down/up, open peek, close |
| `?` | Shortcut help dialog |

Rules: shortcuts disabled when focus is in an input; every shortcut has a visible UI equivalent (WCAG 2.1.4); chords are single-key only inside the `g` sequence with a 1.2s timeout; list in `?` dialog.

### 2.8 States standard

One component per state, same anatomy: icon (24px, tone), title (sentence case, what happened), body (one sentence, why/what it means), action (what to do), optional detail `<details>` (request ID, timestamp).

| State | Trigger | Look | Copy pattern |
|---|---|---|---|
| Loading | First fetch >200ms | Skeleton that matches final layout (never spinner-only), shimmer 1.2s max, off under reduced motion, `aria-busy` on region | none; announce "Loading runs" politely |
| Refreshing | Subsequent fetch | Data stays, strip shows spinner, no layout shift | "Updating…" |
| Empty (never any data) | No records | Illustration (identity-specific), explains what will appear and how to get data | "No runs yet. Runs appear after the first assistant question." |
| Empty (filtered) | Filters yield 0 | Compact, keep the filter bar, button "Clear filters" | "No runs match failed + last 24h." |
| Unavailable | Source down/not configured/withheld | Dash `—` + "Not available" + reason; chart replaced with hatched outline frame, **no zero bars, no flat lines** | "Cost is not available: the ledger did not answer (14:02 UTC)." |
| Stale | Data older than SLA | Value kept, tone warning, age shown | "Last good reading 38 min ago." |
| Withheld (privacy threshold) | Count below k (PQB k=3, PB similar) | Neutral hatched cell, text "Withheld (<3)", legend entry | |
| Partial | Some panels failed | Page renders, failed panels in-place Unavailable, page-level Callout lists them | |
| Error | Unexpected | `role="alert"`, Retry, request ID | |
| Forbidden / Not found | Role or URL | Dedicated page with link back, never a redirect loop | |
| Success | Mutations | Toast (polite), 5s, with Undo only if reversible; copy-link feedback reports real clipboard result | |
| Fixture/synthetic | `OPERATIONS_SOURCE_MODE=fixture` | Status strip tone + watermark "SYNTHETIC" tile corner badge on each Metric | |

### 2.9 Data-visualization standard

Question to form (extends PB research ADR 012; applies to both):

| Question | Allowed | Forbidden |
|---|---|---|
| Is X ok? | Status pill + sentence | Gauge, traffic light without text |
| How much? (one number) | `Metric` (+ delta, + sparkline when history exists) | Radial rings for tiny shares |
| Over time | Line (continuous), column (counts per day, ≤45 bars); time axis, tabular numerals | Smooth/spline interpolation across missing days, area stacks with >4 series |
| Part of whole (≤5) | `ProportionBar` with direct labels | Pie/donut >3 parts, 3D |
| Compare categories | Sorted `HBarList` with inline value | Dual axes, unsorted bars |
| Spend vs limit | `BulletBar` (settled, reserved, limit marks at 50/80/100) | Ring/gauge |
| Latency | p50/p95 `Metric` pair + distribution strip (histogram, 8–12 bins) and waterfall per run | Mean-only |
| Spatial/density | Discrete heatmap (5 steps + withheld hatch) | Continuous rainbow |
| Sequence in a run | `Waterfall`: shared ms axis, start offsets, nested spans indented, bars labeled with duration, critical path marker | Normalised-to-longest bars (current PB) |

Rules:

- **Palette**: categorical `--viz-1..5` (distinct from status colors), sequential 5-step ramp on the accent, diverging not needed. Status colors (ok/warn/critical/unknown) never reused as series colors except where the series *is* status (outcomes), and then always with a glyph (check, dash, cross) plus label.
- **Contrast**: marks ≥3:1 against the card surface and ≥3:1 against adjacent marks or separated by a 2px surface gap (1.4.11); text ≥4.5:1.
- **Ink**: faint horizontal grid (`--viz-grid`), no plot borders, direct labels when ≤4 series, tabular-nums, compact `Intl` notation in tiles, exact in tables, currency `< $0.01` rule.
- **Accessible twin**: every `ChartFrame` renders `<figure>` + `<figcaption>` (title + generated sentence: "20 of 24 runs completed (83%)") and a **"View as table"** toggle that swaps (not duplicates) chart and table; the table is the default under `prefers-contrast: more` and in print. Recharts `accessibilityLayer` on, arrow-key navigation, focus ring on the plot, `aria-hidden` on decorative SVG when the table is visible.
- **Unavailable is not zero**: charts take `Series | Unavailable`; gaps are drawn as hatched bands labelled "no data", `null` is never coerced; a chart with 0 usable points becomes the Unavailable state.
- **Motion**: none on data. Hover/focus crosshair only.
- **Sparklines** only with at least 7 real points; otherwise nothing, with `Metric` context "No trend yet".

### 2.10 Motion

150–300ms, `transform` and `opacity` only (no width/height/left animation; collapsing sidebar uses transform on a fixed-width rail with content offset via grid track, no animated reflow of charts). Tokens: `--dur-fast 150`, `--dur-base 220`, `--dur-slow 300`; easing `cubic-bezier(0.16,1,0.3,1)` out, `cubic-bezier(0.4,0,0.2,1)` standard. Allowed: popover/menu fade+4px translate, sheet slide (transform), toast, tab indicator (transform), skeleton shimmer (opacity/transform of gradient layer), copy confirmation. Not allowed: counting numbers, bar growth, parallax, route transitions beyond opacity. `@media (prefers-reduced-motion: reduce)`: all durations 0.01ms, shimmer static, status pulse off. A single `motion-safe:` convention in Tailwind utilities.

### 2.11 Density modes

`data-density="comfortable|compact"` on `<html>`; default compact on `pointer: fine` ≥1024px, comfortable otherwise; user override in the user menu and `d`.

| Token | Comfortable | Compact |
|---|---|---|
| Table row height | 48px | 32px |
| Control height md | 40px | 32px |
| Card padding | 20px | 16px |
| Page gap | 24px | 16px |
| Body size | 15px | 14px |
| Hit area (pointer: coarse) | always ≥44px | ≥44px (forced) |

### 2.12 i18n

PB: already EN (US) and ES (neutral LatAm) typed dictionaries with locale in cookie/`?locale=`; keep and move to `Intl` for every number/date (`es-AR` is used today for numbers in `trace-explorer.tsx`; standardise on locale + explicit `timeZone: "UTC"`). Add a language item to the user menu. PQB: ES only, tuteo, `es-AR`-flavoured formatting today (`US$ 8,56`, "oct", "U$S"); keep Spanish-only but route all strings through a typed dictionary (`messages/es.ts`) so extraction is possible and tests can assert no hard-coded text. Shared rules: sentence case, no all-caps copy (use CSS `text-transform` sparingly for eyebrow labels, 12px, ≥0.04em), logical properties (`ms-`, `ps-`) for future RTL safety, numeric columns right-aligned with tabular figures, relative times always paired with absolute in `title`/tooltip.

---

## 3. Token architecture

### 3.1 Layers (identical in both repos)

1. **Primitive** (`--ref-*`): raw OKLCH ramps and scales. Theme packs differ here.
2. **Semantic** (`--sys-*` exposed as Tailwind colours): the only layer components read. Same names in both repos, different values per pack and per theme.
3. **Component** (`--cmp-*`, optional): only where a component needs a bespoke knob (`--cmp-sidebar-bg`, `--cmp-table-row-hover`, `--cmp-chart-grid`). Default to semantic.

Files (copied from the shared kit, see 6.2):

- `tokens/structure.css`: semantic names, type/space/radius/motion/density scales, `@theme inline` mapping. **Identical across repos.**
- `tokens/pack-instrument.css` (PB) or `tokens/pack-atelier.css` (PQB): `--ref-*` ramps and the light/dark mapping of semantic roles. **Different.**
- Contract test: a script asserts both packs define every semantic token for both themes (no missing key) and that required pairs meet contrast.

### 3.2 Semantic token set (shared structure)

Surfaces: `canvas` (page), `surface` (cards), `surface-raised` (menus, sheets), `surface-inset` (wells, table header), `surface-hover`, `surface-selected`, `overlay`.
Text: `fg`, `fg-secondary`, `fg-muted`, `fg-on-accent`, `fg-link`.
Lines: `line-subtle` (dividers, decorative), `line` (cards), `line-control` (inputs, ≥3:1), `ring` (focus).
Accent: `accent`, `accent-hover`, `accent-fg` (on accent), `accent-soft` (wash), `accent-text` (accent as text ≥4.5:1).
Status (each has `-fg`, `-soft`, `-line`): `ok`, `warn`, `critical`, `info`, `unknown`.
Viz: `viz-1..5`, `viz-seq-1..5`, `viz-grid`, `viz-axis`, `viz-withheld` (hatch).
Elevation: `shadow-1/2/3` (per theme), `border-elev` (dark mode uses a 1px lighter top border rather than shadows).

### 3.3 Scales (shared)

- **Type scale** (px, line-height): 12/16 (caption), 13/18 (label), 14/20 (body-compact), 15/22 (body), 16/24, 18/26 (card title), 20/28, 24/30 (page title), 32/38 (KPI value), 44/48 (hero KPI, Overview only). Tabular-nums on every number surface. Type sizes live as `--text-*` and are registered in `tailwind-merge` config (PQB already does this).
- **Spacing**: 4px base: 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radii** are pack-specific (3.5), z-index: base 0, sticky 10, strip 20, drawer 30, dialog 40, toast 50, tooltip 60.
- **Breakpoints**: 480, 640, 768, 1024, 1280, 1536; container query for panels (cards respond to their width, not viewport).
- **Elevation** (light): shadow-1 `0 1px 2px / 6%`, shadow-2 `0 4px 12px / 10%`, shadow-3 `0 12px 32px / 14%`, tinted to the pack's ink hue. (dark): no shadow on cards; layered surface lightness (+0.03 L per level) and a 1px top highlight `oklch(1 0 0 / 6%)`.

### 3.4 Instrument pack (PB) — concrete values

Hue anchor: portfolio cyan 215–230, neutrals tinted toward blue-slate (hue 250–255, chroma 0.01–0.03). Dark surfaces are *not* `#000`: the pure black void is replaced with a graphite canvas so cards separate by lightness.

| Token | Light | Dark |
|---|---|---|
| canvas | `oklch(0.975 0.004 250)` #f5f7f9 | `oklch(0.155 0.012 255)` #090c11 |
| surface | `oklch(1 0 0)` #ffffff | `oklch(0.195 0.013 255)` #11151b |
| surface-raised | `oklch(1 0 0)` + shadow-2 | `oklch(0.235 0.014 255)` |
| surface-inset | `oklch(0.955 0.006 250)` | `oklch(0.175 0.012 255)` |
| fg | `oklch(0.22 0.02 255)` #141b24 | `oklch(0.95 0.008 250)` #ebeff4 |
| fg-secondary | `oklch(0.44 0.03 255)` #485463 | `oklch(0.76 0.02 255)` #a9b2be |
| fg-muted | `oklch(0.50 0.03 255)` #586474 | `oklch(0.68 0.02 255)` #9099a5 |
| line-subtle / line | `oklch(0.92 0.006 250)` / `oklch(0.87 0.008 250)` | `oklch(0.26 0.014 255)` / `oklch(0.31 0.016 255)` |
| line-control | `oklch(0.62 0.02 255)` | `oklch(0.52 0.02 255)` |
| accent | `oklch(0.52 0.12 230)` #0074a0 | `oklch(0.82 0.13 215)` #41d9f8 |
| accent-fg (on accent) | `oklch(1 0 0)` | `oklch(0.2 0.05 230)` |
| ok / warn / critical | `oklch(0.50 0.11 160)` #0b764d / `oklch(0.50 0.10 75)` #845a0f / `oklch(0.50 0.17 25)` #b02a2d | `oklch(0.80 0.14 160)` #5ed99e / `oklch(0.84 0.12 85)` #eec469 / `oklch(0.76 0.14 22)` #fe8a88 |
| viz-1..5 | #0074a0, #6d47b8, #be7100, #118659, #bc2b74 | #41d9f8, #b296ff, #f1c45e, #5ed99e, #f77cb0 |

Computed contrast on `surface` (WCAG 2.x): light fg 17.3, secondary 7.8, muted 6.0, accent 5.2, ok 5.7, warn 6.1, critical 6.6; dark fg 15.8, secondary 8.5, muted 6.4, accent 10.9, ok 10.4, warn 11.1, critical 8.0. Same tokens on `canvas`: all ≥4.9 light, ≥6.8 dark. Viz marks vs surface: light 3.8–6.5, dark 7.3–11.1 (all ≥3:1; the amber `#be7100` at 3.8 is the floor, never used for text). Muted text is deliberately allowed only for ≥13px non-essential metadata. Radii: 4 (controls and badges), 8 (cards), 12 (sheets, dialogs). Rationale for lower radii than today (6/12/20): the instrument feel needs sharper corners and rings carry less decoration.

### 3.5 Atelier pack (PQB) — concrete values

Anchors stay the storefront's (`--pv-*`) so the backoffice is recognisably Pequeverso: cream paper, navy ink, teal; gold and mint as supportive tints. Changes: (a) a danger/critical hue that is *not* coral (store's buy colour) — a berry/rose `oklch(0.47 0.15 18)`; (b) a proper `ok` green and `warn` ochre so status stops borrowing brand colours; (c) paper elevation and ruled lines.

| Token | Light | Dark |
|---|---|---|
| canvas | `oklch(0.9868 0.0118 80)` #fffaf2 (cream) | `oklch(0.215 0.07 256)` #011839 (night) |
| surface | `oklch(1 0 0)` | `oklch(0.27 0.075 256)` #09264a |
| surface-inset | `oklch(0.9594 0.02 250)` sky | `oklch(0.24 0.07 256)` |
| fg | `oklch(0.2393 0.0581 256.7)` #0b1f3a | `oklch(1 0 0)` |
| fg-secondary | `oklch(0.4336 0.0403 255)` #425267 | `oklch(0.88 0.02 256)` #cfd8e5 |
| fg-muted | `oklch(0.50 0.04 258)` #55647a (slightly darker than today's `#5d6b80` so it stays ≥5.8:1 on cream) | `oklch(0.76 0.03 256)` #a5b2c4 |
| line-subtle / line | navy 8% / navy 14% | white 8% / white 14% |
| line-control | navy 55% | white 50% |
| accent (action) | navy `oklch(0.3175 0.1094 256)` | turquoise `oklch(0.8521 0.0956 187)` #7fe3d9 |
| accent-text | teal `oklch(0.4352 0.0749 191)` #005e5b | turquoise |
| highlight | gold `oklch(0.8908 0.1645 94)` (marker highlight behind key numbers; never text) | same at 20% |
| ok / warn / critical | `oklch(0.46 0.09 165)` #13684b / `oklch(0.48 0.09 75)` #7b5518 / `oklch(0.47 0.15 18)` #9d2a39 | `oklch(0.82 0.12 160)` #78dca9 / `oklch(0.88 0.14 95)` #f4d660 / `oklch(0.78 0.12 25)` #fb9890 |
| viz-1..5 | teal #007974, navy #003169, ochre #b67700, berry #a83442, plum #754d9e | #7ee2d8, #81ade9, #f6d653, #f98f87, #bc97e8 |

Computed contrast on `surface`: light fg 16.5, secondary 8.0, muted 6.0, accent-text 7.6, ok 6.8, warn 6.6, critical 7.4; dark fg 15.1, secondary 10.5, muted 7.1, accent 10.0, ok 9.1, warn 10.6, critical 7.2. Viz marks: light 3.7–12.8 (ochre `#b67700` 3.7 is the floor), dark 6.3–10.6. The old failed=navy vs completed=teal pair is replaced: outcomes are completed teal + check, failed berry + cross, cancelled slate + dash, interrupted ochre + pause. Radii: 6 (controls: no more pill buttons in data areas), 12 (cards), 20 (illustrated empty states only); **pills remain only for badges and the navigation indicator**, which keeps the storefront's friendliness without toy-like dense UI.

### 3.6 Fonts

| Role | Instrument (PB) | Atelier (PQB) |
|---|---|---|
| Display / page titles | Inter Tight 600, tracking −0.02em (not −0.035em: fixes the collided headings) | Fraunces 600–700 at 24 and 18; optical size axis on; never below 17px |
| Body / UI | Inter 400/500, 14–15px | Nunito Sans 500, 14–15px (16px for inputs on touch to avoid iOS zoom) |
| Data / IDs / code | JetBrains Mono 400/500, 12–13px, `tabular-nums slashed-zero` | Nunito Sans tabular-nums for numbers; IDs in `ui-monospace` stack at 13px (no new font) |
| KPI value | Inter Tight 600 32px | Fraunces 600 32px |

Both self-hosted variable woff2 with metric-matched fallbacks (PQB already; PB moves from `next/font/google` runtime fetch at build to local files for parity, optional).

---

## 4. Two identities

### 4.1 Instrument (portfolio-backoffice): "a flight-recorder for a RAG assistant"

- **Concept**: an engineer's instrument panel. Everything is a measurement with a unit, a timestamp and a source. The user is an AI engineer reading traces at 11pm; the UI should feel like a precise, quiet instrument, the dark sibling of the portfolio's constellation hero without borrowing its theatre.
- **Mood**: graphite, hairlines, tabular numerals, cyan as the only chromatic signal, restrained green/amber/red for state. Dense by default. Confident, terse copy.
- **Typography**: Inter Tight for titles and KPI values, Inter for UI, JetBrains Mono for IDs, units and timestamps (limited to data, not decoration; no tracked uppercase eyebrow everywhere, only on KPI labels at 12px/0.04em).
- **Accent use**: cyan marks "now" and "selected": active nav indicator, selected row, the live/refresh pulse, the current time cursor in charts, focus ring. Never as large fills except the primary button. Light mode uses the deeper `#0074a0` so it stays a *line colour* identity rather than turning into a blue app.
- **Iconography**: lucide at 1.5px stroke, 16px; a small custom set for domain objects (run, span, token, budget, corpus) drawn on the same grid with square caps. The monogram "G" from the portfolio in a 28px rounded-square at the sidebar head, plus `icon.tsx` favicon.
- **Illustration**: none. Empty states are typographic with a thin dashed frame and a one-line command-like hint ("No runs in range. Widen to 30d →"). Character via restraint.
- **Signature details** (pick these, implement once, reuse everywhere):
  1. **The trace rail**: waterfall rows render a 1px cyan time cursor that follows the pointer across spans and mirrors in the detail inspector with exact ms; the page-header of Run detail shows a mini-waterfall silhouette of the run as its "thumbnail".
  2. **Corner ticks**: KPI tiles and panels carry 6px registration ticks on the top-left and bottom-right corner at `line-control` opacity (CSS pseudo-elements, transform-free), a nod to instrument bezels and a subtle differentiator from generic shadcn cards. Off in compact density to save ink if judged noisy during review.
  3. **Unit chips**: numbers always show their unit in mono at 60% fg ("320 ms", "$0.02 / $10.00"); deltas in a tinted pill with arrow glyph.
  4. **Status strip as telemetry ticker**: segments separated by 1px dividers, a 6px dot that breathes only while the data is live (opacity, 2s, off for reduced motion).
  5. **Hatch for the unknown**: a diagonal 45° hatch (`--viz-withheld`) is the single visual meaning of "no data / withheld", identical in every chart, table cell and tile.

### 4.2 Atelier (pequeverso-assistant-backoffice): "el cuaderno del taller"

- **Concept**: the workshop notebook of the people who make children's learning kits. The assistant answers parents; the owner reviews how it did over coffee, in Spanish, probably non-technical. The UI should feel like the store's paper-and-ink world turned into a tidy ledger: warm, legible, humane, and never intimidating about numbers.
- **Mood**: cream paper, navy ink, teal highlight, a dash of gold marker. Generous but organised; compact density is available but default is comfortable-compact (15px body). Plain-language copy first, jargon (p95, TTFT) behind "¿Qué significa?" popovers.
- **Typography**: Fraunces for page and card titles and KPI values (warmth, distinct from every admin template), Nunito Sans for everything else; sentence case; section "eyebrows" as small Nunito 12px bold, not uppercase-tracked blocks.
- **Accent use**: navy is the action colour in light (turquoise in dark), teal for links/active indicators, gold only as a *highlighter* behind the one key number per page ("Te quedan US$ 8,56 este mes") using a 40% gradient underline, a 1:1 homage to hand-marked notes; coral appears nowhere (commerce only). Status uses the new green/ochre/berry.
- **Iconography**: lucide at 1.75px stroke with rounded caps/joins (matches Nunito's roundness), 18px; domain glyphs reuse the storefront's playful vocabulary: a small open book (ejecuciones), letters/blocks (kit/catálogo), a coin purse (presupuesto), a lighthouse/compass (estado).
- **Illustration**: a small set (6) of spot illustrations for empty/error/forbidden states built from the storefront's shapes (letter blocks, a book, stars of the night-sky bands, a sleeping moon for "sin datos aún"). Flat two-colour SVG, `currentColor`-aware for dark mode, <3KB each, decorative `aria-hidden`.
- **Signature details**:
  1. **Ruled-ledger tables**: rows separated by 1px navy-8% lines with a faint 1px left margin rule at the first column (the notebook margin); header in `surface-inset` with Fraunces 13px semi-bold small caps off (sentence case).
  2. **Paper elevation**: cards in light mode are white sheets on cream with a navy-tinted two-layer shadow and a 1px inner top highlight; in dark, night-sky surfaces with a very sparse (3–5) static star dots pattern in the page canvas corner at 6% opacity (static SVG, no animation).
  3. **Marker highlight** on the lead KPI (see above), applied via `background-image` only.
  4. **Friendly status copy**: StatusPill labels in plain Spanish ("Todo en orden", "Atención", "No disponible") with the technical term as `title`.
  5. **Brand mark** isotipo in the sidebar head with the "Backoffice" label as a small paper-tag shaped badge (6px notch via `clip-path`, no raster).

### 4.3 Shared vs distinct (checklist for "same standard, different product")

Same: routes skeleton, shell anatomy, template layouts, component names, states, chart rules, motion, density, shortcuts, semantic token names, accessibility gates. Different: palette packs, fonts, radii, elevation model, icon stroke style, illustration, signature details, voice of copy. A screenshot with the logo removed must still be identifiable as PB or PQB within a second; a screenshot with the colours removed must show the same layout.

---

## 5. Per-backoffice views

Rubric target: every view scores ≥95/100 on the designer rubric: hierarchy 20, system consistency 15, states completeness 15, data-viz honesty and accessibility 15, responsive behaviour 10, motion/interaction polish 10, content/microcopy 10, performance/robustness 5. Cross-cutting acceptance for **every** view: light and dark screenshots at 1440, 1024, 768, 390; 200% text without clipping; axe zero violations; keyboard-only completion of the primary task; all 8 states of 2.8 reachable in Storybook-like fixtures; no layout shift >0.05 CLS; no table/chart shows zero for unavailable data.

### 5.1 PB view list

| View | Purpose / questions | Primary KPIs | Key components | View-specific acceptance |
|---|---|---|---|---|
| Overview `/` | Is the assistant healthy, did anything change, what did I spend | Executions 30d (completion %), first-token p50/p95, estimated spend vs limit, helpful share | StatusStrip, 4 KpiTiles, ProportionBar (outcomes), Sparkline (when history), "Needs attention", 3 deep-link tiles (Audience, Feedback, Access) | Answer to the 3 questions visible without scroll at 1440×900; no tile >120px; hero cards from today ("Ready", "Fresh") become status pills in the strip |
| Runs `/runs` | Which executions failed or were slow | count, failure rate, slowest | DataTable (id, time, outcome, duration, tokens in/out, cost est, locale), filter chips, sort, peek sheet | Sort by duration; filter outcome + ID prefix; `j/k` navigation; 10k rows virtualised or paginated server-side; copy ID |
| Run detail `/runs/[id]` | Where did the time go in this run | total ms, TTFT, tokens, cost est | Waterfall (shared axis, start offsets), stage table twin, inspector, facts | Overlapping stages visible; cursor + ms readout; stage table accessible; no prompts/answers; permalink |
| Usage `/usage` | Tokens, cost, latency distribution, budget | spend settled/reserved/limit, tokens, p50/p95 | BulletBar (50/80/100), LineChart/ColumnChart with range, latency distribution strip, error codes HBarList | Estimates labelled "estimated, not an invoice"; zero limit shows no percentage; unavailable pricing revision handled |
| Audience `/analytics` | What do visitors do on the portfolio site | views, clicks, exposures | filter chips + RangePicker, ColumnChart daily, countries table with inline bar, 8×8 heatmap with hatch for withheld, coverage `details` | Withheld cells never numeric; heatmap legend with text; table twin default under high contrast |
| Feedback `/feedback` | Are answers helpful, what are people unhappy with | helpful share, volume, unresolved | ProportionBar, DataTable of feedback with category and answer-quality tag, peek sheet | Disabled-feature state explained ("Feedback is off in this environment"); no raw transcript unless already permitted by privacy review |
| Access `/access` | Who can sign in, with which role | members, pending invitations, active sessions | MemberRow table (avatar initial, email, role badge, providers, joined, last access), InviteForm (email + role + expiry), InvitationRow (state + TTL + resend/revoke + copy secret link once), SessionRow (device, IP prefix, last active, current, revoke), linked providers | Owner can't remove last owner (inline reason); one-time invitation link copy reports real clipboard result and warns it is a secret; revoke confirm states consequence; viewer sees 403 state |
| Audit `/access/audit` | Who changed what and when | events | Audit table, filters, row expand, export | Immutable look (no edit affordances), pagination stable by cursor, timestamps in UTC with local tooltip |
| Account `/account` | My profile and preferences | n/a | form sections, theme/density/language, sign out everywhere | Preferences persisted server-side, applied before paint |
| Sign-in `/sign-in`, Privacy | Entry and policy | n/a | centered card with monogram, provider buttons | Disabled-until-hydrated buttons keep layout; explains invite-only |

### 5.2 PQB view list

| View | Purpose / questions | Primary KPIs | Key components | View-specific acceptance |
|---|---|---|---|---|
| Resumen `/panel` | ¿Está funcionando el asistente y cuánto llevamos gastado? | Respuestas completadas 24 h, presupuesto restante del mes, tasa de fallos, tiempo al primer texto p50 | StatusStrip, 4 KpiTiles (marker highlight on budget), outcome ProportionBar, "Para revisar" list, links to Consumo/Ejecuciones/Catálogo | Today's 7 stacked cards reduced to ≤1.5 screens; "Puede responder ahora" collapses into the first tile and strip with the same honest caveat |
| Ejecuciones `/panel/ejecuciones` | ¿Qué respondió o falló? | solicitudes aceptadas, rechazadas antes de responder, interrumpidas | DataTable (hora UTC no-wrap, resultado, código, modelo, idioma, primer texto, total, id), filters (resultado, código), peek sheet | Timestamps do not wrap (`whitespace-nowrap`, compact format with full on hover); error codes shown with Spanish meaning and code in mono |
| Detalle `/panel/ejecuciones/[id]` | ¿Cuánto tardó cada etapa? | tiempos, tokens | Waterfall, facts, tabla de etapas | Same as PB; copy "Sin contenido de conversaciones" always visible |
| Consumo `/panel/consumo` | ¿Cuánto gastamos y vamos a llegar a fin de mes? | gasto informado, estimado, pendiente, límite | BulletBar (límite, corte de seguridad), daily Line/ColumnChart (días ausentes = hueco, no cero), tokens table, assumptions disclosure ("tarifas fixture-rates"), desglose por periodo | Never presented as invoice; "reservas pendientes" separate; projection text only if ≥7 days of history |
| Actividad del sitio `/panel/analitica` | ¿Qué hacen las familias en la tienda? | páginas vistas, vistas de sección, clics públicos | filters (periodo, ruta, sección, dispositivo), ColumnChart, countries table, section coverage heatmap | ES strings only; k-threshold "Reservado (<3)" hatch; periodo/offset in URL |
| Catálogo `/panel/catalogo` | ¿El asistente conoce el catálogo vigente? | revisión, verificación, ventana de precios, último sync, productos, documentos | Facts list (definition list in a two-column card), timeline of last sync attempts, status pills with plain Spanish | Stale vs error distinguished; shows "Último error de sincronización: Ninguno registrado" explicitly |
| Accesos `/panel/accesos` | ¿Quién entra y con qué permiso? | miembros, invitaciones, sesiones | Same IAM components as PB, Spanish copy ("Invitar", "Revocar acceso", "Caduca en 47 h") | Same as PB; invitation link flow keeps current one-time behaviour |
| Auditoría `/panel/accesos/auditoria` | ¿Quién cambió qué? | eventos | Same | Same |
| Cuenta `/panel/cuenta` | Mi perfil, tema, densidad | n/a | form | Adds theme toggle (today: system only) |
| Ingresar, Invitación | Entrada | n/a | illustrated centered card | Illustration + calm copy; error variants for expired/used invitation |

---

## 6. Implementation path

### 6.1 Phase A (polish) vs Phase B (rebuild)

Recommendation: **Phase A for PQB, Phase B (staged) for PB**, converging on the same kit.

- **PQB Phase A (about 1 sprint, low risk)**: already Tailwind 4 + CVA. Steps: (1) adopt `structure.css` semantic names and the Atelier pack (renaming `ink/copy/muted/action` to the shared set via codemod; keep `--pv-*` raw layer); (2) swap pill buttons/headers for the shared Button/DataTable; (3) build AppShell + routes (split `dashboard.tsx` 647 lines into route-level pages); (4) add `Metric`, `ChartFrame`, status standard, ruled tables, theme toggle; (5) Run list/detail, Consumo, Accesos upgrades. Visual diff will be large but features/adapters/domain untouched.
- **PB Phase B (rebuild of presentation, ~2 sprints)**: CSS Modules to Tailwind 4 + CVA is not a restyle but a rewrite of `presentation/` and `shared/ui`. Do it route by route behind the new shell: (1) install Tailwind 4, tokens, kit, AppShell wrapping existing pages; (2) migrate IAM first (smallest, worst-looking), then Overview, then Runs/Run detail, then Audience/Feedback; (3) delete `workbench.module.css`, `report.module.css`, `metrics.module.css`, `auth.module.css` as the last consumer goes; (4) remove `docs/design-system.md` statements about "no Tailwind, CVA" and write the ADR (supersedes ADR 011 in the master plan). `features/*/domain|application|adapters` untouched.
- Both: ship the **shared kit first** in one repo (PQB, since Tailwind/CVA already exist), then sync.

### 6.2 Kit distribution: shadcn private registry vs copy-sync

| Option | Pros | Cons |
|---|---|---|
| shadcn-style private registry (`registry.json` + `shadcn add` from a Git-hosted JSON/URL) | Idiomatic "owned code", diffable updates via `shadcn diff`, per-component granularity, works with Tailwind 4 and Base UI templates | Needs hosting (static JSON on GitHub Pages or a repo raw URL), versioning discipline, token files and CSS need `registry:style` items; theme packs are different per repo so the registry must ship `structure.css` only |
| Copy-sync script from a canonical folder (`ui-kit/` in one repo, `scripts/sync-kit.ts` with a hash check in CI) | Zero infrastructure, matches the repo rule "no runtime import crosses repositories", already how tokens were planned in PB's master plan (`check-tokens.ts` pinned hash) | Manual updates, risk of silent local drift unless the CI hash check fails |
| npm package | Strong versioning | Violates owned-code policy; runtime coupling; private registry cost |

Decision: **copy-sync now, registry-compatible layout**. Canonical kit lives in a new small repo or folder `design-kit/` (components as `registry:ui` items with `registry.json` already authored), synced into each repo's `src/shared/ui` by `scripts/sync-kit.ts` which writes a `kit.lock.json` (commit SHA, file hashes). CI job `check-kit` fails if files differ from the lock unless the PR also updates the lock (local changes must go upstream first or be declared in `kit.exceptions.json`). Move to a real shadcn registry only if a third consumer appears.

Per-repo vs shared files: shared (synced): `shared/ui/*`, `tokens/structure.css`, `lib/cn.ts`, charts wrappers, test helpers (axe, state fixtures). Per-repo: `tokens/pack-*.css`, fonts, illustrations, copy dictionaries, `features/*`.

### 6.3 Gates

Visual regression:

- Playwright screenshot matrix: routes × {light, dark} × {1440, 768, 390} × states {ok, loading, empty, unavailable, error, fixture}; stored in repo (PB already has a gallery workflow) with `maxDiffPixelRatio` 0.002; Chromium, plus a WebKit smoke for 3 key views and the 200% text regression PB already runs.
- Deterministic fixtures with frozen clock (`2026-10-12T23:43Z`), disabled animations, fixed fonts.
- Kit-level story pages (`/__kit` route, dev only) rendering every component state, snapshotted once per kit change in both repos.

Accessibility:

- `@axe-core/playwright` (already in both) on every route/theme/state; fail on any violation.
- Contrast contract: `scripts/check-tokens.ts` computes WCAG ratios for the required pairs (fg, secondary, muted, accent-text, status on surface and canvas; line-control ≥3:1; viz marks ≥3:1; focus ring ≥3:1 against both adjacent surfaces) in both themes and both packs; CI red on regression. Also simulates deuteranopia/protanopia/tritanopia and asserts viz neighbours ΔE ≥ 15 or separated by a gap.
- Keyboard test per template: open palette, navigate, open peek sheet, close with Escape, focus restored; dialog trap; skip link; no keyboard trap in charts.
- WCAG 2.2 specifics: 2.4.11 focus not obscured (sticky strip and topbar get `scroll-padding-top`), 2.5.8 target size 24px, 3.2.6 consistent help (single "?" entry), 3.3.7 redundant entry (invite form keeps email on error), 3.3.8 accessible authentication (no cognitive test on sign-in; provider buttons).
- Manual pass per release: VoiceOver Safari on one view per template, NVDA Firefox on tables and charts, 400% zoom reflow, forced-colors mode (verify hatch and status shapes survive).

Performance: LCP <2s on Overview with 3G-fast emulation not required (private, authenticated) but budget JS ≤170KB gz per route excluding charts; charts lazy-loaded behind client boundaries; reduce motion honoured.

### 6.4 Risks and mitigations

1. **Over-unifying.** Risk: both look the same. Mitigation: identity checklist in 4.3; review screenshots with logo removed; signature details are acceptance criteria.
2. **Rebuild scope in PB.** CSS Modules to Tailwind touches ~1,400 lines of CSS and all presentation. Mitigation: route-by-route behind the shell, no domain/adapter changes, keep existing browser tests as the safety net, ship IAM first.
3. **Kit drift.** Mitigation: lockfile + CI hash check, one owner PR flow, changelog in the kit.
4. **Base UI maturity/API churn.** Mitigation: wrap every Base UI primitive behind owned components, pin versions, keep native fallbacks (`dialog`, `details`) where adequate.
5. **Recharts accessibility and bundle.** Mitigation: wrap only inside `ChartFrame`; custom SVG for ProportionBar, BulletBar, Sparkline, Heatmap, Waterfall (small, fully controlled); keep Recharts for line/column only.
6. **Dense UI vs touch/200% text.** Mitigation: density auto-forces 44px hit areas on coarse pointers, container queries, regression suite at 200% and mobile.
7. **Honesty regressions** (a new chart coercing `null` to 0). Mitigation: `Series | Unavailable` types make coercion impossible in the `ChartFrame` API; lint rule/test grep for `?? 0` in presentation.
8. **Dark/light parity.** Mitigation: both themes in every visual test; token contract requires both; designers review each screenshot pair.
9. **Accent/hatch semantics lost in forced-colors.** Mitigation: SVG patterns use `CanvasText`/system colours under `forced-colors: active`; test in Playwright with `forcedColors: "active"`.
10. **TS 7 and tooling compat** (`tsgo` stricter module resolution, `tailwind-merge` config typing). Mitigation: kit typechecked in both repos; both already ship on TS 7.0.2.
11. **Research limitation.** Product-pattern assertions here are from expertise, not fresh fetches; validate any single pattern (e.g. Langfuse waterfall details, Linear shortcut model) with a quick fetch before committing it as a hard requirement.

### 6.5 Suggested order of work

1. Week 0: write the kit contract (token names, component API, state fixtures), pick the shared repo/folder, finalise the two packs with a script-validated palette and Storybook-like `/__kit` page.
2. Week 1: PQB shell + tokens + kit adoption; Overview + Ejecuciones; visual baselines.
3. Week 2: PQB Consumo, Catálogo, Accesos/Auditoría/Cuenta; theme toggle; gates green.
4. Weeks 3–4: PB Tailwind/kit install, shell, IAM, Overview.
5. Weeks 5–6: PB Runs, Run detail (waterfall), Usage, Audience, Feedback; delete CSS Modules; designer-rubric review of every view in both apps at 95+.
