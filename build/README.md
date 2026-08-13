# Build folder

The deliverable is `../FDIC_Peer_Dashboard.html` — a single self-contained file.
This folder holds the sources it is assembled from.

## Rebuilding

```
python build/build.py
```

Run from the project root. It concatenates `parts/` in order, injects the metric
catalogue, checks that no external resources crept into the markup, and writes
`FDIC_Peer_Dashboard.html`.

**Never edit `FDIC_Peer_Dashboard.html` directly** — the next build overwrites it.

## Sources

| File | Contains |
|---|---|
| `parts/01_head.html` | Design tokens, all CSS, light/dark themes, print and responsive rules |
| `parts/02_body.html` | Page markup: app bar, left rail, toolbar, containers |
| `parts/03_core.js` | Metric definitions, state, API layer, transforms, statistics |
| `parts/04_charts.js` | SVG chart primitives and the six chart types |
| `parts/05_views.js` | The five views, stat tiles, comparison table, CSV/JSON export |
| `parts/06_ui.js` | Rail interactions, saved setups, keyboard, boot sequence |
| `metric_catalog.json` | The 138 trust/fiduciary metrics from the Call Report export |

Each part is wrapped in its own `<script>` tag. Top-level `const` and `function`
declarations are shared across them through the global scope, so ordering matters —
`03_core` must load before anything that calls it.

## Where the metric list came from

The FDIC "Select a Standard Peer Grouping" export pairs every row label with its
Call Report field code (`TFRA`, `NFAA`, `IFIDUC`, …) — the same codes the API
uses. All 153 codes in that export were tested against
`api.fdic.gov/banks/financials`; **138 return data**.

The 15 that do not are the December-only "Gross Losses" and "Recoveries" memo
lines, which the API does not expose:

```
TTOTMAGL  TTOTNMGL  TTOTREC  TPTREC   TRTREC
TIMREC    TOFREC    TPNMGL   TRTNMGL  TIMNMGL
TOFNMAGL  TPMAGL    TRTMAGL  TIMMAGL  TOFMAGL
```

Every one is `$0` for all ten banks in that export, so nothing meaningful is
lost. If the FDIC exposes them later, append them to `metric_catalog.json` and
rebuild.

The 45 core performance metrics (`CORE_METRICS` in `03_core.js`) were validated
the same way — all 45 return data. Add to that array to expose more.

## API notes worth keeping

- Base URL is `https://api.fdic.gov/banks`. The older `banks.data.fdic.gov/api`
  host still works but 301-redirects here.
- **An API key is optional.** Anonymous access is allowed roughly 120
  requests/minute; a free key from api.data.gov raises the ceiling. A full build
  uses three to five requests.
- The API sends `Access-Control-Allow-Origin: *` and allows the `X-Api-Key`
  header on preflight, which is why the dashboard can call it straight from a
  local file with no server in between.
- **Requesting a field name that does not exist is not an error** — the field is
  silently dropped from the response. That is how the 15 invalid codes above were
  identified, and it is why any new metric must be checked against a live
  response rather than assumed.
- `NOT TRUST:00` correctly selects banks holding trust powers (verified: for
  Iowa, 24 + 202 = 226 active institutions).

## Peer groups and the default institution

Everything deployment-specific now lives in one **CONFIGURATION** block at the
top of `parts/03_core.js`:

- `DEFAULT_INSTITUTION` — the bank the dashboard opens on, and whose newest
  filing sets the default reporting period. Cert **16265** (Peoples Bank, Rock
  Valley, with its Sioux Center location).
- `PEER_GROUPS` — the one-click group buttons.

Nothing else in the codebase hardcodes a cert number. Retargeting the file at a
different bank means changing `DEFAULT_INSTITUTION` and the group `certs`
arrays, and nothing else.

**Editing the file is not the normal way to change peers.** In the app, a group
is assembled under Peer group → Criteria or → By name and saved with **Save
current group**; saved groups persist in `localStorage` under `fdic.groups` and
render beside the built-in ones with a delete control. `allPeerGroups()` merges
the two sources. The configuration block only sets what a fresh browser starts
with.

Identifiers are FDIC **certificate** numbers, not RSSD numbers.

## Metrics where lower is better

`LOWER_IS_BETTER` in `03_core.js` lists the ratios where exceeding the benchmark
is a worse result, so the up/down colouring is not misleading: efficiency ratio,
noninterest expense to assets, interest expense to earning assets, net
charge-offs to loans, noncurrent assets plus OREO to assets, and noncurrent loans
to loans. Dollar amounts are deliberately left neutral — a bigger number there
usually just means a bigger bank.

## Year-to-date items

Income and expense figures are filed year-to-date: Q1 holds three months, Q4
holds twelve, and the count restarts every January. Plotted across quarters they
step down each Q1, which reads as a collapse in earnings when it is only the
reset.

`isYtdFlow()` in `03_core.js` marks these — everything in the Earnings, Fiduciary
Income and Losses & Recoveries categories, plus `NTLNLS`. Where one is charted
across a window that mixes quarters, the caption says so. Selecting
quarter-over-quarter change while any such metric is in the set raises a banner,
because that comparison puts a Q1 stub against a full prior year and is never
meaningful. Year-over-year is unaffected — it compares Q4 with Q4.

Balance-sheet items are point-in-time and carry across quarters cleanly, so they
are deliberately excluded from the warning.

## Report periods

`initPeriods()` asks the FDIC for the newest `REPDTE` that `DEFAULT_INSTITUTION`
has filed and builds 80 quarters back from it, so the list follows publication
without anyone editing a date. As of the last check the newest published quarter
FDIC-wide is **31 March 2026** (4,352 institutions filed; 4,411 filed at
31 December 2025).

`periodList(scope)` decides what the dropdown offers:

| Scope | Contents |
|---|---|
| `recent` (default) | Every quarter of the last two years, then year-ends for sixteen more |
| `all` | 40 consecutive quarters |
| `dec` | 20 year-ends |

The default *selection* is deliberately not the newest period. `latestYearEnd()`
picks the most recent December, because Q4 is the like-for-like period — income
items cover a full twelve months and every bank has closed its year. A newer
interim quarter is one click above it and is labelled `· interim`.

Two guards apply when an interim quarter is selected:

- **Partial year banner.** Income and expense figures at 31 March cover three
  months. The peer comparison is still valid — every bank is on the same basis —
  but the figure is not comparable with a year-end one, and the banner says which
  of the two is true.
- **Late-filer banner.** Call Reports arrive over several weeks, so a
  just-published quarter is often incomplete. Any bank in the group with no
  filing at the selected date is named, along with how many banks the peer
  statistics were actually computed from. This is distinct from the existing
  "no longer filing" banner, which is about merged or closed institutions.

Loading a shared setup whose period is outside the current scope widens the scope
to `all` rather than silently snapping to a different quarter.

## Schedule RC-T is an annual filing

The whole trust and fiduciary catalogue comes from Call Report **Schedule RC-T**,
which banks under the FDIC's quarterly threshold file **once a year, every
December**. For the quarters in between the API returns a hard **0**, not an
empty field. Untreated, that is worse than a gap: Peoples Bank reports $768.5M of
fiduciary assets at 31 December 2025 and `0` at 31 March 2026, which renders as
`$0` and drags the peer median to zero.

`rctBlank()` in `03_core.js` decides when a zero is that artefact. A zero is read
as *not filed* when all three hold:

1. the field belongs to an RC-T category (`RCT_CATS`),
2. the period is not a December, and
3. the same bank filed a **non-zero** figure at the most recent year-end inside
   the fetched window.

Condition 3 is what keeps it honest. A bank with no trust business files zero in
December too, so its zeros are genuine and are left alone; a bank large enough to
file quarterly has real interim figures, so the rule never fires on it. Measured
on the Northwest Iowa group at 31 March 2026: of nine banks, two file quarterly
(kept), three have no trust business (kept as zero), four are annual filers
(blanked). Year-end figures are untouched — verified identical before and after.

A banner names how many of the selected metrics are RC-T and how many of them
this group did not file at the selected date, and says to use a year-end period.
`pickPrimary()` also refuses a focus metric the focus bank did not report, so
changing to an interim quarter cannot leave the headline charts empty.

## Withdrawn fields

`NALTOT` ("total noncurrent loans and leases") was withdrawn by the FDIC after
**30 June 2023** and returns null at every period since. It shipped in the
Credit & capital starting set, where it rendered as a row of dashes. It is
replaced by the two components still filed:

| Field | Meaning |
|---|---|
| `NAASSET` | Assets in nonaccrual status |
| `P9ASSET` | Assets past due 90+ days and still accruing |

Their sum is noncurrent assets. Checked across the group at 31 December 2025:
`(NAASSET + P9ASSET) / LNLSGR` reproduces `NCLNLSR` and
`(NAASSET + P9ASSET + ORE) / ASSET` reproduces `NPERFV`, both to zero error on
all nine banks — which is what confirms the two replacements are the right
fields and are labelled correctly.

Six RC-T "foreign offices" memo fields (`TITOTF`, `TNMAF`, `TMAF`, `TNMNUMF`,
`TMAFNUM`, and their kin) are null for every domestic community bank. They are
left in the full 138-item set for completeness — that set is explicitly the whole
schedule — but they will always show as `—` for a bank with no foreign offices.

## Verification

The statistics were checked against an independent computation: nine banks,
twelve metrics, and ten statistics each (focus value, median, mean, 75th and 25th
percentile, rank, group size, percentile, gap to benchmark, and year-over-year
change) — 120 comparisons, exact agreement to four decimal places.

Rank counts the focus bank (`4 of 9`); percentile is measured against peers only
(`63%ile`). Those agree by construction: three banks above out of nine means five
of eight peers below.

## Loan composition

Seventeen loan metrics live in `CORE_METRICS`: nine dollar balances (agricultural
production, farmland, C&I, nonfarm nonresidential, 1-4 family, construction,
multifamily, consumer, and total real estate) and eight FDIC concentration
ratios.

**The FDIC's `*R` ratio fields divide by total assets, not by loans.** For
Peoples Bank at 31 December 2025, `LNAGR` reads 32.78% while agricultural
production loans are 38.40% of the gross loan book. Both are true and they answer
different questions, so the ratio fields are labelled "... to total assets"
explicitly, and a **percent of gross loans** option was added to the Show-as
toolbar for the other denominator. `LNLSGR` is fetched on every build to serve
as that denominator.

## Market view

Sourced from the FDIC Summary of Deposits (`/sod`) and institution history
(`/history`), neither of which is used elsewhere in the dashboard.

SOD is an **annual** survey taken every 30 June, so it lags the quarterly Call
Report. The view says so on screen, because mixing the two dates silently would
be misleading.

Loading is lazy — nothing is fetched until the Market tab is opened, and the
cache is cleared whenever the institution changes. Two requests cover the common
case: one for the bank's own branches, then one `STCNTYBR:(a OR b OR ...)` query
covering every county in the footprint at the latest survey, so the table shows
share and rank on all rows immediately. The ten-year history is fetched per
county on selection. Footprints wider than 40 counties are truncated with a
notice rather than silently.

**Share is calculated here, not read from a field** — the FDIC publishes branch
deposits but not share. Only FDIC-insured institutions file this survey, so
credit unions and farm credit associations are absent; the footnote says this,
because in an agricultural market those competitors are real.

## Deliberately not included

- `/demographics` — 1.6M rows of office counts by period, already covered by the
  institution and SOD data.
- `/failures` — no recent relevance to this footprint.
- Holding company financials (FR Y-9C) are the Federal Reserve's, not the FDIC's.
- Credit unions file with the NCUA and are outside this API entirely.

## Chart fitting

Charts are hand-drawn SVG, so "responsive" means redrawing at the container's
current width, not rescaling one fixed drawing.

`mountChart()` in `04_charts.js` wraps every chart in a `.chartbox`, measures it,
and calls the chart builder with that width. A `ResizeObserver` redraws on
change, which covers window resizes, the rail collapsing under 1080px, and grid
reflow. The first paint is deferred to `requestAnimationFrame` because cards are
assembled detached — drawing before layout would measure zero and bake in the
300px minimum.

`CM` holds the shared margins (top, bottom, right, label pad, row height, end-label
gap) so spacing reads the same from panel to panel. The two gutters that must
vary — the row-label column and the value column — are measured from the strings
actually being drawn, via `textW()` on a canvas context. That measurement uses
**font-weight 650**, the heaviest any label uses: emphasised labels run about 17%
wider than the same string at normal weight, and measuring light under-reserved
the gutter enough to push text past the edge.

`ellipsize()` then trims each label to the gutter that was actually reserved.
Character-count truncation is not sufficient on its own: when a narrow panel
forces a gutter to its clamp, a "short enough" name can still be wider than the
space available.

Heights are derived from width (`clampN(W * ratio, min, max)`) for time series
and scatter, and from row count for the ranking, position, bump and share
charts, so a panel is as tall as its content needs and no taller. `.grid2` and
`.grid3` use `align-items:start` so a short panel beside a tall one hugs its own
chart instead of stretching.

Tile sparklines opt out of the fluid rule via `svg.chart.spark`, since they are a
fixed ornament rather than a chart that should fill its box.

## Stat tiles and the metric drill-in

Tiles carry no inline sparkline. A line drawn inside a 226px tile had to share
space with the figure and the label, and measurement confirmed it overlapped the
label region on every tile; there is no arrangement at that size where it stays
clear of both.

Clicking or pressing Enter on a tile sets it as the focus metric *and* opens
`openMetricDetail()` — a wide dialog with a six-box stat strip, a full-size trend
chart and the peer ranking, both mounted through `mountChart()` so they fill the
dialog and re-fit with it. The dialog carries the same year-to-date caveat as the
main views. `modal()` takes an `opts.onMount` callback for this, which runs once
the dialog is in the document and has a measurable width.

`mountChart()` draws immediately when the box is already laid out — a dialog
appended to the live document — and only defers to `requestAnimationFrame` when
it is not, which is the case for cards assembled detached. Deferring
unconditionally left dialog charts blank in a background tab, where frame
callbacks are throttled to nothing.

## GitHub Pages

`index.html` at the repository root is a redirect to `FDIC_Peer_Dashboard.html`.
Pages serves `index.html` at the site root, and the dashboard keeps its own
filename so it stays recognisable when someone downloads it instead.

`.nojekyll` disables Jekyll processing. Nothing here needs it, and Jekyll
silently ignores paths beginning with an underscore.

Neither file is produced by `build.py` — they are static and do not change when
the dashboard is rebuilt.

## Even grids

`auto-fit` chooses its own column count from the available width. For a fixed
number of items that regularly lands on a count which leaves one item alone on
the last row — six tiles in five columns is five and one, which is what the KPI
strip did on a smaller laptop.

`gridColumns()` in `04_charts.js` picks the count deliberately: the largest that
fits the minimum item width, preferring one that divides the item count exactly,
and never one that would leave a single orphan. `evenGrid()` applies it and
re-applies on resize through the same observer list as the charts. Used by the
stat tiles (150px minimum), the institution profile (128px) and the drill-in
stat strip (132px). The CSS keeps an `auto-fit` declaration as the pre-layout
fallback.

The focused tile is still drawn double-width, but only when `evenGrid` confirms
the whole set fits on one row — `opts.emphasise` sets a count of n+1 and an
`emph` class. Widening one tile is otherwise exactly what pushed another onto a
row of its own.

Verified across 4,566 width/count combinations: no lone-orphan rows, and no tile
narrower than its 150px minimum. For six tiles the ladder is 6 → 3 → 2 → 1, all
divisors, so every row is always full.

## Stacked layout

Below 1080px the shell becomes a flex column with `.main` ordered before
`.rail`, so a phone or a small laptop lands on the numbers instead of a
screenful of controls.

`min-width:0` on the rail and its children matters here: a flex item defaults to
`min-width:auto`, which resolves to its min-content width, and a `<select>` is
as wide as its longest option. Without it the rail was 870px inside an 820px
viewport and the whole page scrolled sideways.

## Panel spacing

`--gap-block` (12px) is the single vertical rhythm value. `.tiles`, `.grid2`,
`.grid3` and `.notice` use it for their bottom margin, `.grid2`/`.grid3` also
use it as their column gap, and `#dash > .card` uses it so panels stacked
straight onto the dashboard are separated.

`.card` itself carries no margin: cards inside a grid are spaced by the grid's
gap, and a margin there would only pad the bottom of the track. The
`#dash > .card` selector limits the margin to direct children, and
`:last-of-type` drops it before the footnotes, which supply their own top
margin and rule.

Before this, `.card` had no margin at all, so any two cards appended as siblings
sat flush against each other — most visible on the Market view, which stacks
four panels, and also affecting Overview (position strip against the profile)
and Trends (pinned peers against the small multiples).
