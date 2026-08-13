# FDIC Peer Analytics

A single-file dashboard for comparing a bank against its peers using live FDIC
Call Report data. Built for Peoples Bank (Rock Valley, Iowa — FDIC cert 16265),
but any FDIC-insured institution can be searched at runtime.

### Two ways to use it

**Open it in a browser** — <https://calebsmit.github.io/FDIC_dashboard/>

**Or download and run it locally** —
[`FDIC_Peer_Dashboard.html`](FDIC_Peer_Dashboard.html) is the whole product. Save
it anywhere and double-click. No install, no server, no build step, no account.

Both are the same file and behave identically. The hosted copy is convenient for
sending a link; the local copy keeps working with no dependency on GitHub.

---

## What it does

Pick an institution, build a peer group, choose Call Report metrics, and compare.
Everything is fetched from `api.fdic.gov` when you press build — nothing is
stored anywhere but your browser.

**Five views**

| View | Answers |
|---|---|
| **Overview** | Where do we stand right now? Rank, gap to benchmark, position across every selected metric. |
| **Trends** | How have the numbers and our ranking moved, quarter by quarter? |
| **Explore** | How do any two metrics relate across the group? |
| **Market** | What share of county deposits do we hold, and against whom? |
| **Compare** | The full sortable matrix — every metric, every bank — with the selected row drawn as ranked bars underneath. |

**200 metrics** — 45 core (balance sheet, earnings, performance ratios, capital,
asset quality), 17 loan-composition and concentration items, and the full
138-item trust and fiduciary set from Call Report Schedule RC-T.

**Reshape the numbers** — benchmark against the peer median, average, quartiles
or maximum; show figures as reported, as year-over-year or quarter-over-quarter
change, as a percent of assets or of gross loans, or per employee or per office.

**Take it with you** — CSV and JSON export, per-chart PNG/SVG download, a print
layout for board packets, saved setups, and shareable links that encode the
whole configuration in a URL.

---

## Configuring it

### Peer groups — no code required

Build a group in the app under **Peer group → Criteria** (state, asset range,
charter type, specialisation, trust powers) or **→ By name** (search any bank by
name or FDIC cert number), then press **Save current group**. It becomes a
one-click button next to the built-in groups and persists in your browser.

Use **Saved setups → Export file** to hand a configuration to a colleague.

### Changing the defaults everyone starts with

One clearly marked **CONFIGURATION** block at the top of
[`build/parts/03_core.js`](build/parts/03_core.js):

```js
const DEFAULT_INSTITUTION = 16265;      // the bank the dashboard opens on

const PEER_GROUPS = [
  { id:'local', name:'Northwest Iowa market', focus: DEFAULT_INSTITUTION,
    certs:[228, 13953, 34384, 8101, 4506, 5800, 57505, 235],
    note:'Banks headquartered in Sioux, Lyon, O’Brien, Plymouth and Woodbury counties.' },
  …
];
```

Nothing else in the codebase hardcodes a bank. Identifiers are FDIC
**certificate** numbers, not RSSD numbers — look one up at
[BankFind](https://banks.data.fdic.gov/bankfind-suite/bankfind) or by searching
in the app.

---

## Building

The deliverable is generated from the parts in `build/`:

```
python build/build.py
```

Run from the repository root. It concatenates `build/parts/` in order, injects
the metric catalogue, checks no external resources crept into the markup, and
writes `FDIC_Peer_Dashboard.html`.

**Do not edit `FDIC_Peer_Dashboard.html` directly** — the next build overwrites
it. [`build/README.md`](build/README.md) documents the internals: where the
metric list came from, which FDIC field codes are and are not retrievable, the
chart-fitting system, and the reasoning behind the data caveats below.

---

## Reading the numbers

- **Dollars are in thousands**, as the FDIC files them.
- **Income and expense items are year-to-date.** Q1 covers three months, Q4
  covers twelve, and the count restarts each January. The dashboard flags this
  wherever it could be misread as a decline, and blocks quarter-over-quarter
  comparison on those items, which is never like-for-like.
- **Peer statistics exclude your own bank**, so "peer median" describes the
  comparison group rather than the group plus you.
- **Ratios are taken as the FDIC publishes them** and are not recalculated.
  Note that FDIC's `*R` loan ratios divide by *total assets*, not by loans — both
  denominators are available and each is labelled for what it is.
- **Market share covers FDIC-insured institutions only.** Credit unions and farm
  credit associations file elsewhere and are not in the denominator.
- **Summary of Deposits is an annual survey** taken every 30 June, so the Market
  view lags the quarterly Call Report used everywhere else.

The statistics were verified against an independent computation — nine banks,
twelve metrics, ten statistics each, 120 comparisons, exact agreement.

---

## Privacy and access

Requests go directly from your browser to `api.fdic.gov`, which serves public
data. Nothing is uploaded anywhere, and no analytics or third-party resources are
loaded — the page contains no external `src` or `href`.

An **API key is optional.** Anonymous access is allowed roughly 120
requests/minute and a full dashboard build uses three to five. A free key from
[api.data.gov](https://api.data.gov/signup/) raises the ceiling. If entered, it
stays in your browser only.

---

## Source

FDIC BankFind Suite API — `api.fdic.gov/banks` (`institutions`, `financials`,
`sod`, `history`). Public data, no authentication required.
