# 06 - Best-in-class product UI/UX engineering, 2026

Date: 2026-11-09. Scope: master plans (95+/100) for two public Next.js sites (AI-engineer portfolio; pequeverso.com kids kit store) and two private backoffices. Stack assumed: Tailwind 4 + OKLCH tokens, shadcn on Base UI, GSAP, three.js, Fraunces + Nunito Sans.

Method note: web search budget ran out mid-session (200 calls shared); roughly 14 topics were searched and ~25 primary pages fetched. Items I could not verify at a primary source are flagged in "Contested/uncertain". Commercial-interest sources are marked **[C]**.

---

## 1. Design tokens architecture

**Standard.** The DTCG format reached its first *stable* version, **2025.10**, on 2025-10-28, split into Format, Color and Resolver modules, all published as Final Community Group Reports (S1, S2). It is explicitly **not on the W3C Standards Track** (S1). Supporters named: Adobe, Figma, Penpot, Sketch, Style Dictionary, Tokens Studio (S1). The Color module takes `$value` as an object: `colorSpace` (srgb, display-p3, oklch, oklab, lab, lch, hsl...), `components` array (oklch = [L 0-1, C >= 0, H 0-360)), optional `alpha`, optional 6-digit `hex` fallback (S3). So an OKLCH-native token file is now spec-legal; keep `hex` as fallback for tools that cannot parse OKLCH.

**Three tiers (consensus pattern, used by Material 3 as ref/sys/comp and Spectrum/Carbon-like systems).**

1. Primitive (reference): raw scales only, never used in components. `--color-sand-50..950`, `--space-1..`, `--dur-100..`.
2. Semantic (system): intent and role. `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--border`, `--accent`, `--accent-contrast`, `--danger`, `--focus-ring`. This is the only layer that changes between themes.
3. Component: only where a component needs its own override (`--button-primary-bg`, `--table-row-h`). Rule of thumb: create a component token only when two or more variants/states diverge from a semantic token; otherwise skip the tier (avoid token bloat).

**Tailwind 4 mapping.** `@theme` variables in namespaces (`--color-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`, `--container-*`, `--breakpoint-*`) both generate utilities and emit `:root` CSS variables; `--color-*: initial;` resets a namespace; `@theme inline` inlines values when a theme var references another var (needed for `--font-sans: var(--font-fraunces)` from next/font and for semantic tokens that alias primitives); `@theme static` forces emission of unused vars (S4). Default Tailwind palette is OKLCH (S4). Recommended layout: primitives in `@theme` (or `@theme static` if consumed by JS/GSAP/three.js), semantic tokens in `:root` + dark override, then `@theme inline { --color-surface: var(--surface); }` so utilities follow theme switches at runtime.

**OKLCH practice (S5).** L is perceptual lightness 0-1; hue stays stable as chroma changes (avoids HSL/LCH blue-to-purple drift); chroma stays below ~0.37 for sRGB and P3; out-of-gamut values are clipped by browsers (hue can shift), so ship sRGB-safe values plus a `@media (color-gamut: p3)` override for punchier chroma; a 20% L difference is not enough for text contrast. Practical rules: build each ramp by fixing hue, stepping L evenly (e.g. 0.98 -> 0.15), and taper chroma at the L extremes (C <= 0.02 at L > 0.95 and < 0.2) to avoid gamut clipping; verify every text pair with a contrast tool, not by L-delta.

**Light/dark parity techniques.**

- `light-dark(a, b)` is Baseline Newly available since 2024-05-13 (Chrome/Edge 123, Firefox 120, Safari 17.5); requires `color-scheme: light dark` on `:root`; accepts colors only (not images/gradients stops OK as colors) (S6, S7). It halves token declarations (one line per semantic token) and removes the media-query override block.
- For a manual toggle, set `color-scheme` via `[data-theme]` on `<html>` (`color-scheme: light` / `dark`) and let `light-dark()` follow; persist in a cookie (not localStorage) so Next.js can render the correct class server-side and avoid FOUC. Keep a "system" option.
- Parity procedure: author the semantic table once as pairs (light, dark); require the same *contrast relationships* in both (text/surface >= 7:1 for body targets, border/surface >= 3:1 for controls), not mirrored lightness values. Dark surfaces: L 0.16-0.22 (not pure black) with elevation as +0.02-0.04 L per level; reduce chroma 10-20% on saturated accents in dark mode to limit vibration; shadows become borders/L-steps.
- Test both themes in visual regression (section 11) and axe in both.

**APCA vs WCAG 2 contrast.** WCAG 2.x ratio (4.5:1 body, 3:1 large text and UI components) is the *only* legally referenced metric (EN 301 549 / EAA; see section 6). APCA is perceptually better for dark mode and thin/large type but is **not normative**: the WCAG 3 editor's draft says "The contrast algorithm used in WCAG 3 is yet to be determined" (S8, S9); APCA was dropped from the 2023 draft and its return is unknown (S9). Base UI docs themselves suggest considering APCA "unless you have strict compliance needs" (S10). Playbook: **gate on WCAG 2 ratios (compliance), use APCA as an advisory second check** (flag pairs with Lc < 60 for body text, Lc < 75 for <= 14px; Lc values from the APCA community guidance, not verified at W3C). Dark mode is where WCAG 2 over/under-reports most, so eyeball real devices.

---

## 2. Fluid typography and spacing rhythm

- Use Utopia-style `clamp(min rem, intercept rem + slope vw, max rem)`; the generator output has rem floors/ceilings, e.g. `clamp(1rem, 0.7143rem + 1.4286vw, 2rem)` for 320-1440px (S11). Utopia is an open tool by Clearleft authors; no commercial angle found.
- **Zoom caveat (WCAG 1.4.4).** vw terms do not scale with browser zoom, so text can fail to reach 200% (S12, S13). Smashing's analysis: if `max <= 2.5 x min` the clamp passes in modern browsers; a 16-48px example failed between ~1050 and ~2100px viewports (S13). Roselli: never let the max fall below 2x base; keep root at 100% (S12). Test: zoom to 200%/500% at several widths and measure rendered size >= 2x.
- Playbook scale: body `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)` (max/min = 1.125); h1 max/min <= 2.5 (e.g. `clamp(2.25rem, 1.4rem + 3.2vw, 4.5rem)` fails the rule at 2x, so cap at 2.5x: `clamp(2rem, 1.2rem + 2.6vw, 5rem)`). Ratio 1.2 (minor third) at 320px and 1.25-1.333 at 1440px. Line-height: body 1.5-1.6, headings 1.05-1.2; measure 60-75ch; paragraph max 68ch.
- Fraunces is variable with axes opsz 9-144, wght 100-900, SOFT 0-100, WONK 0/1 (S14). WONK auto-substitutes above opsz 18 and is less suited to continuous reading; set `font-optical-sizing: auto` and `font-variation-settings: "SOFT" 50, "WONK" 0` for the kids store headings (friendly but not quirky), `SOFT 0, WONK 0` for the portfolio. Ship only needed axes via next/font subsetting; use `size-adjust` fallback to prevent CLS.
- Spacing rhythm: 4px base unit, 8px component rhythm; scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Fluid section padding `clamp(3rem, 2rem + 4vw, 8rem)`. Keep vertical rhythm on a 4px baseline grid for control heights (32/40/48).

---

## 3. Motion design system

- **Tokens** (derived from Material 3 and Next.js guidance): Material 3 durations short4 = 200ms, medium2 = 300ms, long2 = 500ms; standard easing `cubic-bezier(0.2, 0, 0, 1)`; emphasized-decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)`; M3 notes its newer "physics" system is replacing duration/easing tokens (S15). Next.js's official view-transition guide uses asymmetric timing: exit 150ms, enter 210ms (delayed by exit), spatial move 400ms, slide offset 60px (S16).
- Playbook: `--dur-instant 100ms` (hover, press), `--dur-fast 150ms` (tooltips, exit), `--dur-base 220ms` (menus, enter), `--dur-slow 320ms` (dialog, drawer), `--dur-page 400ms` (route/shared-element, max). Easing: enter = `cubic-bezier(0.05,0.7,0.1,1)`; exit = `cubic-bezier(0.3,0,0.8,0.15)`; move = `cubic-bezier(0.2,0,0,1)`. Exit shorter than enter (~0.7x). Anything > 500ms must be cinematic (hero intro, 3D), never UI feedback. Response limits: 0.1s feels instantaneous, 1s keeps flow, 10s needs progress and cancel (S17).
- **Animate only transform/opacity** (and filter sparingly); scroll-driven animations run off the main thread when using transform (S18).
- **prefers-reduced-motion = reduce, not necessarily remove** (S19): drop non-essential spatial motion (parallax, slides, 3D autorotation, scale zooms), keep opacity fades, focus feedback, loaders. Avoid blanket `animation: none` (breaks `animationend` logic); shorten to ~0-1ms or swap for fades (S19). For GSAP use `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` vs `reduce` branches; contexts auto-revert (S20). GSAP is now free including SplitText/ScrollTrigger (stated on its pricing page; license text not shown) (S21, **[C]** Webflow-owned).
- **View Transitions.** Same-document: Baseline Newly available 2025-10-14 (Chrome 111, Safari 18, Firefox 144); Firefox lacks transition *types* initially (S22, S23). Cross-document (`@view-transition { navigation: auto }`, same-origin, both pages opt in): Chrome 126, Safari 18.2, not Baseline; Firefox unverified (S24; versions from my own knowledge, MDN table not retrievable). Next.js: React's `<ViewTransition>` works in the App Router "with no configuration" with React 19.3 and Next 16.x docs updated 2026-10-15; triggers are Transitions, Suspense, `useDeferredValue` (not plain setState); `<Link transitionTypes>`; shared-element morph only forms if destination renders in same commit (prefetched) (S16). The older `experimental.viewTransition` flag page still says "not recommended for production" (S25). Always `::view-transition { pointer-events: none }`, anchor sticky header with its own `view-transition-name`, and add the reduced-motion block (S16).
- **Scroll-driven animations** (`animation-timeline: scroll()/view()`, `animation-range`): Baseline Newly available Oct 2026 with Firefox 159 (Chrome/Edge 115, Safari 26) (S26). Use `@supports (animation-timeline: scroll())` plus GSAP ScrollTrigger fallback only when the effect is essential; wrap in `no-preference`.

---

## 4. Loading, empty and error states

- Thresholds: show nothing under ~100ms; for 100ms-1s a subtle inline indicator (no full skeleton flash); >1s use skeleton matching final layout; >2-10s add progress/step text; >10s percent-done + cancel (S17, plus practitioner guides stating the 1s skeleton cutoff, secondary sources). Carbon says use skeletons rather than spinners for slow table loads (S27).
- Suspense reveal pattern: skeleton exit 150ms, content enter 210ms + 10px rise (S16). Reserve space (aspect-ratio, `min-height`) to keep CLS <= 0.05.
- Empty state = purpose + reason + next action (primary CTA), illustration optional; for kids store use brand illustration, for backoffice use a one-line explanation and a link to docs/import. Error state: say what failed, whether data is safe, retry button, per-section error boundaries (`error.tsx` at segment level) so one failing widget does not blank the page; offline and 404/500 pages on-brand. Include `aria-live="polite"` for async status; `role="alert"` only for blocking errors.
- Optimistic UI for toggles/saves with rollback toast; undo over confirmation for reversible destructive actions; confirmation dialog (type-to-confirm) for irreversible IAM actions.

---

## 5. Dashboard / backoffice design

Primary sources are thin; mostly design-system docs and practitioner posts (secondary).

- **Density**: Carbon data-table row heights XS 24, S 32, M 40 (default), L 48, XL 64px; header row and toolbar match row size (S27). Ship a density toggle (compact 32 / default 40 / comfortable 48) persisted per user (practitioner guides, secondary). Keep WCAG 2.5.8: compact rows are fine if the interactive target (checkbox, button) is >= 24x24 CSS px or spaced (S28).
- **Tables**: native `<table>` semantics (best a11y); left-align text, right-align numerics with tabular-nums (`font-variant-numeric: tabular-nums`); sticky header; three sort states and icon only on active column (S27); batch-action bar on selection disables row actions (S27); toolbar <= 5 actions, rest in overflow (S27); global filters outside the grid so they combine, column filters inline; saved views and URL-synced filter state (shareable links); virtualize above ~200 rows or paginate (25/50/100); empty-filter state offers "clear filters".
- **Charts**: lead with the question, not the chart type; direct-label series where possible; use a CVD-safe categorical palette of <= 6-8 hues generated in OKLCH at equal L (~0.65-0.7) with different hues and a non-colour redundant cue (marker shape, dash); UI/graphic contrast >= 3:1 against surface (WCAG 1.4.11); provide a data table or text summary alternative; respect reduced motion in chart entry animations. (Chart-specific primary sources were not retrieved; budget exhausted.)
- **IAM specifics**: show effective permissions with source (role/group), diff-before-apply, audit trail visible, two-person or type-to-confirm for destructive changes, never colour-only status (role badges include text/icon).
- Information hierarchy: KPI row (<= 4-6 tiles) -> trend -> table; avoid 50+ global filters (secondary source).
- Backoffices are **auth-gated** so EAA "services to consumers" scope likely does not apply, but WCAG 2.2 AA is still the right quality bar (and employer duties may apply). Dark mode is valuable here (long sessions, operators).

---

## 6. Accessibility: WCAG 2.2 AA, WCAG 3, EAA

**WCAG 2.2 new AA criteria** (W3C Rec 2023-10-05, 9 new SC, removes 4.1.1) (S29):

- **2.4.11 Focus Not Obscured (Minimum), AA**: focused component not *entirely* hidden by author content; sticky header/footer/cookie banner that fully covers focus fails (F110); fix with `scroll-padding-top/bottom` equal to sticky bar height (technique C43) or make the banner modal (S30).
- **2.5.7 Dragging Movements, AA**: any drag (sliders, sortable lists, kanban, 3D orbit controls with drag) needs a single-pointer alternative (buttons, arrow keys, click-to-place).
- **2.5.8 Target Size (Minimum), AA**: 24x24 CSS px, or spacing such that a 24px circle on each undersized target does not intersect another; exceptions: inline, equivalent control, user-agent, essential (S28). AAA 2.5.5 = 44x44 (S28). Platform guidance: Apple 44pt, Material 48dp (secondary sources). **Playbook: 44px for primary touch targets on the kids store (parents on phones), >= 32px desktop backoffice controls, hard floor 24px.**
- Also new: 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A), 3.3.8 Accessible Authentication (Minimum) (AA; do not block password managers/paste; matters for IAM login; WebAuthn/passkeys preferred), 2.4.13 Focus Appearance (AAA, but adopt: 2px outline, >= 3:1, offset 2px).
- Why this matters: WebAIM Million (Feb 2026): 95.9% of home pages have detectable WCAG failures, 83.9% low-contrast text, avg 56.1 errors/page (S31). Cheap wins: contrast, alt, labels, empty links/buttons.

**WCAG 3**: W3C Working Draft dated 2026-09-10; "still has several years of work", details will change; contrast algorithm TBD; outcome-based, "additional tests and different scoring" (S9, S8). Bronze/Silver/Gold replacing A/AA/AAA per secondary sources (not confirmed in the excerpt I could read). Practitioner estimates: not before ~2028-2030 (secondary; S8 author says ~2030 earliest). **Action: target WCAG 2.2 AA now; do not build to WCAG 3.**

**EAA (Directive 2019/882)**: applies from 2025-06-28; e-commerce services are in scope; Commission lists e-commerce and Your Europe says online stores must be accessible (S32, S33). Microenterprise (services) exemption: < 10 staff and (per Your Europe) < EUR 2M turnover; covers services, not products; anyone can claim disproportionate burden with documented assessment reviewed every 5 years (S33). Harmonised standard EN 301 549 v3.2.1 incorporates WCAG 2.1 AA (vendor sources); a WCAG 2.2-based revision (v4.1.1) is expected/rumoured in 2026 (unverified, vendor sources). Enforcement is national (e.g. Dutch ACM active per vendor source). **Relevance**: pequeverso.com sells to consumers in Spanish-speaking markets; if it sells to EU consumers (Spain, etc.) it is likely in scope unless it qualifies as a microenterprise; the portfolio is not a sale of services at scale (likely out of scope, but meet AA anyway). Get legal confirmation; publish an accessibility statement and feedback channel (EAA expects one).

**Testing**: automated (axe-core) finds ~57% of issues by volume per Deque's 2021 vendor study of 13k pages (S34, **[C]**); remainder needs manual. Workflow: axe in Playwright for every route x theme x viewport (0 serious/critical gate), keyboard pass (Tab order, visible focus, no traps, Esc closes, skip link, roving tabindex), screen reader pass: NVDA+Firefox/Chrome and VoiceOver+Safari (iOS VoiceOver is dominant on mobile; WebAIM #10: NVDA 65.6%, JAWS 60.5% common use; survey #11 reports JAWS 69.2% / NVDA 59.3%, ambiguous ordering) (S35). Zoom 200% and 400% reflow at 320px (1.4.10), text spacing override (1.4.12), forced-colors check. Base UI handles ARIA, keyboard and focus, but visible focus, contrast and names for custom controls remain yours (S10).

---

## 7. Responsive 320-1920 and container queries

- Container size queries are Baseline Widely Available since 2025-08-14; container style queries newly available (May 2026 digest) (S36). Use `@container` for cards, product tiles, table toolbars, dashboard widgets; media queries only for page-level layout shell. Tailwind 4 has `@sm:` container variants (`--container-*`) (S4).
- Breakpoints (content-driven, not device): 320 (min supported, no horizontal scroll at 320 per 1.4.10 reflow), 480, 768, 1024, 1280, 1536; max content width 1200-1280 (marketing), 1440+ fluid for backoffice; at 1920 constrain line length, scale gutters (`clamp(1rem, 4vw, 3rem)`), and avoid stretching 3D canvas beyond DPR cap.
- Use `dvh`/`svh` for hero heights (mobile browser chrome), `min-height` not `height`, `aspect-ratio` for media, `env(safe-area-inset-*)`. Test matrix: 320x568, 375x667, 390x844, 768x1024, 1024x768, 1280x720, 1440x900, 1920x1080, plus 200% zoom.

---

## 8. Dark mode for a kids-product store: is it advisable?

Evidence summary:

- NN/g's literature review: for normal-vision users light mode performs better most of the time; advantage grows as text shrinks; dark mode helps some low-vision users (cataract-type cloudy media); recommends **not defaulting to dark** but letting users opt in, especially for long-form reading (S37). Evidence is dated (2013-2018, small samples, CRT confounds) (S37).
- 2025 systematic review (25 papers): light better for readability/bright environments, dark better for comfort in low light (secondary, journal listing). Preference for dark may reflect aesthetics more than productivity (secondary).
- **No evidence found** that dark mode changes e-commerce conversion (the search returned nothing; absence of evidence, not evidence of absence).
- Kids-brand context: audience is parents buying (and children browsing); NN/g's children guidelines are from 2002 and "similar to standard adult practice" (secondary reviews); Smashing: parents look for safe, reputable, supported sites (secondary). Nothing found that favours dark for children.

**Recommendation.** Keeping light-only for pequeverso.com is defensible *now* (ADR stands): the brand relies on warm colour, illustrations and product photography whose colour accuracy matters for conversion (kit contents), and dark adds a full QA matrix and photo-treatment risk. But a **"no-regret" path**: (1) build semantic tokens in `light-dark()`-ready form; (2) declare `color-scheme: light` explicitly; (3) ship a restrained night theme later only if analytics show a material share of evening mobile sessions and `prefers-color-scheme: dark` users (measure it first: log the media query); (4) never auto-switch product photography or illustration; use a warm, low-chroma dark (L 0.2, not black), keep product imagery on light "cards". Revisit after EAA/AA audit. For the portfolio and backoffices, dark/light with system default is expected and low risk.

---

## 9. Awwwards-level polish vs performance

- Awwwards winners are not representative; evidence of accessibility gaps in nominees is thin (Greenspector found a11y errors in the 10 mobile-excellence nominees it analysed; Zurb says award sites often lag on a11y) (S38, secondary). Awwwards' own scoring weights usability (~30%, per a secondary blog; unverified). Polish budget should be spent on: typographic craft (Fraunces optical sizing), consistent spacing, micro-interactions (100-220ms), one signature moment (the 3D hero / a hero reveal), and flawless states.
- **Hard budgets** (Core Web Vitals, p75 field; unchanged in 2026): LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 (S39, S40). Playbook (stricter lab targets): LCP <= 2.0s on mobile 4G, INP <= 150ms, CLS <= 0.05, TBT <= 200ms, Lighthouse perf >= 90 mobile on content pages, >= 80 on the 3D hero page with static fallback.
- Page weight: JS <= 170 KB gz first-load on public routes (excluding lazy 3D/GSAP chunks), CSS <= 40 KB gz, fonts <= 100 KB total (subset, 2 families, variable), hero image <= 150 KB AVIF; 3D chunk <= 500 KB gz lazy loaded after LCP via `IntersectionObserver`/`requestIdleCallback`.
- GSAP tree-shake: import only used plugins; register once; kill via `gsap.matchMedia`/`context.revert()` on route unmount.

---

## 10. 3D/WebGL performance budgets on mobile

Sources are community (no official Three.js budget): draw calls <= ~100-200 mobile (< 500 desktop), triangles < 500K mobile (< 1-2M desktop), a single 4096^2 RGBA texture = 64 MB GPU memory (before mips +33%), use KTX2/Basis (ETC2/ASTC) compression, InstancedMesh/merged geometry, cap DPR, disable MSAA on mobile, render on demand (`frameloop="demand"`), dispose geometry/material/textures, monitor `renderer.info` for leaks (S41, secondary). WebGPU is still "limited availability", not Baseline (S42); keep WebGL2 as the production path, feature-detect WebGPU only as an enhancement.

Playbook: mobile hero: <= 100 draw calls, <= 150K tris, textures <= 2048 (total GPU <= 64 MB), DPR cap 1.5 (mobile) / 2 (desktop), antialias off on mobile (use FXAA/SMAA post or DPR), no realtime shadows (bake), <= 1 light + env map (<= 256 KB), target 60fps and degrade at <45fps average over 2s (drop DPR to 1, then swap to static poster). Pause rendering offscreen (IntersectionObserver), on `visibilitychange`, and under `prefers-reduced-motion` (render one still frame or poster image). Respect `Save-Data` and low `deviceMemory`/`hardwareConcurrency <= 4`: serve poster. Provide a text/semantic alternative; `aria-hidden` canvas with meaningful heading content outside; no drag-only control (2.5.7). Ensure the 3D never delays LCP: poster image is the LCP element.

---

## 11. Design QA workflow

- **Visual regression**: Playwright `toHaveScreenshot()` for page-level (baselines in git, per-browser/platform names, run in the same environment such as the CI Docker image, defaults `threshold` 0.2, tune `maxDiffPixels`/ratio, mask volatile regions, park the mouse at (-1,-1) to avoid hover noise, `stylePath` to freeze animations) (S43). Chromatic/Percy are SaaS with review dashboards **[C]**; Chromatic fits Storybook, Percy is BrowserStack-owned **[C]**; Argos blog ranking itself first **[C]** (S44, secondary). Recommendation: Playwright-native in CI (free, in repo) for 4 sites; add Storybook + Chromatic only if a component library is shared across sites.
- Matrix per page: theme (light/dark where supported) x viewport (375, 768, 1440) x state (default, loading skeleton, empty, error, focus-visible) x `prefers-reduced-motion`. Wait for `document.fonts.ready`; disable GSAP via a `?qa=1` flag (`gsap.globalTimeline.timeScale(1000)`/pause).
- **Rubric (score /100; gate at 95)**: Visual hierarchy and typography 15; Consistency/token adherence (zero hard-coded colours/px outside tokens, lint) 15; Interaction and motion quality 10; States coverage (loading/empty/error/offline) 10; Accessibility (axe 0 serious, keyboard, SR, contrast, 2.2 AA) 20; Responsive 320-1920 and zoom 10; Performance (CWV, 3D budget) 10; Content/microcopy and i18n (ES/EN, long strings +30%) 5; Craft/delight 5. Any a11y blocker caps total at 89.
- CI gates: Lighthouse CI (perf, a11y >= 95), axe-playwright, Stylelint/ESLint rule against raw hex/oklch outside token files, bundle-size check, `web-vitals` RUM with `onINP`, report p75 by route (S45).
- Design review cadence: token PR review, weekly design QA with annotated screenshots, "five-state" checklist per component, real-device pass (low-end Android, iPhone SE class) before launch.

---

## Design playbook with target values

| Area | Target |
|---|---|
| Token tiers | primitive -> semantic -> component (only when needed); DTCG 2025.10 JSON with oklch `colorSpace` + `hex` fallback |
| Theme switch | `color-scheme` + `light-dark()`, cookie-persisted, system option; pequeverso: `color-scheme: light` fixed (ADR) |
| Text contrast | WCAG 2 >= 4.5:1 body, 3:1 large/UI; aim 7:1 body in kids store; APCA advisory Lc >= 60 body (advisory only) |
| Focus | 2px ring, >= 3:1 vs adjacent, offset 2px, never fully obscured; `scroll-padding` = sticky height |
| Target size | floor 24px (AA); touch 44px; desktop admin >= 32px; spacing >= 8px between small controls |
| Type | root 100%; body 16-18px; fluid clamp with max/min <= 2.5; measure 60-75ch; tabular-nums in tables |
| Spacing | 4px unit; 8px rhythm; section padding clamp(48px, .., 128px) |
| Durations | 100 / 150 / 220 / 320 / 400ms (page max); cinematic only for hero; exit ~0.7x enter |
| Easing | enter cubic-bezier(.05,.7,.1,1); standard (.2,0,0,1); exit (.3,0,.8,.15) |
| Animated props | transform, opacity only; scroll-driven via CSS where supported, GSAP fallback |
| Reduced motion | remove parallax/slide/3D spin/autoplay; keep fades, focus, loaders; `gsap.matchMedia` |
| View transitions | React `<ViewTransition>` in App Router; shared element + Suspense reveal; `pointer-events:none`; reduced-motion block |
| Loading | <100ms none; 100ms-1s inline hint; >1s skeleton; >10s progress + cancel |
| States | 5-state checklist: default, loading, empty, error, success/partial |
| Tables | row 32/40/48px density toggle; sticky header; saved views; filters in URL; page size 25/50/100 |
| Charts | <= 8 CVD-safe series, non-colour cue, 3:1 graphics contrast, data-table alternative |
| Layout | 320 no h-scroll; container queries for components; breakpoints 480/768/1024/1280/1536 |
| CWV (field p75) | LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 (lab goals 2.0s / 150ms / 0.05) |
| Weights | JS first-load <= 170 KB gz; fonts <= 100 KB; hero img <= 150 KB; 3D chunk <= 500 KB gz lazy |
| 3D mobile | <= 100 draw calls, <= 150K tris, <= 64 MB textures (KTX2), DPR <= 1.5, no MSAA, demand render, poster fallback |
| a11y testing | axe 0 serious/critical per route x theme; keyboard + NVDA + VoiceOver passes; 200%/400% zoom |
| Visual QA | Playwright screenshots per theme x 3 viewports x states; 95/100 rubric gate |

---

## Contested / uncertain

1. **APCA status**: sources conflict; primary (WCAG 3 draft + Roselli, S8/S9) says the contrast algorithm is TBD and APCA absent from the draft. APCA Lc numbers in this report are advisory and not verified at W3C.
2. **WCAG 3 Bronze/Silver/Gold and timeline**: tiers only confirmed via secondary blogs; one blog claimed "Expected completion Q2 2026" and another claimed WCAG 2.2 became a Recommendation in April 2026 (wrong; it was 2023-10-05). Timeline 2028-2030 is estimate.
3. **Cross-document view transitions**: Chrome 126 / Safari 18.2 from my own knowledge, MDN table not retrievable; Firefox status unverified. Next.js `experimental.viewTransition` page says "not recommended for production" while the 2026-10 guide says "no configuration" with React 19.3 (verify the React version you ship).
4. **EN 301 549 update**: v3.2.1 (WCAG 2.1) vs v4.1.1 (WCAG 2.2) status contradictory across vendor sources; EAA microenterprise turnover threshold (EUR 2M) appears on Your Europe but not in the Commission Q&A; confirm with national transposition (Spain: Ley 11/2023) and counsel.
5. **Dark mode and conversion**: no evidence either way; NN/g review is 2020 and built on small old studies. The "no dark for kids store" call is judgement, not data.
6. **Screen reader market shares**: WebAIM surveys alternate JAWS/NVDA lead; figures vary by survey version.
7. **3D budgets**: all community numbers, no official Three.js standard; profile on real low-end devices. WebGPU support level (MDN: limited availability) stated generally.
8. **Skeleton vs spinner 1s cutoff and "bounce 2-3x" claims**: secondary and in one case unverifiable; I did not use the bounce claim.
9. **Scroll-driven animations Baseline Oct 2026 (Firefox 159)**: from web.dev roundup only; older June-2026 sources said still flagged; re-verify before removing fallbacks.
10. **Chart and token-architecture primary sources** were not retrieved after the search quota ran out; those sections rely on design-system conventions and my own synthesis.
11. **Deque 57% figure** is a vendor study (2021) and measures issue volume, not criteria coverage.
12. Numeric targets in the playbook table (durations, DPR, budgets, JS weight) are recommendations synthesised from the sources, not quotes from them.

---

## Sources

S1 W3C DTCG: first stable version announcement - https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
S2 Design Tokens TR 2025.10 - https://www.designtokens.org/tr/2025.10/ and FAQ https://www.designtokens.org/faq/
S3 DTCG Color module 2025.10 - https://www.designtokens.org/tr/2025.10/color/
S4 Tailwind CSS v4 theme docs - https://tailwindcss.com/docs/theme
S5 Evil Martians, OKLCH in CSS **[C]** (agency) - https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
S6 web.dev, light-dark() - https://web.dev/articles/light-dark
S7 MDN light-dark() - https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
S8 Adrian Roselli, WCAG3 contrast as of April 2026 - https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html
S9 W3C WCAG 3.0 Working Draft (2026-09-10) - https://www.w3.org/TR/wcag-3.0/
S10 Base UI accessibility - https://base-ui.com/react/overview/accessibility
S11 Utopia, clamp - https://utopia.fyi/blog/clamp/
S12 Roselli, Responsive type and zoom - https://adrianroselli.com/2019/12/responsive-type-and-zoom.html
S13 Smashing, accessibility of fluid type - https://www.smashingmagazine.com/2023/11/addressing-accessibility-concerns-fluid-type/
S14 Fraunces (Undercase Type) - https://github.com/undercasetype/Fraunces
S15 Material 3 easing and duration (search result summary; page body not retrievable) - https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
S16 Next.js, Designing view transitions (updated 2026-10-15) - https://nextjs.org/docs/app/guides/view-transitions
S17 NN/g, Response times: 3 important limits - https://www.nngroup.com/articles/response-times-3-important-limits/
S18 Chrome for Developers, scroll-driven animations - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
S19 web.dev, prefers-reduced-motion - https://web.dev/articles/prefers-reduced-motion
S20 GSAP matchMedia docs **[C]** (Webflow) - https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
S21 GSAP pricing page **[C]** - https://gsap.com/pricing/
S22 web.dev, same-document view transitions Baseline - https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
S23 Chrome for Developers, view transitions in 2025 - https://developer.chrome.com/blog/view-transitions-in-2025
S24 MDN @view-transition - https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition
S25 Next.js viewTransition config (experimental) - https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
S26 web.dev, New to the web platform in October (2026) - https://web.dev/blog/web-platform-10-2026
S27 Carbon Design System, data table usage - https://carbondesignsystem.com/components/data-table/usage/
S28 W3C Understanding 2.5.8 Target Size (Minimum) - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
S29 Deque University / BOIA / TetraLogical WCAG 2.2 overviews (search) - https://dequeuniversity.com/resources/wcag-2.2 , https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2
S30 W3C Understanding 2.4.11 Focus Not Obscured (Minimum) - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
S31 WebAIM Million 2026 - https://webaim.org/projects/million/
S32 EUR-Lex Directive 2019/882 - https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng
S33 Your Europe, services/goods digital accessibility - https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm
S34 Deque, automated testing finds 57% **[C]** (vendor) - https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues
S35 WebAIM Screen Reader User Surveys #10/#11 - https://webaim.org/projects/screenreadersurvey10/ , https://webaim.org/projects/screenreadersurvey11/
S36 Web Platform DX: container queries; web.dev Baseline digest Aug 2025 - https://web-platform-dx.github.io/web-features-explorer/features/container-queries , https://web.dev/blog/baseline-digest-aug-2025
S37 NN/g, Dark mode vs light mode - https://www.nngroup.com/articles/dark-mode/
S38 Greenspector analysis of Awwwards mobile nominees **[C]** (green-IT consultancy); Zurb Radar **[C]** - https://blog.greenspector.com/en/analysis_sites_nominated_mobile_excellence_awwwards/ , https://radar.zurb.com/article/your-award-winning-site-might-be-locking-people-out
S39 web.dev, INP - https://web.dev/articles/inp
S40 Core Web Vitals thresholds 2026 (secondary roundups, unchanged values) - https://blog.mean.ceo/core-web-vitals-news-november-2026/ , https://rgb.ir/en/blog/core-web-vitals-thresholds-2026/
S41 Three.js community performance guidance **[C]** (agency/skill-registry blogs) - https://discourse.threejs.org/t/problems-with-performance-on-mobile-devices/23734 , https://metadesignsolutions.com/blog/threejs-performance-optimization-best-practices
S42 MDN WebGPU API - https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
S43 Playwright visual comparisons - https://playwright.dev/docs/test-snapshots
S44 Visual-regression tool roundups **[C]** (vendor blogs: Argos, others) - https://argos-ci.com/blog/best-visual-regression-testing-tools , https://bugbug.io/blog/software-testing/playwright-visual-regression-testing/
S45 shadcn/ui changelog (Base UI as default, Jul 2026; CLI v4, presets) - https://ui.shadcn.com/docs/changelog
S46 NN/g / Smashing children's web design (secondary) - https://www.smashingmagazine.com/2011/07/best-practices-for-designing-websites-for-kids/
