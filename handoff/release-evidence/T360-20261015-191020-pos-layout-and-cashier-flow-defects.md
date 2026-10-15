# T360-20261015-191020 — POS layout and cashier flow defects

Work item: `work-items/active/T360-20261015-191020-pos-layout-and-cashier-flow-defects-split-payment-rows-overl.json`
Phase reached: **VERIFICATION** (not closed — see "What is NOT proven" below)
Module: `pos-ui` · Wave `W0` · Risk `MEDIUM` · Impacts: all `NONE`

## Where the lost session stopped

The work item was created at 19:10 on 2026-10-15 and left at `INTAKE` with placeholder text. The
only surviving change was an uncommitted edit to `apps/pos/app/globals.css` holding the styling half
of the four reported defects. None of it was tested, and the fourth defect was not started.

## The four reported defects

1. **Split payment rows overlapped the cart.** `.summary>div` is a flex label/value row, and the
   split-payment tender list and the discount-approval hint are direct children of `.summary`, so they
   inherited the row layout and laid their own inner rows out horizontally across the cart.
2. **Nine classes in the JSX had no CSS rule.** They shipped as browser defaults inside an otherwise
   styled till: a bulleted `<ul>`, a `<pre>` that overflowed its card, helper text at body size.
3. **Modal actions were unstyled.** `ModalPortal` renders into `<body>`, so no `.posWorkspaceBody`
   rule reaches a dialog. The classless buttons carrying "Setujui" and "Buat voucher" and the
   dialog labels had browser defaults.
4. **Scanning outside the search box did not add an item.** The global listener recognised the scan
   and then only wrote the code into the search box; `scanExactBarcode` had exactly one call site,
   the search input. The cashier had to click the box and press Enter a second time, on a surface
   that was not the one they were scanning into — the precise flow the listener was added to remove.

## Defects found while auditing, not reported

- **`.spin` could not animate.** There was no rule for it and `globals.css` contained **zero**
  `@keyframes`, so the offline-sync busy indicator never moved through a sync that can take minutes.
- **`.formStack`** (`ppob-workspace.tsx:192`) had no rule.
- **`.chip` was inert.** It rendered correctly only because `.chips button` styled it by descendant;
  moving the markup would have shipped raw buttons. The rule now names the class, and the two
  dark-theme `.chips button` overrides were retargeted to match.
- **A dead declaration this work itself introduced.** `.formStack{gap:.85rem}` was outranked by
  `.posWorkspaceBody form:not(.inlineForm){gap:.8rem}` (0,2,1 against 0,1,0) and did nothing, while
  reading as though the class was handled. Removed, and the test now asserts the heading rule and
  fails if the dead gap returns. This is the exact shape of failure this repo has been closing
  findings about — a token-exists assertion passing over a rule with no effect — so it is recorded
  rather than quietly fixed.

### On product images

There are **no `<img>` elements anywhere under `apps/`** — no `imageUrl`, `thumbnail` or `photo`. The
"product image" in the POS is `.productIcon`, an inline lucide `<Package>` SVG inside a styled div,
and no selector changed by this work touches it. Storefront and Admin were not modified at all.
This was verified by search, not assumed.

## Implementation

- `apps/pos/lib/barcode.ts` — new exported pure `matchBarcode(products, raw, { online })` returning
  `matched` (with the resolved unit, factor and ids), `unmatched`, or `unpostable` with a reason. The
  decision was previously inline in a React component and unreachable by any test.
- `apps/pos/app/page.tsx` — `scanExactBarcode` now delegates to `matchBarcode` and returns
  `'added' | 'blocked' | 'unmatched'`; both the global `onScan` handler and the search box Enter call
  it, so there is one commit path and one `add(match.product, …)` call.
- `apps/pos/app/page.tsx` — the listener reaches the live function through `scanHandlerRef`, refreshed
  every render. Calling `scanExactBarcode` directly from the once-registered effect would resolve
  every barcode against the first render's **empty** catalog and report all of them unknown: a worse
  defect than the one being fixed, and invisible in review.
- An unmatched code is still left visible in the search box. The catalog is paged and may not hold
  the product, so a silent drop would lose a sale the cashier had in hand.
- `apps/pos/app/globals.css` — the nine class rules, the `.modalCard` dialog rules, the
  `.summary>div:not(.splitPayments):not(.approvalHint)` exclusion, `.spin` + `@keyframes pos-spin`,
  `.formStack`, and `.chip` with its dark-theme overrides.

**Deliberately not changed:** where a product's own barcode is *also* registered as a packaging
barcode, the packaging entry wins. That is the pre-existing order, it is now pinned by a test, and
changing it would alter which unit stock is drawn for existing master data. Finance's call, raised
here rather than settled.

## Gates

| Gate | Result |
|---|---|
| `tests/pos-surface-and-scan-commit.test.mjs` (new) | 13/13 |
| `tests/functional-w1-pos-barcode-conversion.test.mjs` | 3/3 |
| `tests/pos-barcode-scanner.test.mjs` (unchanged) | 16/16 |
| `npm run test:dependency-free` | **1900/1900** |
| `npm run lint -w @toko360/pos` (strict TS, 21 files) | exit 0 |
| `npm run workflow:validate` | 57 work items |
| `npm run validate:repo` | 1236 files |

Class coverage is **measured, not curated**: JSX tokens are read with the TypeScript compiler, and a
token is accepted only if a rule exists in `globals.css` or the project's own Tailwind compiler emits
it. The gate fails closed if `tailwindcss` cannot be loaded and rejects an extractor that finds fewer
than 50 tokens, so it cannot pass vacuously. Four extractor defects were found and fixed while
writing it, each now pinned by a negative control: a regex reading `className` invented tokens from
expression text; a regex escaping turned `[1720px]` into a character class so nine real utilities read
as unstyled; a template expression contributed no classes from its interpolated conditional; and a
prefix match certified `text-sm` from `text-sm/6`.

## Local browser verification (real Chrome via CDP, running stack)

12 PASS, 1 NOT_RENDERED, 0 FAIL.

- `FOCUS_IS_NOT_SEARCH_BOX` — `document.activeElement` was `BODY`, so the defect's precondition held.
- `SCAN_OUTSIDE_SEARCH_BOX_ADDS_ITEM` — real key events at 6 ms intervals then Enter: **cart 0 → 1**
  for barcode `899000000003`.
- `SCAN_CLEARS_SEARCH_BOX`, `UNMATCHED_SCAN_STAYS_VISIBLE`.
- `SUMMARY_ROWS_STILL_LABEL_VALUE_FLEX` (`.summary>div` still `flex` — no regression on label rows).
- `SPLIT_PAYMENT_BLOCK_NOT_FLEX_ROW` — `.splitPayments` computes `display: block`.
- `SPIN_KEYFRAMES_PRESENT`, `CHIP_STYLED_BY_CLASS_NAME`.
- `UNSTYLED_LIST_NO_LONGER_BULLETED` — **NOT_RENDERED**: `.receiptHistory` / `.branchStockList` sit
  behind flows this probe does not drive. Recorded as not proven rather than asserted.

Credentials used were the local demo seed defaults, held in memory only. No secret was printed,
written to the repository, or placed in this evidence.

## What is NOT proven

- **`npm run uat:pre-github:local` was not run** and no GitHub workflow has run against this source.
  The 1900-case suite, the workspace typecheck and the two governance gates have.
- **The modal dialogs were not opened in a browser.** `.modalCard` styling is covered by the committed
  gate and a source assertion, not by runtime measurement.
- **`.receiptHistory` and `.branchStockList` were never rendered** in the probe.
- Human visual acceptance on a real till, and PostgreSQL parity, are untouched by this work and were
  not exercised.

The work item is therefore left at `VERIFICATION`, not advanced to `STAGING` or closed.

## Rollback

Revert the commit. No posted transaction, journal, stock movement, payment or receipt is created by
any of it, so there is no compensating operation on any ledger. Reverting `apps/pos/app/page.tsx`
alone restores the old search-only behaviour, and an item that was never added has nothing to undo.
