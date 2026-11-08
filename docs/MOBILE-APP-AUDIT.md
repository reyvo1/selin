# Mobile App Audit — Toko360

## Scope and honesty note

- Requested path `apps/user-mobile` **does not exist** in this repository.
- The only mobile client in this repo is `apps/customer-mobile` (Flutter, `toko360_customer`, version `0.5.3+1`).
- This audit covers `apps/customer-mobile` line-by-line (3 Dart files, 50 LOC total) and compares it against the web storefront/admin capabilities.
- No `TODO`/`FIXME`/`XXX`/`HACK` markers were found. However, the app is effectively a starter/placeholder: `CatalogScreen` only renders an instruction string and performs no backend calls.

## File inventory

| File | LOC | Role |
|---|---:|---|
| `lib/main.dart` | 15 | App entry point, root `MaterialApp` |
| `lib/core/runtime_manifest.dart` | 25 | Runtime manifest model + HTTP loader |
| `lib/features/catalog/catalog_screen.dart` | 10 | Single screen placeholder |
| `pubspec.yaml` | 16 | Dependencies (Flutter SDK, `http`) |
| `README.md` | 6 | Starter notes |

## Screens and components

### 1. `Toko360CustomerApp` (`lib/main.dart`)
- `StatelessWidget` root.
- Builds `MaterialApp` with `debugShowCheckedModeBanner: false`, title `Toko360`, Material 3 theme.
- `home` is `const CatalogScreen()`.
- No routing, no initial route table, no deep links, no theme persistence, no locale handling.

### 2. `RuntimeManifest` (`lib/core/runtime_manifest.dart`)
- Immutable model: `features: Map<String,dynamic>`, `modules: List<dynamic>`, `settings: Map<String,dynamic>`.
- `enabled(String key)` returns `features[key]?['enabled'] == true`.
- `load(apiBaseUrl, {required branchCode})`:
  - HTTP GET `${apiBaseUrl}/platform/manifest?branchCode=...`.
  - Throws `Exception('Runtime manifest failed: ...')` on non-2xx.
  - Decodes JSON and casts sections with safe fallbacks.
- **Not invoked anywhere** in the app. Feature flags are never read by UI.

### 3. `CatalogScreen` (`lib/features/catalog/catalog_screen.dart`)
- `StatelessWidget`.
- Renders `Scaffold` with `AppBar(title: Text('Toko360'))` and centered text:
  `Hubungkan ke GET /api/v1/products dan runtime manifest.`
- No product fetch, no list, no search, no cart, no navigation.
- No typed interactive controls; no dispatch/action handlers.

## Backend endpoints

### Called by mobile client
- **None at runtime.** `RuntimeManifest.load` is defined but unused.
- If wired, it would call: `GET /api/v1/platform/manifest?branchCode=...` (public endpoint, tenant resolved by branch code).

### Equivalent web storefront endpoints (not used by mobile)
From `apps/storefront/app/page.tsx`, the web client uses (non-exhaustive but representative):
- `GET /api/v1/platform/manifest`
- `GET /api/v1/platform/storefront-branches` (implied by branch list)
- `GET /api/v1/products` (cursor pagination)
- `GET /api/v1/products/:id` / product reviews
- Customer account: `/storefront/account/login`, `/register`, `/logout`, `/me`, `/orders`, `/favorites`, `/returns`, `/addresses`, `/verification/*`
- Checkout/order: `/orders` create, `/orders/:number/payment-selection`
- Fulfillment options, promo validation (server-side)
- Favorites toggle, reviews submit, returns submit

### Mobile-ops (admin) endpoints (separate surface)
`apps/admin/app/modules/mobile-ops.tsx` consumes:
- `GET/POST /api/v1/mobile-ops/telegram/bindings`
- `PUT /api/v1/mobile-ops/telegram/bindings/revoke`
- `GET /api/v1/mobile-ops/drafts`
- `GET /api/v1/mobile-ops/drafts/:draftId`
- `GET /api/v1/mobile-ops/drafts/:draftId/discrepancy`
- `POST /api/v1/mobile-ops/drafts/open`
- `POST /api/v1/mobile-ops/drafts/:draftId/scan`
- `POST /api/v1/mobile-ops/drafts/:draftId/submit`
- `POST /api/v1/mobile-ops/drafts/:draftId/discard`

These are admin/operator endpoints for Telegram identity binding and stock-count drafts; they are **not** a customer mobile shopping app.

## Offline support

- **None.** No local database, no cache layer, no secure storage, no connectivity checks, no retry/backoff, no offline queue.
- `README.md` explicitly lists required additions: secure storage, auth/refresh token, state management, routing, push notification, deep link payment, offline cache, tests, store signing.

## Missing vs web admin / web storefront

Compared to `apps/storefront` and admin mobile-ops, the mobile client is missing at least:

### Identity and session
- Customer login/register/logout
- Session token storage (secure storage)
- Account profile load/update
- Email/phone verification flow

### Catalog and product
- Product list with cursor pagination
- Search (server-side + local fallback)
- Sort modes
- Product detail with variants/units/selling options
- Stock display per warehouse
- Product reviews display

### Cart and checkout
- Cart state and quantity updates
- Checkout form (customer, fulfillment type, shipping method, address selection)
- Promo/voucher input
- Order creation with idempotency operation key
- Payment method selection
- Order confirmation/tracking

### Account features
- Order history and detail
- Favorites toggle
- Returns request flow
- Address book CRUD
- Loyalty points/tier display

### Platform/runtime
- Actually calling `/platform/manifest`
- Applying feature flags to show/hide capabilities
- Branch selection and persistence
- Responsive/navigation shell

### Quality and ops
- Unit/widget tests
- Error handling and retry
- Accessibility labels
- Offline cache
- Push notifications / deep links

## Stubs / TODOs

- Literal `TODO`/`FIXME`/`XXX`/`HACK`: **none found**.
- Functional stubs/placeholders:
  - `CatalogScreen` is a placeholder screen (renders instruction text only).
  - `RuntimeManifest` is implemented but unused.
  - README documents the app as a starter requiring production hardening.

## Typed controls wired to dispatch

- **No typed controls are wired to dispatch.**
- `CatalogScreen` is `StatelessWidget` with no buttons/inputs and no callbacks.
- `RuntimeManifest.enabled` is defined but no widget consumes it.
- There is no state management, controller, or action dispatch layer in the app.

## Verdict

`apps/customer-mobile` is a **starter/scaffold**, not a functional mobile client. It compiles conceptually but provides no screens beyond a placeholder and performs no backend calls. Do not treat it as production-ready or feature-complete. If a production mobile app is required, it needs full implementation or replacement; the web storefront should remain the reference for feature parity.
