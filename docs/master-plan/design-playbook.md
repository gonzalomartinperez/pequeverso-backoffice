# Design playbook: "El cuaderno del taller" (Atelier identity)

Plan date 2026-11-09. Planning only. Language of this file: English; every string that the owner will read in the product is Spanish with "tú" (neutral Latin American Spanish, es-419 vocabulary, no voseo), as in `ecosystem.md` section 14.2. Foundation: `research/12-backoffice-redesign.md` (shared standard, token layers, Atelier values, view lists) plus `research/06-ui-ux-design.md` (targets) and `research/01-nextjs-architecture.md` (server/client boundary). The owner granted full creative freedom (`owner-decisions.md`, 2026-11-09); this playbook keeps the research foundation and raises it into a product with a point of view. Palette values below are starting points: `scripts/check-tokens.ts` re-computes every contrast pair and is the authority.

Sibling: `portfolio-backoffice` uses the same shell, templates, component names, states and shortcuts with the "Instrument" identity (graphite and cyan, mono data, no illustration). The two apps share structure, never look. Identity test in section 12.

---

## 1. Why this redesign (evidence from `audit.md`)

| Finding (measured on origin/develop 4d4fb96) | Design consequence |
|---|---|
| `/panel` is one 1,440 x 3,839 px page: 7 stacked cards, 4 jump chips as only wayfinding (`audit/screens/dashboard-1440-light.png`) | Six destinations, one question each, answer first |
| Marketing header (logo, pill links, email) is the app bar; no breadcrumbs, no data-source strip | App shell: sidebar, topbar, status strip |
| Daily table clipped at 1440 inside an 8/12 card (columns cut after "Interrumpidas") | Tables are full-width regions with their own scroll and a visible edge cue; no table inside a half-width card |
| `/panel/accesos` overflows horizontally at 390 px; the e-mail wraps per character (`audit/axe-results.json`, `audit/screens/access-390-light.png`) | IAM rows reflow to stacked rows by container query; global no-overflow test at 320/390/768/1440 on every route |
| Dashboard mobile TBT 2,966 ms, performance 0.70; Recharts 391 KB | Charts become server-rendered owned SVG; zero chart JS |
| Failed = navy vs completed = teal in charts; danger text uses the store's coral | Outcome series carry glyphs and a new berry hue; coral never appears |
| Pill-everything, cards inside cards, uppercase tracked labels read as chips | Radius 6 for controls, pills only for badges and the nav indicator; one hero per page |
| No theme toggle, density, command palette, time controls or audit log | All six added, URL-synced |

What stays, because it is already designer grade: the honesty doctrine ("No disponible", never zero; "No es la factura del proveedor"; synthetic data labelled), native `<dialog>` and `<details>`, 44 px targets, the `--pv-*` OKLCH raw palette, Fraunces + Nunito Sans self-hosted, tuteo copy.

---

## 2. Concept and creative brief

**The user.** Gonzalo (owner) and, rarely, an invited helper. Non-technical about LLM internals, reads in Spanish, checks the assistant in the morning or on the phone, wants three answers in under ten seconds: Is it answering? How much have we spent? Did anything fail? Second job: invite or remove someone safely.

**The idea.** The backoffice is the workshop notebook of the people who make children's learning kits: cream paper, navy ink, a gold marker for the one number that matters, ruled lines for evidence, small hand-drawn objects (letter blocks, a book, a coin purse, a compass) where the product would otherwise show an empty box. Warm and trustworthy because it never hides uncertainty: unknown is drawn as hatched paper, not as zero.

**Six signature moves** (each is an acceptance criterion, implemented once in the kit, reused everywhere):

| # | Signature | What it is | Technical rule |
|---|---|---|---|
| S1 | **Ruled ledger** | Tables and facts are ruled lines on paper with a faint notebook margin rule at the left of the first column; totals use an accounting double underline; labels and values joined with dotted leaders in the Consumo ledger | CSS borders and `background-image` only; native `<table>` and `<dl>` |
| S2 | **Gold marker** | Exactly one key number per page is highlighted as if marked by hand (40% gold underlay under the lower half of the figures); on first paint the marker "draws" left to right in 220 ms | `background-size` on a pseudo-element via `transform: scaleX` (transform only); static under reduced motion; `data-marker` attribute, a test asserts at most 1 per page; gold is never text colour |
| S3 | **Sello de estado** | The overall status is a round rubber stamp (navy ink, text on a circle, slightly misregistered) on the Resumen header: "Todo en orden", "Atención", "Sin lectura" (sentence case, consistent with the no all-caps rule) | Inline SVG with real text and `role="img"` plus visible sentence; static rotation -4 degrees; colour never the only cue (ring shape differs: solid, dashed, dotted) |
| S4 | **Marcapáginas** | The current sidebar item has a small bookmark ribbon notch (clip-path) next to it, in addition to `aria-current="page"` | `clip-path` shape, no raster |
| S5 | **Nota al margen** | One short human line per page in a handwritten face ("Buen día, Gonzalo. Todo tranquilo." or "Ojo: los precios caducan pronto.") placed in the margin of the page header; generated from data by a pure function, max 12 words | Subset handwriting face (Latin, one weight, at most 15 KB, `font-display: swap`) used only here; fallback Fraunces italic; decorative, never the only place a fact appears |
| S6 | **Taller illustrations** | Eight spot illustrations built from the storefront's shapes with a print-like 2 px misregistration between fill and line | Hand-authored two-colour SVG React components, `aria-hidden`, under 3 KB each, `currentColor`-aware, size and no-external-reference test |

Supporting details: faint notebook dot grid on the page canvas (3% navy, radial-gradient, off in compact density and under forced-colors); paper elevation (white sheet on cream, navy-tinted two-layer shadow, 1 px inner top highlight); in dark, the night-sky canvas gets 3 to 5 static star dots at 6% (static SVG, no animation); the sidebar head carries the isotipo with the word "Backoffice" on a paper-tag shaped label.

**Anti-goals.** No generic admin template look; no gradients on data; no motion on data; no tracked all-caps blocks; no coral; no emoji; no decorative parallax; no cartoon mascot; no raster illustrations; no AI-generated images.

**Reference points** (pattern observed, not copied; the research note marks them as expertise, not fetched): Linear and Vercel for shell density and keyboard model, Stripe for answer-first dashboards, Langfuse for the run view idea, accounting ledgers and school notebooks for the paper vocabulary.

---

## 3. Information architecture (shared six-destination standard)

Identical skeleton and order in `portfolio-backoffice`; labels and slugs localised (this app is Spanish only). Viewer role sees every destination except Accesos; a direct URL gives a typed Forbidden state, never a blank page or a redirect loop.

| Slot | Sidebar label | Route | Operator question | Contract source (pinned) |
|---|---|---|---|---|
| 1 Overview | Resumen | `/panel` | ¿Está respondiendo? ¿Cuánto llevamos gastado? ¿Falló algo? | `ops` summary 1.2 plus optional `telemetry` 1.0 |
| 2 Assistant | Ejecuciones | `/panel/ejecuciones`, `/panel/ejecuciones/[id]` | ¿Qué respondió o falló? | `ops.recent` (last 50, opaque ids) |
| 3 Usage and cost | Consumo | `/panel/consumo` | ¿Cuánto gastamos y llegaremos a fin de mes? | `ops.budget`, `windows`, `daily`, `pricing` |
| 4 Audience | Actividad del sitio | `/panel/analitica` | ¿Qué hacen las familias en la tienda? | `analytics` report (bounded private read) |
| 5 Catalog | Catálogo | `/panel/catalogo` | ¿Conoce el asistente el catálogo y los precios vigentes? | `ops.catalog` |
| 6 Access | Accesos | `/panel/accesos`, `/panel/accesos/auditoria` | ¿Quién entra y con qué permiso? | IAM in PostgreSQL |
| Account | (user menu) | `/panel/cuenta` | Mi perfil y preferencias | session |
| Utility | (no shell) | `/ingresar`, `/invitacion/[token]` | Entrar | Better Auth |

URL state: time range, filters, sort and selection live in the query string (`?resultado=fallida&orden=-total`); preferences (theme, density, time zone) live in server-read cookies so the first byte already has the right theme (no flash, removes the inline `matchMedia` script). Old routes keep working through redirects for one release: none are needed (all current routes stay).

`/panel/ejecuciones/[id]` can only show runs present in the API's last-50 window. If the id is not there the page says so plainly (NotFound variant "Esa ejecución ya no está en la lectura reciente") instead of inventing detail. Per-stage spans are not in contract 1.2: see PVB-D5.

---

## 4. App shell

Desktop at 1024 px and wider (all dimensions in tokens):

```
+---------------------------------------------------------------------+
| status strip 32 px (sticky)  Entorno · Datos · Leído hace 2 min [↻] |
+--------+------------------------------------------------------------+
| sidebar| topbar 48 px: migas de pan | rango | ⌘K Buscar | usuario    |
| 232 px +------------------------------------------------------------+
| (rail  | page header: título (Fraunces 24/30) · nota al margen ·    |
|  56 px)|   acciones                                                  |
|        | content: max 1280 px, 12 columns, 24 px gutters            |
+--------+------------------------------------------------------------+
```

| Part | Spec |
|---|---|
| Sidebar | Six destinations with 18 px icons (lucide, 1.75 px stroke, round caps, plus the custom glyphs of section 9); label sentence case; current item has the bookmark notch and `aria-current="page"`; collapsible to a 56 px rail with tooltips (key `[`); footer shows environment pill and version chip (commit, copyable, from `/healthz`) |
| Topbar | Breadcrumbs (last crumb not a link), range control (read-only window label until the contract supports ranges, interactive on Actividad del sitio where `period` and `offset` exist), command palette trigger, user menu (initial avatar, role badge "Propietario" or "Lectura", theme, density, time zone, Cuenta, Salir) |
| Status strip | One row replaces the loud banners: `Entorno` (producción, vista previa, datos de prueba), `Datos` (en vivo, **sintéticos**, degradados, desactualizados hace N min), `Leído a las 10:42` with refresh (polite live region "Datos actualizados"). Fixture mode flips the strip to the warning tone with an icon and the text "Datos sintéticos, no son telemetría de producción"; a popover lists provenance (API revision, pricing revision, catalog hash) |
| Tablet 640-1023 | Sidebar becomes an overlay drawer (native `<dialog>`); topbar keeps breadcrumbs, palette, user menu |
| Phone under 640 | 56 px header (menu, title, user); range and filters move into the page header; tables become card lists or a scroll region with sticky first column; safe-area insets honoured |
| Landmarks | Skip link first ("Saltar al contenido"), `header`, `nav aria-label="Principal"`, `main#contenido`, `aside` for peek sheets; `scroll-padding-top` equals strip + topbar height (WCAG 2.4.11) |

Streaming: the shell renders immediately; each panel is its own `Suspense` boundary with a skeleton that matches the final layout, so a slow API (4 s timeout today) never blocks the first paint. A route-level `error.tsx` and `not-found.tsx` use the same state components.

---

## 5. Tokens

### 5.1 Architecture

Three tiers as in `ecosystem.md` section 13 and `research/12` section 3: primitive `--ref-*`, semantic `--sys-*` (the only layer components read, exposed as Tailwind colours through `@theme inline`), component `--cmp-*` only where two or more variants diverge.

| File | Role | Shared with portfolio-backoffice |
|---|---|---|
| `src/shared/tokens/structure.tokens.json` | Semantic names, type, space, radius slots, motion, density, z-index scales (DTCG 2025.10) | Identical (from `engineering-standards`, hash-checked) |
| `src/shared/tokens/atelier.tokens.json` | `--ref-*` ramps and the light/dark mapping of semantic roles | Different (this repo) |
| `src/shared/tokens/theme.css` | Generated by Style Dictionary v5 (default) or Terrazzo, decided by a half-day spike in M5a; committed; snapshot test; `scripts/check-tokens.ts` runs at build | Generated per repo |
| `src/app/globals.css` | `@import "tailwindcss"`, `@import` theme, base layer, reduced motion | Per repo |

The existing raw `--pv-*` values (storefront tokens) remain the primitives of this pack, so the backoffice is recognisably Pequeverso. Commerce tokens (`--purchase`, `--price`, `--surface-user`, shadows for purchase) are deleted because nothing here uses them (today `docs/design-system.md` says "retained and unused").

Semantic set (same names as the sibling): surfaces `canvas`, `surface`, `surface-raised`, `surface-inset`, `surface-hover`, `surface-selected`, `overlay`; text `fg`, `fg-secondary`, `fg-muted`, `fg-on-accent`, `fg-link`; lines `line-subtle`, `line`, `line-control` (at least 3:1), `ring`; accent `accent`, `accent-hover`, `accent-fg`, `accent-soft`, `accent-text`, `highlight`; status `ok`, `warn`, `critical`, `info`, `unknown`, each with `-fg`, `-soft`, `-line`; viz `viz-1..5`, `viz-seq-1..5`, `viz-grid`, `viz-axis`, `viz-withheld`; elevation `shadow-1..3`, `border-elev`.

### 5.2 Atelier values (from research 12 section 3.5; verified by script, not by hand)

| Token | Light | Dark ("noche del taller") |
|---|---|---|
| canvas | cream `oklch(0.9868 0.0118 80)` #fffaf2 | night `oklch(0.215 0.07 256)` #011839 |
| surface | white | `oklch(0.27 0.075 256)` |
| surface-inset | sky `oklch(0.9594 0.02 250)` | `oklch(0.24 0.07 256)` |
| fg / secondary / muted | #0b1f3a / #425267 / #55647a | white / #cfd8e5 / #a5b2c4 |
| line-subtle / line / line-control | navy 8% / 14% / 55% | white 8% / 14% / 50% |
| accent (action) | navy `oklch(0.3175 0.1094 256)` | turquoise `oklch(0.8521 0.0956 187)` |
| accent-text | teal `oklch(0.4352 0.0749 191)` | turquoise |
| highlight (marker) | gold `oklch(0.8908 0.1645 94)` | gold at 20% |
| ok / warn / critical | #13684b / #7b5518 / #9d2a39 (berry, never coral) | #78dca9 / #f4d660 / #fb9890 |
| viz-1..5 | teal #007974, navy #003169, ochre #b67700, berry #a83442, plum #754d9e | #7ee2d8, #81ade9, #f6d653, #f98f87, #bc97e8 |

Contrast results recorded in the research note (surface): light fg 16.5, secondary 8.0, muted 6.0, accent-text 7.6, ok 6.8, warn 6.6, critical 7.4; dark fg 15.1, secondary 10.5, muted 7.1, accent 10.0. Viz marks at least 3:1 (ochre 3.7 is the floor and is never text). `check-tokens.ts` asserts: text pairs at least 4.5:1 (7:1 for body, aim from `research/06`), `line-control` and viz marks at least 3:1, focus ring at least 3:1 against both adjacent surfaces, deuteranopia/protanopia/tritanopia simulation with neighbour distance rule (research 12 section 6.3), and that both themes define every semantic key. Tokens are authored as light/dark pairs with equal contrast relationships, not mirrored lightness; dark chroma reduced 10-20%.

Outcome encoding (replaces navy-vs-teal): completada teal with check glyph, fallida berry with cross, cancelada slate with dash, interrumpida ochre with pause, rechazada plum with block glyph. Always glyph plus label.

### 5.3 Scales

Type (px / line height): 12/16 caption, 13/18 label, 14/20 compact body, 15/22 body (default), 16/24, 18/26 card title, 20/28, 24/30 page title, 32/38 KPI value, 44/48 hero figure (Resumen only). `tabular-nums` on every numeric surface; sizes are `--text-*` registered in the `tailwind-merge` config (existing `cn.ts` pattern, moved to `shared/lib`). Inputs are 16 px on touch to avoid iOS zoom. Spacing 4 px unit (0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64). Radii: 6 controls, 12 cards, 20 illustrated empty states only, pill only for badges and the nav indicator. Breakpoints 480/640/768/1024/1280/1536 plus container queries for panels. Z-index: base 0, sticky 10, strip 20, drawer 30, dialog 40, toast 50, tooltip 60.

Fonts (self-hosted woff2, metric-matched fallbacks, unchanged files): Fraunces 600-700 for page titles, card titles and KPI values (never below 17 px); Nunito Sans 500 for UI at 14-15 px; IDs in the `ui-monospace` stack at 13 px (no new font); the handwriting subset for S5 only. Font budget for the app: at most 160 KB total, enforced by `check-bundle.ts`.

Density (`data-density` on `<html>`, cookie-persisted, key `d`): compact 32 px rows / 32 px controls / 16 px card padding; **default 40 / 40 / 20**; comfortable 48 / 44 / 24. `pointer: coarse` forces at least 44 px targets whatever the density. Desktop admin floor 32 px, WCAG 2.5.8 floor 24 px.

---

## 6. Component kit (owned, CVA, native first)

Decision PVB-D4: **no Base UI and no other UI dependency.** `ecosystem.md` O4 says Tailwind 4 plus owned CVA primitives and no UI kit; `research/12` suggested Base UI for non-trivial behaviour and is superseded on that point. Non-trivial behaviour is built on native platform features: `<dialog>` (modal and drawer), Popover API for menus and popovers, `<details>` for disclosure, `<meter>` and `<progress>`, roving tabindex hooks written once in `shared/ui/use-roving.ts` (about 40 lines), a small combobox pattern for the command palette. Dependency allow-list: Tailwind 4, CVA, tailwind-merge, clsx, lucide-react (icons imported individually). Exit cost: none.

Primitives: `Button` (primary, secondary, ghost, destructive, link; sm 28, md 32, lg 40; loading keeps width, `aria-busy`), `IconButton` (tooltip required), `Field`/`Input`/`Select` (native)/`Checkbox`/`Switch`/`RadioGroup`/`SegmentedControl`, `Badge` and `StatusPill` (glyph plus text), `Tabs`, `Breadcrumb`, `Disclosure`, `Dialog`, `Sheet`, `Menu`, `Tooltip`, `Toast` (polite region), `Avatar` (initial plus provider glyph), `Kbd`, `CopyButton` (reports the real clipboard result), `RelativeTime` (`<time>` with absolute in `title`), `Skeleton`, `Separator`, `Card` (flat, paper, inset), `Callout` (info, success, warning, critical).

Composites: `AppShell`, `Sidebar`, `Topbar`, `StatusStrip`, `CommandPalette`, `RangePicker`, `UserMenu`, `PageHeader`, `Toolbar`, `FilterChips`, `Metric`, `KpiTile`, `KpiRow`, `DataTable`, `ChartFrame`, `ProportionBar`, `BulletBar`, `Sparkline`, `ColumnChart`, `LineChart`, `HBarList`, `Heatmap`, `RunLine`, `EmptyState`, `ErrorState`, `UnavailableState`, `ForbiddenState`, `NotFoundState`, `MemberRow`, `InviteForm`, `InvitationRow`, `SessionRow`, `AuditRow`, `ConfirmDialog` (type-to-confirm), and the atelier set: `Marker`, `Stamp`, `Ledger`, `MarginNote`, `Bookmark`, `PaperCard`.

`Metric` is the honesty primitive: a tagged value `ok | empty | unavailable | stale | withheld | error`; there is no code path from `null` or `undefined` to a rendered `0`. `DataTable`: native `<table>`, sticky header, sortable columns (three sort states, icon on active column only), column menu, density, optional selection, row actions, keyboard grid navigation (arrow keys, Enter opens peek), sticky first column on phones, numeric columns right-aligned with tabular figures, timestamps `white-space: nowrap`, five states (loading skeleton rows, empty, empty-filtered with "Quitar filtros", error with retry, partial banner). Table header text is sentence case in `surface-inset`, not tracked uppercase chips.

Kit location and sync: canonical in `engineering-standards/kit/backoffice/` once that repo exists (E1, E14); until then this repo is the canonical copy and the sibling copies from this repo's `develop` SHA. `scripts/sync-kit.ts` writes `kit.lock.json` (source SHA, file hashes); CI job `check-kit` fails when files differ from the lock unless the PR updates the lock or the file is listed in `kit.exceptions.json`. Per-repo files: `atelier.tokens.json`, fonts, illustrations, `messages/es.ts`, `features/*`. A registry (shadcn style) only if a third consumer appears.

---

## 7. States standard (all views)

One component per state, same anatomy: 24 px icon or illustration, title (what happened, sentence case), one sentence (why or what it means), one action, optional `<details>` (request id, timestamp).

| State | Trigger | Look | Copy (tú) |
|---|---|---|---|
| Cargando | first fetch over 100 ms | Skeleton matching the final layout, shimmer at most 1.2 s (opacity/transform layer), skeleton only after 1 s, `aria-busy`, polite announcement | (none) "Cargando ejecuciones" announced |
| Actualizando | later fetch | Data stays, strip shows spinner, no layout shift | "Actualizando…" |
| Vacío | no records ever | Spot illustration (luna dormida), what will appear and how | "Todavía no hay ejecuciones. Aparecen cuando alguien le hace su primera pregunta al asistente." |
| Vacío filtrado | filters give zero | Compact, filter bar stays, "Quitar filtros" | "Ninguna ejecución coincide con fallidas de las últimas 24 h." |
| No disponible | source down, not configured, withheld by contract | Dash, reason, hatched frame instead of a chart; never zero bars or flat lines | "El costo no está disponible: el registro no respondió a las 14:02." |
| Desactualizado | older than its SLA | Value kept, warning tone, age shown | "Última lectura buena hace 38 min." |
| Reservado (privacidad) | count under the threshold k=3 | Hatched neutral cell | "Reservado (menos de 3)" |
| Parcial | some panels failed | Page renders; failed panels show No disponible in place; one callout lists them | "Dos paneles no cargaron: Consumo, Catálogo." |
| Error | unexpected | `role="alert"`, retry, request id | "Algo salió mal de nuestro lado. Reintenta; si sigue, avísale a Gonzalo con este código." (id in details) |
| Sin permiso / No encontrado | role or URL | Dedicated page, illustration (llave / libro perdido), link back | "Esta sección es solo para la persona propietaria." |
| Éxito | mutation | Toast, 5 s, Undo only when reversible; copy-link reports the real clipboard result | "Invitación creada. Copia el enlace ahora: no se vuelve a mostrar." |
| Sintético | `fixture` source | Strip tone plus "SINTÉTICO" tag in each Metric corner | "Datos de prueba" |

Every state is reachable through fixtures (`scripts/mock-ops.ts` modes) and rendered on the dev and test only `/__kit` page and in the visual matrix.

---

## 8. Data visualisation standard (`research/12` section 2.9, tightened for this app)

| Question | Component | Forbidden |
|---|---|---|
| ¿Está bien? | StatusPill plus sentence; the Stamp on Resumen | Gauges, traffic lights without text |
| ¿Cuánto? | `Metric` (value, unit, delta only when history exists, source) | Radial rings for tiny shares (the budget keeps a bar, now the BulletBar) |
| ¿Cómo va en el tiempo? | `ColumnChart` for counts per day (at most 45 bars) and `LineChart` for continuous series; time axis; days without a record are hatched gaps, not zero | Smoothing across missing days; stacked areas with more than 4 series |
| Partes de un todo (at most 5) | `ProportionBar` with direct labels | Pie or donut over 3 parts |
| Gasto frente al límite | `BulletBar` "la regla": settled, pending and estimated segments, tick marks at 50, 80 and 90 (corte de seguridad) and 100% of the limit | Ring or gauge |
| Tiempos | p50 and p95 as a `Metric` pair plus a range bar (p50 to p95 on a shared scale) | Mean only. The contract has no distribution, so no histogram is drawn |
| Una ejecución | `RunLine` (section 10.2) | Bars normalised to the longest phase |
| Densidad espacial | `Heatmap`, five discrete steps plus hatch for reservado | Continuous rainbow |

Rules: categorical `viz-1..5` distinct from status colours (status colours appear only where the series is status, always with glyph and label); marks at least 3:1 against the card and separated from neighbours by a 2 px surface gap; faint grid, no plot border, direct labels when four series or fewer; compact `Intl` notation in tiles, exact numbers in tables; "US$ 0,00" never shown for unknown, `< US$ 0,01` for sub-cent.

Accessibility twin: every `ChartFrame` is a `<figure>` with `<figcaption>` (title plus a generated sentence: "52 de 58 respuestas completadas (90%)") and a **"Ver como tabla"** toggle that swaps chart and table (CSS radio toggle, no JavaScript); the table is the default under `prefers-contrast: more` and in print. SVG marks are focusable groups with full-sentence `aria-label`; the value card appears on hover and focus through CSS. Sparklines only with at least 7 real points. Charts take `Series | Unavailable`, so coercion is a type error; a test greps presentation code for `?? 0` and `|| 0`.

Implementation decision PVB-D3: charts are **owned server-rendered SVG** (about 6 KB in total), Recharts is removed in M5. Reason: Recharts is 391 KB of client JavaScript and the main cause of the 2,966 ms mobile TBT (`audit/lighthouse-summary.json`); server SVG has zero hydration cost, full control of hatch, glyphs and focus, and the app needs only columns, lines and bars. Alternative rejected: keep Recharts behind `next/dynamic` (M3 interim only; still ships 391 KB on routes with charts).

---

## 9. Illustration and iconography

Icons: lucide-react, 18 px (16 px dense), 1.75 px stroke with round caps and joins (matches Nunito). Domain glyphs drawn on the same grid, hand-authored SVG in `shared/ui/glyphs/`: libro abierto (Ejecuciones), monedero (Consumo), letras y bloques (Catálogo), brújula (Resumen), huellas (Actividad del sitio), llave (Accesos). Check and cross, dash, pause and block glyphs for outcomes.

Spot illustrations (S6), all two-colour (navy line, one accent fill per theme), print misregistration of 2 px, decorative:

| Illustration | Used for |
|---|---|
| Luna dormida | Vacío: sin ejecuciones, sin datos todavía |
| Brújula | No disponible; Resumen header |
| Llave | Sin permiso |
| Libro perdido | No encontrado, ejecución fuera de la lectura reciente |
| Bloques caídos | Error |
| Monedero | Consumo sin gasto registrado |
| Lupa con estrella | Vacío filtrado |
| Bloques de letras apilados | Ingresar and invitación |

Tests: each file under 3 KB, `aria-hidden="true"`, no external `href`, uses `currentColor` or tokens only, renders in forced-colors. Owner taste approval of the set is PVB-D9 (owner-only).

---

## 10. Views (acceptance per view)

Cross-cutting acceptance for **every** view: screenshots light and dark at 1440, 1024, 768 and 390; 200% text and 400% zoom without clipping or horizontal scroll (reflow at 320); axe zero violations; keyboard-only completion of the primary task; every state of section 7 reachable in fixtures; CLS at most 0.05; no table or chart shows zero for unavailable data; exactly one gold marker; designer rubric (research 12 section 5: hierarchy 20, system consistency 15, states 15, data-viz honesty and accessibility 15, responsive 10, motion and interaction 10, microcopy 10, performance and robustness 5) at least 95 by the independent evaluator.

### 10.1 Resumen `/panel`

Question: ¿Está respondiendo? ¿Cuánto llevamos gastado? ¿Falló algo?
Anatomy (at most 1.5 screens at 1440 x 900; today about 3,839 px):

1. Page header: title "Resumen", Stamp (S3) at the right, margin note (S5): "Buen día, Gonzalo. Todo tranquilo." (time of day in Buenos Aires, owner name from session).
2. One-sentence summary: "Hoy el asistente **puede responder**. En las últimas 24 h respondió 52 de 58 preguntas y te quedan **US$ 8,56** de US$ 10 este mes." The remaining budget carries the gold marker.
3. KpiRow, four tiles, none taller than 120 px: Respuestas completadas 24 h (completed of accepted, "No mide disponibilidad"), Presupuesto que queda (marker), Fallos 24 h (count and share), Primer texto típico (p50) with "casi siempre antes de 4,2 s" (p95) behind a "¿Qué significa?" popover.
4. Two panels, 8/4 columns: "Últimos 7 días" ColumnChart of completed and failed per day with glyphs, and "Cómo terminaron" ProportionBar of outcomes (24 h).
5. "Para revisar" (up to 5 items, deep links): failed runs in 24 h (links to Ejecuciones filtered), catalog status or prices expiring in under 48 h, budget at 50/80%, telemetry readiness not ready, fixture mode active.
6. Disclosure "Estado técnico" (existing telemetry content: readiness, resources, HTTP counters, traces, always labelled as point-in-time and not provider availability).
Data: `availability`, `service`, `windows[24h]`, `budget`, `daily`, `recent`, `catalog`, `telemetry`.
Acceptance: the three questions are answered above the fold at 1440 x 900; stamp and sentence agree (a test derives both from the same function); "Puede responder ahora" caveat ("Estado declarado por la API en esta lectura, no un historial de uptime") is kept as the stamp's `title` and in the technical disclosure.

### 10.2 Ejecuciones `/panel/ejecuciones` and `/panel/ejecuciones/[id]`

List: `DataTable` of `recent` (contract bound: last 50, "Se muestran las últimas 50"). Columns: Hora (America/Argentina/Buenos_Aires default, UTC in `title`, `nowrap`), Resultado (pill with glyph), Código (mono plus Spanish meaning: `budget_exhausted` "Se alcanzó el presupuesto"), Con modelo (Sí/No), Idioma, Primer texto, Total, ID (16 hex characters, copy button, link to detail). Filters (chips, URL): resultado, código, idioma, "solo las lentas" (over the 24 h p95). Sort by time, primer texto, total. `Enter` opens a 480 px peek sheet (`aside`), `J`/`K` move, `Cmd+Enter` or the ID opens the route; on phones the sheet is a full route. Empty-filtered and unavailable states as in section 7.
Detail: header with outcome badge, copyable ID, time, total; **RunLine** (honest two-mark ruler): a time axis from 0 to total with a mark "primer texto" at `first_delta_ms` and the end mark; refused runs (0 ms, no model call) render as a single "rechazada antes de responder" mark; null `first_delta_ms` shows hatched "No disponible". Facts list (Ledger style): modelo usado, idioma, reemplazada por reglas, código. "Ejecuciones relacionadas": same code in the window. Permanent line: "Sin contenido de conversaciones: solo medidas operativas."
Acceptance: timestamps never wrap; sort and filter state in URL; 50 rows at default density render under 100 ms server time with the mock; direct link to an id outside the window shows the NotFound variant; no prompt, answer, buyer data or cookie ever rendered (test greps the page for contract-forbidden fields).

### 10.3 Consumo `/panel/consumo`

Question: ¿Cuánto gastamos y llegaremos a fin de mes?

1. Key line with marker: "Te quedan US$ 8,56 antes del corte de seguridad".
2. **La regla** (`BulletBar`): month limit 10,00 with settled / pending / estimated segments and ticks at 50, 80, 90 (corte) and 100%; zero limit hides the percentage.
3. **El libro** (`Ledger`): rows Con uso informado, Estimado, Pendiente, Límite, Corte de seguridad, Restante, columns Mes and Día (UTC day stated), dotted leaders, double underline on the total. Caption "Importes calculados con el uso informado y las tarifas versionadas, no la factura del proveedor." Pricing revision in a disclosure.
4. Tabs 24 h | 30 días (the two contract windows): accepted/completed/failed/cancelled/interrupted/refused, replaced, failure codes `HBarList`, p50/p95 pairs with the range bar, tokens (entrada, en caché, salida, razonamiento).
5. Daily cost `ColumnChart` (confirmed vs estimated, 2 series) with table twin; days absent are hatched gaps. A projection sentence ("Al ritmo de los últimos 7 días llegarías a unos US$ X este mes") only with at least 7 daily points, labelled as an estimate.
Acceptance: never worded as an invoice; pending reservations are separate; unavailable pricing revision handled; every number reconciles with the same fields on Resumen (a test).

### 10.4 Actividad del sitio `/panel/analitica`

Existing capability, disabled by default (`PRODUCT_ANALYTICS_READ_ENABLED=false`), rebuilt on the kit: Metric trio (visitas de página, vistas de sección, clics públicos; marker on the first) with the coverage note "Solo eventos recibidos; no son personas, pedidos ni conversión"; filter chips and RangePicker (`period`, `offset`, route, section, viewport bucket, locale in the URL); daily ColumnChart with table twin; countries table with inline bars (when `country_collection` is disabled, the state says so); section grid `Heatmap` with hatch for reservado and a legend with text; synthetic vs production-class classification shown in the strip. Acceptance: withheld cells never numeric; the disabled state makes no private read (kept test); high-contrast default is the table.

### 10.5 Catálogo `/panel/catalogo`

Question: ¿Conoce el asistente el catálogo y los precios vigentes?
"Ficha del catálogo" as a Ledger definition list: estado, origen, revisión (copyable), huella sha256 (copyable, shortened), verificado, activado, último intento, último error ("Ninguno registrado" explicit), productos, documentos. Timeline ruler: generado, verificado, activado, último intento. Marker on "Los precios caducan en 5 d 4 h" (verified_at plus `price_max_age_hours`). Stale and error are distinct states with plain Spanish. Acceptance: no catalogue content is shown, only state; fixture badge when synthetic.

### 10.6 Accesos `/panel/accesos` and `/panel/accesos/auditoria` (owner only)

Settings template, sections as `fieldset` cards with one primary action each:

- **Miembros**: `MemberRow` (initial avatar, e-mail on its own line with `min-width: 0` and overflow wrap only when it truly overflows, role badge, providers, joined, active sessions). On containers under 640 px rows stack; this is the fix for the P1 overflow. "Quitar acceso" opens `ConfirmDialog` with the consequence ("Pedro saldrá de sus 2 sesiones y no podrá volver sin una invitación nueva") and type-to-confirm of the e-mail; the last owner and oneself are protected with an inline reason.
- **Invitaciones**: `InviteForm` (e-mail, role, 48 h expiry shown), `InvitationRow` with state (pendiente, vencida, aceptada, revocada), time to expiry ("Caduca en 47 h"), revoke, and the one-time link copy with a real clipboard result and the warning that the link is a secret. Existing behaviour is preserved (single-use token digest, one open invitation per e-mail).
- **Sesiones** (new use case): `SessionRow` per session (device summary from the user agent, IP shown as a /24 or /48 prefix, last active, "Esta sesión" badge, revoke); "Cerrar todas las demás".
- **Cuentas vinculadas**: providers; owner can link another account; viewers are refused (existing).
- Link to Auditoría. Viewer: Forbidden state.
Auditoría: append-only table from `backoffice_access_audit` (invitation_created, invitation_revoked, invitation_accepted, member_removed); sticky filter bar (acción, quién, rango); expandable row; actor and subject names resolved by a live join to `auth_user` and shown as "cuenta eliminada" when gone (PVB-D6), the table itself still stores ids only; cursor pagination on `(at, id)`; CSV export for the owner (names included, owner-only, `no-store`). Notice "Estos eventos solo se agregan, nunca se editan." Acceptance: no edit affordances; timestamps with absolute time on focus and hover; viewer gets 403 state; permissions are verified by the authz matrix test.

### 10.7 Cuenta `/panel/cuenta`

Perfil (name, e-mail, role read-only, providers), Preferencias (Tema: sistema, claro, oscuro; Densidad; Zona horaria: Argentina o UTC), "Cerrar sesión en todos los dispositivos". Preferences are cookies applied before paint. Theme toggle is new (today system-only); dark and light are scored separately and the minimum counts (rubric P5; the storefront's single-theme ADR-0006 does not apply to this private app).

### 10.8 Ingresar and invitación (no shell)

Centered paper card, isotipo, bloques de letras illustration, one sentence ("Entra con la cuenta de Google o GitHub que ya tiene acceso"), two provider buttons with stable layout while hydrating, invite-only explanation, error variants for expired, used and revoked invitations with calm copy. The fake identity provider click-through stays the E2E, visual and DAST path (see `testing.md`); the real provider flow is MV.

---

## 11. Motion, interaction, keyboard

Durations 100/150/220/320 ms (400 is the ecosystem page maximum and unused here); easings enter `cubic-bezier(.05,.7,.1,1)`, standard `(.2,0,0,1)`, exit `(.3,0,.8,.15)` (ecosystem section 13); only `transform` and `opacity`.

Allowed: popover and menu fade plus 4 px translate; sheet and drawer slide (transform); toast; bookmark and tab indicator (transform); skeleton shimmer (opacity or gradient layer transform); marker draw (scaleX, once); copy confirmation; sidebar rail collapse (grid track, no chart reflow animation). Not allowed: counting numbers, bar growth, parallax, route transitions beyond opacity, motion on data. `prefers-reduced-motion: reduce`: durations 0.01 ms, shimmer static, marker static, status pulse off; a Playwright test emulates it and asserts computed durations.

Keyboard (visible UI equivalent for each, WCAG 2.1.4; disabled while typing): `Ctrl/Cmd+K` and `/` palette; `g` then `r/e/c/a/k/s` (Resumen, Ejecuciones, Consumo, Actividad, Catálogo, Accesos) with a 1.2 s timeout; `[` sidebar; `r` refresh; `t` theme; `d` density; `j`/`k`/`Enter`/`Esc` rows and peek; `?` help dialog. The command palette (native `<dialog>` plus an owned combobox) navigates, runs actions (tema, densidad, actualizar, copiar versión) and finds recent runs by id prefix; it never searches conversation content and never lists destinations the role cannot open. The only "help" entry is a single "?" (WCAG 3.2.6).

---

## 12. Language, formats, identity test

Language: typed dictionary `src/shared/i18n/messages/es.ts` (all strings; a test fails on hard-coded Spanish text in `.tsx`), sentence case, no all-caps copy except the 12 px eyebrow with 0.04em tracking, tuteo, es-419 vocabulary. A copy lint (cspell with the Spanish dictionary plus a voseo and regionalism denylist: `tenés`, `podés`, `mirá`, `vos`, `acá`... ) runs on the dictionary. Technical terms live behind "¿Qué significa?": p50 "tiempo típico", p95 "los casos lentos (1 de cada 20)", primer texto "desde que la API acepta la pregunta hasta el primer fragmento", ejecución "una pregunta que le hicieron al asistente".

Formats (PVB-D11): `Intl` everywhere; numbers in es-AR style (`US$ 8,56`, `2,4 M`) as today; timestamps shown in America/Argentina/Buenos_Aires (fixed UTC-3) with UTC in the tooltip, and day buckets labelled "día UTC (de 21:00 a 21:00, hora de Argentina)" because the contract's days are UTC; the Cuenta preference switches to UTC.

**Identity test** (checklist from research 12 section 4.3): with the logo removed a screenshot must still read as Pequeverso within a second, and must not be mistakable for the sibling; with colours removed the layout must match the sibling's skeleton. Same as the sibling: routes skeleton, shell anatomy, templates, component names, states, chart rules, motion, density, shortcuts, semantic token names, accessibility gates. Different: palette pack, fonts, radii, elevation model, icon stroke, illustration, signatures S1-S6, voice. The M5 evaluator is given both repos' screenshots and must answer which is which with the logos hidden.

---

## 13. Gates and measurement

| Gate | Tool | Threshold | Cadence |
|---|---|---|---|
| Token contract | `scripts/check-tokens.ts` | Contrast, CVD, both themes, both packs define every key | build, PR (code profile) |
| Literals | Biome lint plus `scripts/check-literals.ts` | No colour, spacing or font literals outside tokens | PR |
| Kit sync | `scripts/sync-kit.ts --check` | Hashes equal `kit.lock.json` | PR |
| No horizontal overflow | Playwright | `scrollWidth <= clientWidth` on every route at 320, 390, 768, 1440, both themes; fixes the P1 | PR (Chromium), nightly (3 engines) |
| Visual regression | Playwright `toHaveScreenshot`, pinned Playwright image | 10 routes x 2 themes x 3 viewports (1440, 768, 390) plus state fixtures and `/__kit`; `maxDiffPixelRatio` 0.002, animations disabled, frozen clock `2026-11-09T12:00Z`, fonts ready, reduced-motion variant; baselines in the repo with a 12 MB cap | PR on affected routes, release all |
| axe | `@axe-core/playwright` | 0 violations (WCAG 2.2 AA tags) per route x theme x state | PR |
| Keyboard | Playwright | Per template: open palette, navigate, open peek, Escape, focus restored; dialog trap; skip link; no trap in charts | PR |
| Forced colors, zoom | Playwright `forcedColors: "active"`, 200% and 400% | Hatch and glyphs survive; no clipping | nightly |
| Performance | Lighthouse CI (5 runs, median) and `check-bundle.ts` | Mobile: performance at least 0.90, TBT at most 200 ms, LCP at most 2.0 s, CLS at most 0.05; route first-load JS at most 170 KB gz; fonts at most 160 KB; a11y 1.0; SEO category excluded (the app is noindex by design; a test asserts the header) | PR (warn first 14 days, then fail), release |
| Reduced motion | Playwright emulation | Durations at most 0.01 ms; no running animations on data | PR |
| Honesty | unit tests | `null` never renders 0; grep for `?? 0`; Metric states exhaustive | PR |
| Designer evaluator | Independent agent against rubric lens 2 and the operator lens, with screenshots and this playbook | At least 95 per axis and per view; recorded in `progress.md` | M3 baseline, M5, M6, each release |
| Manual pass | Owner or a fresh human reviewer: VoiceOver Safari and NVDA Firefox on one view per template, 400% reflow | Checklist signed | each release (human input: P3 floor 90 until done) |

---

## 14. Phasing (maps to `roadmap.md`)

Phase A (M3): fix P1 overflow and the clipped table, lazy-load Recharts as an interim, no new look. Phase B (M4): structure moves that make the redesign cheap (split `dashboard.tsx`, composition root, messages dictionary, `shared/` layout). Phase C (M5): tokens, kit, shell, views, charts, states, illustrations, baselines, evaluator. Order inside M5: tokens and kit first with `/__kit` (week 0, upstreamed for the sibling), then shell plus Resumen and Ejecuciones, then Consumo, Catálogo, Accesos with Auditoría and Cuenta, then Actividad del sitio, illustrations and polish. Domain, application and adapters are untouched except the new IAM use cases (audit read, sessions).

Risks: over-unifying with the sibling (identity test); kit drift (lock plus hash); owner taste (PVB-D9, D10 approvals at a fixed checkpoint with screenshots, one revision round); handwriting font weight (budget, fallback); per-stage run detail expectations (PVB-D5).
