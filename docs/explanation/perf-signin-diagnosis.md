# Sign-in mobile TBT diagnosis (M2.12, A-P1-3)

Status: diagnosis only. No fix is applied. Date: 2026-11-14. Branch `docs/m2-signin-tbt-diagnosis`
(from `develop`).

## Reference baseline and validity of the local numbers

The reference is the audit measurement in
[`audit/lighthouse-summary.json`](../master-plan/audit/lighthouse-summary.json) (`signin_mobile`):
performance 0.78, **TBT 1,025 ms**, LCP 1,559 ms, CLS 0, with no chart on the page.

**Local absolute numbers in this note are invalid.** The measurement host was a WSL2 laptop
shared with many other agents (load average 43 to 92 during the runs, Lighthouse
`benchmarkIndex` 12 to 96). Lighthouse mobile uses simulated (Lantern) throttling, which scales
the main-thread task durations observed on the host by 4x; on a saturated host the observed
durations are already inflated, so TBT came out at 18,341 to 62,221 ms. Do not compare those
values with the baseline. The diagnosis therefore rests on **attribution** (share of main-thread
time per chunk and task type), which is stable across runs. Clean absolute numbers will come
from M2.8 (Lighthouse CI, median of 5 on GitHub-hosted runners).

## Method

- Worktree at `develop`, Node 24.22.0, `npm ci`, `npm run build` (`next build --webpack`,
  Next.js 16.4.4). Production stack via `node scripts/backoffice-stack.ts` (`next start` on port
  3241, mock ops on 8237, fake IdP on 8238, disposable PostgreSQL 18.6 on 55613), wrapped in
  `flock /tmp/pvb-browser.lock`. The sign-in route is `/ingresar`.
- Lighthouse 13.6.0, not a project dependency, mobile preset defaults (simulated throttling,
  4x CPU, slow 4G), performance category only:

  ```bash
  CHROME_PATH=~/.cache/ms-playwright/chromium-1252/chrome-linux64/chrome \
  npx --yes lighthouse@13.6.0 http://localhost:3241/ingresar --only-categories=performance \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=runN.json --quiet
  ```

  Ten launches, run sequentially; 7 produced a result (3 failed with Chrome launch or runtime
  errors under load) and are used below.
- Function-level CPU profile: Playwright 1.64.1 Chromium (Pixel 5 emulation), CDP
  `Profiler` at 200 us sampling, Slow 4G network, `Emulation.setCPUThrottlingRate` 4 (two
  runs) and 1 (two runs), 6 s after `load`, plus a `PerformanceObserver` for long tasks.
  4 of 6 profile runs completed (2 timed out on `goto` under load). Profiles were scripts kept
  outside the repository; they are not committed.
- Compact result summary: [`audit/signin-tbt-summary.json`](../master-plan/audit/signin-tbt-summary.json).
  Raw Lighthouse JSON and profiles are kept out of git.

## Lighthouse mobile, 7 valid runs (invalid in absolute terms, see above)

| Run | Load avg | Perf | TBT (ms) | LCP (ms) | CLS |
|---|---|---|---|---|---|
| 1 | 43 | 0.60 | 29,260 | 1,210 | 0 |
| 2 | 63 | 0.57 | 24,088 | 2,362 | 0 |
| 3 | 68 | 0.67 | 18,341 | 1,217 | 0 |
| 4 | 59 | 0.58 | 22,325 | 1,941 | 0 |
| 5 | 65 | 0.62 | 20,289 | 1,293 | 0 |
| 9 | 92 | 0.37 | 62,221 | 6,248 | 0 |
| 10 | 76 | 0.60 | 42,634 | 965 | 0 |
| **Median** | | **0.60** | **24,088** | **1,293** | **0** |
| Spread (min to max) | | 0.37 to 0.67 | 18,341 to 62,221 | 965 to 6,248 | 0 |

The spread is more than 3x, which confirms that the host load dominates the absolute values.
CLS is 0 in every run (this metric is load independent and agrees with the audit).

## Where the main-thread time goes

Share of Lighthouse `bootup-time` (script evaluation plus parse, summed over the 7 runs) and of
`long-tasks` duration per owner. Chunk names drop the content hash.

| Owner | What it is | Bootup share | Long-task share | Size (raw / gzip) |
|---|---|---|---|---|
| `chunks/794.js` | Next.js client runtime: App Router, router reducer, RSC flight client, error and segment machinery, legacy polyfill module | 48.8% | 46.7% (58 tasks) | 242 KB / 67 KB |
| Unattributable | Native work without a script owner (compile, GC, style, layout) | 23.4% | 27.4% | n/a |
| `/ingresar` document | Inline scripts: `self.__next_f.push` RSC flight data and bootstrap | 16.0% | 13.5% | n/a |
| `chunks/4bd1b696.js` | `react-dom` (hydration) | 7.3% | 6.9% | 204 KB / 64 KB |
| `chunks/87.js` | Better Auth client (page-specific, `authClient`) | 1.5% | 2.6% | 30 KB / 11 KB |
| `chunks/687.js` | `lucide-react` icon runtime (page-specific, `LogIn`) | 0.9% | below 1% | 32 KB / 10 KB |
| `chunks/webpack.js` | Webpack runtime | 0.7% | below 1% | 3 KB / 2 KB |
| `app/ingresar/page.js` | The route's own code | 0.7% | 1.1% | 4 KB / 2 KB |

CPU profile (self time, excluding idle, mean of the 4 profiled runs): native `(program)` 34 to
42% (parse, compile, style, layout), `react-dom` 9 to 24%, `794` runtime 11 to 22%, webpack module
execution (`__webpack_require__`, which absorbs lazy compile of each module) 8 to 19%, `687`
2 to 9%, `87` 1 to 5%. Long tasks (over 50 ms) per run: 20 to 28; the largest single task per run
was 2.2 to 5.7 s at 4x throttling, always a script evaluation burst of chunk `794` during
startup (`window.next` router initialisation and flight payload processing). Top functions in `794`:
the flight-data decoder (`ey` and the chunk reader), the `useInsertionEffect` committed-tree
update in the router and the `trimStart` legacy polyfill module.

### Causes checked

| Suspect | Finding |
|---|---|
| Hydration | **Yes, dominant.** `794`, `react-dom`, webpack module execution and the inline flight payload together are about 80% of script time. This is framework hydration of a route that is otherwise static. |
| Framework chunk | **Yes.** `794` alone is about half of bootup and of long-task time; it is the Next.js router and flight runtime, not application code. |
| Application code | No. The route chunk is 4 KB and under 1% of bootup. The only page-specific payloads are the Better Auth client (`87`) and `lucide-react` (`687`), about 2.4% of bootup together. |
| Fonts | No. No font task or layout shift appears (CLS 0, no `font` long task in the traces). |
| Proxy | No main-thread cost: the proxy runs on the server, so it affects TTFB only (not part of TBT). |
| Third party | None. The sign-in page loads only same-origin assets (total 255 KB). |
| Charts | Not present on this route, as expected. |

## Conclusion

The sign-in TBT is framework hydration cost, concentrated in the Next.js client runtime and
`react-dom`, not in application code, fonts, proxy or third parties. The page hydrates a
"use client" island (`SignInPanel`) whose only purpose is a button that starts an OAuth
redirect, and that island forces the whole client runtime plus `authClient` and `lucide-react`
onto an otherwise static route. M3.2 (dynamic charts and Suspense for the dashboard panels) cannot
fix this because the route has no charts. This is the case anticipated by M5.7 ("a cause outside
charts is fixed under the item named in the diagnosis note").

## Fix item (exactly one)

**M5.2-SIGNIN: static sign-in without a client island.** Under M5.2 (shell), render `/ingresar`
as a server component whose provider buttons are plain `<form method="post">` submissions to a
server action or route handler that starts the Better Auth social sign-in and redirects (no
`authClient`, no `lucide-react` on this route, inline SVG icon, buttons enabled without waiting
for hydration), and ship the route with the smallest possible client footprint. Keep the
admission rules in `src/features/auth/application/access.ts` and the server-side checks
unchanged; this is a presentation and transport change only.

- Target: sign-in mobile **TBT at or below 600 ms** (median of 5, M2.8 Lighthouse CI on GitHub
  runners), performance at or above 0.90, CLS 0.
- Validation rule: the target is conditional. The page-specific JS (`87`, `687`, route chunk)
  is only about 3% of bootup, so removing it alone will not reach the target; the saving comes
  from removing the client component boundary so that the route stops paying for the router and
  hydration of an interactive tree. If the M2.8 median after the change is still above 600 ms,
  the remaining cost is the Next.js floor for any App Router page and the target is re-set from a
  measured floor (a blank App Router page measured with the same M2.8 harness), not guessed.
- Before the change, M2.8 must record the clean baseline for `/ingresar` so the delta is real.

## Reproduce

Run the Method commands above on a quiet host (or rely on M2.8). Compare the per-chunk shares in
`audit/signin-tbt-summary.json`; they should stay within a few points even when absolute TBT
moves.
