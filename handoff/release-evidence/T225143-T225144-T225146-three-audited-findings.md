# T225143 / T225144 / T225146 — three audited findings, delivered together

All three came from measuring the application rather than from being told about it. One browser probe
and one runtime API probe back them; the committed gates are
`tests/operator-surface-completeness.test.mjs` (10 cases) and `tests/product-imagery.test.mjs` (11).

---

## T225143 — information density

### What the measurement found

- **POS `.emptyState` / `.syncEmpty` (144px) and storefront `.emptyState` (192px) had no rule for the
  text inside them.** The box was sized, bordered and coloured; every `<h4>` and `<p>` inside it
  rendered at browser-default size and margin. Admin was the only app with `.emptyState h4` / `p`
  rules. This is the direct cause of "large empty boxes": a message in an unstyled heading inside a
  192px panel reads as a blank panel.
- **Admin `page.tsx:482` uses `<h2>` inside `.emptyState`**, and admin's stylesheet only listed `h4`,
  so that one heading was unstyled inside the same 132px box that `h4` handled correctly.
- **POS uses three different inner structures for the same box** — `h4`+`p` (4 places), a bare
  `<span>` (2), and `strong`+`small` (1) — and only the first had any chance of being styled.
- 5 of 9 POS empty states and 4 of 7 storefront ones carry **no icon at all**, so those had nothing
  but unstyled text.

### What changed

Typographic rules for `h4`, `p`, `span`, `strong` and `small` inside both boxes; `h2`/`h3` added to
Admin; and a `:not(:has(...))` rule so a single-sentence state stops reserving a 144px panel.

**No placeholder content was invented.** The fix is legibility and proportion, not filling boxes to
make a screen look busy.

---

## T225144 — two built screens nobody could reach

### What the measurement found

- `/kiosk/` and `/stock-count/` are **complete PWAs**: manifests, icons, their own service worker
  (stock-count), their own auth and their own API calls. `grep` across every app source found **zero**
  navigation links to either.
- The kiosk needs an API key with `kiosk.price.read` in `x-api-key`, and **a user session is refused
  by design** (`kiosk.service.ts:31-33`). The permission is granted to no role.
- `apps/admin/app/modules/api-keys.tsx:43` has a working kiosk preset that fills the right scope — and
  never prints the `/kiosk/?key=…` URL that consumes the key it just minted.
- **A live bug:** `apps/pos/public/sw.js` is registered at `/` (from `page.tsx:266`), so its scope
  covers both device screens. Its navigate handler did `cache.put('/', copy)` for **whatever document
  was navigated to**. Visiting `/kiosk/` from the till overwrote the cached POS shell, and the offline
  fallback at line 30 then served the kiosk HTML as the POS. `/stock-count/` escaped only because its
  own scoped worker wins.

### What changed

- POS topbar links to both, through the existing `warehouseControl` slot, via
  `window.open(url, '_blank', 'noopener,noreferrer')` — the pattern already used for the digital
  receipt at `page.tsx:529`. A blocked popup is reported with the URL.
- The kiosk install URL is rendered beside the one-time secret, built with `URLSearchParams`, and only
  for a key that actually carries `kiosk.price.read`.
- `sw.js` returns early for `/kiosk` and `/stock-count`, and writes to the shell cache only when the
  path is exactly `/`.

### Deliberately not done

`edge-sync` (0% UI) and 12 of 15 `branch-continuity` routes remain unreachable. These are
**node-to-node protocols** — a device replicating against a server — and building operator UIs for
them would be inventing work. They belong to the endpoint-coverage ledger as `NODE_PROTOCOL`, which is
the existing mechanism, and that classification is open work rather than something to fake here.

---

## T225146 — a purchase order that could not be stopped

### What the measurement found

- `PurchaseOrderStatus.CANCELLED` exists in the enum. **Nothing in the codebase ever writes it.**
  `purchase-orders.service.ts` is the only writer of PO status, and it writes only
  `RECEIVED`/`PARTIALLY_RECEIVED` (from goods-receipt confirm). The guard at
  `goods-receipts.service.ts:109` — `if (['CANCELLED','RECEIVED'].includes(po.status))` — has a branch
  that could never fire.
- **The admin had no purchase-order list at all.** `orders` was fetched and used only to populate a
  dropdown in the goods-receipt form. A PO could be created and never seen again.
- A PO is created **`APPROVED`**, never `DRAFT`. A goods receipt is created directly into
  `PENDING_INSPECTION`/`READY_TO_CONFIRM`, never `DRAFT`.

### What changed, and what deliberately did not

**Added:** `POST /purchase-orders/:id/cancel` — permission `purchase.cancel`, idempotency-key
header, tenant-scoped through the existing `warehouse.branch.companyId` predicate, audited as
`CANCEL_PURCHASE_ORDER`, conditional claim on `status: 'APPROVED'` so two operators cannot both win.
Plus a PO list in the admin with the Batal action.

**Not added: a PATCH on purchase orders or goods receipts.** This is the part worth reading. Both are
created already committed — the PO at `APPROVED`, the goods receipt under inspection. The editable
document is the `PurchaseRequest`, which has a real `DRAFT` stage and its own edit guard at
`purchase-requests.service.ts:134`. A PATCH here would be dead code, or worse, a way to rewrite a
commitment that a supplier invoice or an inspection record already points at. A test asserts the
absence of both routes so nobody "fixes" this gap later by adding one.

### Runtime probe, 10 of 10

```
PO created                              PO-PUSAT-202610-000001  status=APPROVED
cancel                                  status=CANCELLED
retry with same Idempotency-Key         same order number, still CANCELLED
cancel again (no key)                   HTTP 201, not an error
cashier cancel                          HTTP 403
PO after the refused cancel             status still APPROVED
PATCH /purchase-orders/:id              HTTP 404
```

### Hard delete: a decision, not an omission

The whole API has **three** `@Delete` handlers — an integration mapping, a customer address, a
customer favourite. None acts on a financial row. That is correct and now documented rather than left
as an accident: inventory movements are append-only, journals and posted receipts are immutable, and a
business document that has been acted on is reversed by a **new** document, never erased. This is
AGENTS.md §3, and it is a stronger guarantee than a delete button would be.

---

## Gates

| Gate | Result |
|---|---|
| `tests/operator-surface-completeness.test.mjs` (new) | 10/10 |
| `tests/product-imagery.test.mjs` | 11/11 |
| `npm run test:dependency-free` | 1921/1921 |
| `npm run lint` (six workspaces) | exit 0 |
| `npm run workflow:validate` | 61 work items |
| `npm run validate:repo` | 1248 files |

Two gates caught real mistakes in this work rather than confirming it:

- `tests/full-ui-tailwind-github-uat.test.mjs` forbids native `window.confirm` on operator surfaces,
  and the first version of the PO cancellation used one. It was replaced with the repository's
  established type-to-confirm — type `BATAL`, the same shape as API key rotation's `ROTATE`.
- `tests/operator-surface-completeness.test.mjs` initially asserted a `${…}` interpolation that the
  JSX does not use; the assertion was corrected to the form the code actually takes, without
  weakening what it requires.

## Not proven

- **PostgreSQL migration rehearsal** for the product-imagery migration: no `T360_MIGRATION_DATABASE_URL`
  here. SQLite rehearsal passed.
- **No GitHub workflow has run** against this source; `uat:pre-github:local` was not run.
- **The service-worker fix is proven by reading the guard, not by exercising offline mode** in a
  browser. A live offline-navigation test would be the stronger proof.
- **The `RECEIVED`-PO and posted-receipt refusal branches** are asserted at source only; no runtime test
  drives a PO all the way to `RECEIVED`, which needs a confirmed inspection.
- **No human visual acceptance.** Whether a 144px box becoming smaller reads better is a judgement no
  source assertion makes.
- `edge-sync` and `branch-continuity` classification remains open; see T225144.
