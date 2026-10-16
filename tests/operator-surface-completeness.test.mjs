// Three gaps found by auditing rather than by being told, each pinned so it cannot quietly return.
//
// 1. EMPTY STATES THAT SAY NOTHING. The POS and storefront sized and coloured their empty-state box
//    but never styled the text inside it, so every <h4> and <p> rendered at browser-default size and
//    margin inside a 144px / 192px panel. That is what made them read as blank boxes. The Admin app
//    had the rules; the other two did not.
//
// 2. TWO FULLY BUILT SCREENS NOBODY COULD REACH. /kiosk/ and /stock-count/ are complete PWAs with
//    their own manifests, their own auth and their own API. Nothing in any app linked to them, so an
//    operator had to be told the address by hand — and the screen that mints a kiosk key never printed
//    the URL that key installs. Separately, the POS service worker is registered at '/', so its scope
//    covered both device screens and it cached whichever document was last navigated to under the
//    key '/': opening /kiosk/ overwrote the cached POS shell, and the offline fallback then served the
//    kiosk as the till.
//
// 3. A PURCHASE ORDER THAT COULD NOT BE STOPPED. PurchaseOrderStatus.CANCELLED existed in the enum
//    and the goods-receipt guard read it, but nothing in the codebase ever wrote it. A PO raised
//    against the wrong supplier could only be left standing, and the admin had no PO list at all —
//    you could create one and never see it again.
//
// Load path: this file reads source, because all three are wiring and contract facts that cannot be
// reached without a running stack. The runtime proof is in the release evidence, not here.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const posCss = read('apps/pos/app/globals.css');
const posPage = read('apps/pos/app/page.tsx');
const storefrontCss = read('apps/storefront/app/globals.css');
const adminCss = read('apps/admin/app/globals.css');
const adminPage = read('apps/admin/app/page.tsx');
const apiKeys = read('apps/admin/app/modules/api-keys.tsx');
const posSw = read('apps/pos/public/sw.js');
const poController = read('apps/api/src/purchase-orders/purchase-orders.controller.ts');
const poService = read('apps/api/src/purchase-orders/purchase-orders.service.ts');
const seed = read('apps/api/prisma/seed.ts');

// ---------------------------------------------------------------------------
// 1. Empty states carry a readable message.
// ---------------------------------------------------------------------------

test('the POS empty state styles the text inside it', () => {
  // This was the defect: the box existed, the text did not. A heading at browser-default size inside a
  // 144px panel reads as an empty panel, which is exactly the complaint.
  assert.match(posCss, /\.emptyState h4[^{]*\{[^}]*font-size/, 'the POS empty-state heading must be sized');
  assert.match(posCss, /\.emptyState p[^{]*\{[^}]*font-size/, 'the POS empty-state body must be sized');
  // Three inner shapes are in use — h4+p, a bare <span>, and strong+small. All three must be legible.
  assert.match(posCss, /\.syncEmpty span/, 'a bare-span empty state must be styled too');
  assert.match(posCss, /\.syncEmpty strong|\.emptyState strong/, 'the strong+small empty state must be styled');
  // One sentence does not need a 144px box.
  assert.match(posCss, /\.syncEmpty:not\(:has/, 'a single-line empty state must stop reserving a full panel');
});

test('the storefront empty state styles the text inside it', () => {
  assert.match(storefrontCss, /\.storefrontV4 \.emptyState h4[^{]*\{/, 'the storefront empty-state heading must be sized');
  assert.match(storefrontCss, /\.storefrontV4 \.emptyState p[^{]*\{/, 'the storefront empty-state body must be sized');
});

test('the admin empty state styles every heading level it actually uses', () => {
  assert.match(adminCss, /\.emptyState h4[^{]*\{/, 'h4 must be styled');
  // One raw empty state in page.tsx uses <h2>, and until h2/h3 were listed it rendered unstyled inside
  // the same 132px box that h4 handled correctly.
  assert.match(adminCss, /\.emptyState h2[^{]*\{/, 'h2 is used by a real empty state and must be styled');
});

// ---------------------------------------------------------------------------
// 2. The device screens are reachable, and the service worker cannot eat them.
// ---------------------------------------------------------------------------

test('both standalone device screens are linked from the POS', () => {
  assert.match(posPage, /openDeviceScreen\('\/stock-count\/'\)/, 'the stock count screen must be linked');
  assert.match(posPage, /openDeviceScreen\('\/kiosk\/'\)/, 'the kiosk screen must be linked');
  // Each owns the full screen, so it opens in a new tab.
  assert.match(posPage, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/,
    'a device screen must open with noopener,noreferrer; without noopener the opened document gets a handle on the till window');
  // A blocked popup has to say so, not fail silently.
  assert.match(posPage, /Popup diblokir browser/, 'a blocked popup must be reported with the URL');
  // The link is visible in the persistent header, which is where a cashier will actually find it.
  assert.match(posCss, /\.deviceLink\{/, 'the device links need a style of their own');
});

test('the kiosk key screen prints the address that key installs', () => {
  // A secret shown once, with no URL, produces a key that is never installed. The screen already had
  // the right preset and the right scope; it was missing the one thing that completes the task.
  assert.match(apiKeys, /function kioskInstallUrl/, 'the install URL must be derivable');
  assert.match(apiKeys, /\?key=/, 'and it must carry the key');
  assert.match(apiKeys, /searchParams\.set\('key', secret\)/, 'the key must be URL-encoded through URLSearchParams, not string-concatenated');
  assert.match(apiKeys, /kioskInstallUrl\(kioskSecret/, 'the URL must be rendered next to the secret');
  // Only a key that can actually reach the kiosk gets an install URL. A general integration key that
  // happens to carry the scope by accident would otherwise be handed an address for a screen its
  // holder was never told about.
  const captureLine = apiKeys.split('\n').find((line) => line.includes('setKioskSecret(') && line.includes('kiosk.price.read'));
  assert.ok(captureLine, 'the kiosk secret must be captured conditionally, on the kiosk scope');
  assert.ok(captureLine.includes("includes('kiosk.price.read')"),
    'the condition must be the kiosk scope, not merely the presence of a secret');
});

test('the POS service worker cannot cache a device screen over the POS shell', () => {
  // The bug: registered at '/', so its scope covered /kiosk/ and /stock-count/, and the navigate
  // handler cached WHATEVER document was visited under the single key '/'. Opening the kiosk from the
  // till overwrote the cached shell, and the offline fallback then served kiosk HTML as the POS.
  assert.match(posSw, /startsWith\('\/kiosk'\)/, 'the worker must skip the kiosk path');
  assert.match(posSw, /startsWith\('\/stock-count'\)/, 'the worker must skip the stock-count path');
  assert.match(posSw, /url\.pathname === '\/'/, 'and only the shell itself may be written to the shell cache');
  assert.doesNotMatch(posSw, /cache\.put\('\/', copy\);\s*\}\s*\n\s*return response;/,
    'the unconditional cache.put(\'/\') is the defect itself and must not return');
});

// ---------------------------------------------------------------------------
// 3. A purchase order can be stopped, and can be seen.
// ---------------------------------------------------------------------------

test('cancelling a purchase order exists on the API and is guarded', () => {
  assert.match(poController, /@Post\(':id\/cancel'\)/, 'the cancel route must exist');
  assert.match(poController, /@Permissions\('purchase\.cancel'\)/, 'and be permission-guarded, not role-only');
  assert.match(poController, /@Headers\('idempotency-key'\)/, 'a retriable mutation must accept an idempotency key');

  assert.match(poService, /async cancel\(/, 'the service must implement it');
  // Fail closed on the states where cancelling would contradict the ledger.
  assert.match(poService, /PARTIALLY_RECEIVED' \|\| order\.status === 'RECEIVED'/, 'a received PO must not be cancellable');
  assert.match(poService, /CONFIRMED', 'PARTIALLY_ACCEPTED'\]/, 'a PO with a posted receipt must not be cancellable');
  // Retry safety: cancelling twice returns the row instead of failing a workflow that succeeded.
  assert.match(poService, /order\.status === 'CANCELLED'[\s\S]{0,120}return order;/, 'a repeated cancel must be idempotent');
  // The concurrency guard: status in the WHERE clause, so two operators cannot both claim it.
  assert.match(poService, /updateMany\(\{[\s\S]{0,120}status: 'APPROVED'/, 'the claim must be conditional on the current status');
  assert.match(poService, /action: 'CANCEL_PURCHASE_ORDER'/, 'the cancellation must be audited');
  assert.match(poService, /beginIdempotent/, 'and gated by the idempotency ledger');
});

test('the cancel permission is declared and granted to the roles that can raise a PO', () => {
  assert.match(seed, /'purchase\.cancel'/, 'the permission must exist in the seed');
  const purchasing = seed.split('\n').find((line) => line.includes("['PURCHASING'"));
  assert.ok(purchasing?.includes("'purchase.cancel'"),
    'PURCHASING can raise a PO, so it must be able to withdraw one; otherwise cancelling needs a different role for no reason');
});

test('the admin can see and cancel a purchase order', () => {
  // The admin could CREATE a PO and then never see it again: there was no list at all.
  assert.match(adminPage, /async function cancelPurchaseOrder/, 'a cancel action must exist');
  assert.match(adminPage, /\/purchase-orders\/\$\{orderRow\.id\}\/cancel/, 'it must call the route the API exposes');
  // Cancelling a commitment to a supplier is not a single click. Native confirm is FORBIDDEN on
  // operator surfaces by tests/full-ui-tailwind-github-uat.test.mjs, so the confirmation is the repo's
  // established type-to-confirm: the operator types it out, exactly as API key rotation does.
  assert.doesNotMatch(adminPage, /\bwindow\.(?:prompt|confirm|alert)\s*\(/, 'native browser confirm is forbidden on operator surfaces');
  // The number is rendered as a JSX child next to the heading, not interpolated into a string.
  assert.match(adminPage, /Batalkan PO \{cancelPurchaseOrderTarget\.number\}/, 'the order number must be named in the confirmation');
  assert.match(adminPage, /toUpperCase\(\) !== 'BATAL'/, 'the confirmation must be typed out, not merely clicked through');
  assert.match(adminPage, /canRootAction\('purchase\.cancel'/, 'the button must respect the permission');
  assert.match(adminPage, /<h2>Purchase order<\/h2>/, 'a purchase order list must exist in the admin');
  // A refusal from the server is the whole reason for asking, so it must be shown rather than swallowed.
  assert.match(adminPage, /error instanceof \? error\.message|error instanceof Error \? error\.message/, 'a rejection must be surfaced');
});

// ---------------------------------------------------------------------------
// The last two endpoints that had no operator control at all.
// ---------------------------------------------------------------------------

test('a branch transfer departure can be recorded', () => {
  // The panel could acknowledge arrival and abandon a transfer, but never record the departure — so
  // the FIRST leg of a transfer between branches had no operator control. The only things available
  // were the second step and giving up.
  const controller = read('apps/api/src/branch-continuity/branch-transfer.controller.ts');
  assert.match(controller, /@Post\('transfers\/:transferId\/departure'\)/, 'the route must still exist');
  assert.match(controller, /@Permissions\('integration\.manage'\)[\s\S]{0,120}registerDeparture|registerDeparture[\s\S]{0,200}integration\.manage/,
    'and must stay behind the permission it was deliberately gated on');

  const branchSync = read('apps/admin/app/modules/branch-sync.tsx');
  assert.match(branchSync, /async function recordDeparture/, 'the panel needs an action');
  assert.match(branchSync, /branch-transfer\/transfers\/\$\{transferId\}\/departure/, 'it must call the route the API exposes');
  // All three controls must be present. Adding one is only half the fix; the gap was that this one
  // was missing while its two siblings were there.
  assert.match(branchSync, /ackArrival\(t\.transferId/, 'arrival must stay');
  assert.match(branchSync, /setAbandon\(t\)/, 'abandon must stay');
  assert.match(branchSync, /recordDeparture\(t\.transferId\)/, 'departure is the one that was missing');
  // The service guards the state, and the message must not imply stock moved.
  assert.match(branchSync, /stok tetap belum diposting/, 'the confirmation must not imply inventory was posted');
});

test('the plugin adapter catalog is visible to an operator', () => {
  // GET /platform/plugins returned the whole registered-adapter list, including productionReady, and no
  // screen called it. An operator had no way to tell a production-ready adapter from a template
  // without reading the server source — which matters because a template is not something a payment
  // may be run through.
  assert.match(read('apps/api/src/platform/platform.controller.ts'), /@Get\('plugins'\)/, 'the route must still exist');

  const platform = read('apps/admin/app/modules/platform-control.tsx');
  // Written as a plain string, not a regex: the path contains slashes, and a regex here means
  // one more escape level between the assertion and what it is asserting.
  assert.ok(platform.includes("'/platform/plugins'"), 'the settings screen must call it');
  assert.match(platform, /ADAPTER REGISTRY/, 'and must render it');
  assert.match(platform, /row\.productionReady/, 'the readiness flag is the whole reason to show this');
  assert.match(platform, /SIAP PRODUKSI/, 'readiness must be stated in words, not only by colour');
  assert.match(platform, /capabilities\.join\(', '\)/, 'capabilities are part of what an operator needs');
  // A permission the operator does not hold must degrade to an empty table, not break the screen.
  assert.match(platform, /optionalAuthorization\(call<RegisteredPlugin\[\]>/, 'the fetch must tolerate a refused permission');
});

// ---------------------------------------------------------------------------
// A stock count that went wrong could not be abandoned.
// ---------------------------------------------------------------------------

test('the stock-count screen can discard a draft', () => {
  // POST /mobile-ops/drafts/:id/discard existed on the server, audited as
  // MOBILE_OPNAME_DRAFT_DISCARDED and refusing anything not OPEN — and this screen never called it.
  // The only exits from a count were submitting it or walking away, so a count taken in the wrong
  // warehouse stayed OPEN on the server forever and re-opening it resumed the same bad count.
  const controller = read('apps/api/src/mobile-ops/mobile-ops.controller.ts');
  const service = read('apps/api/src/mobile-ops/mobile-ops.service.ts');
  assert.match(controller, /@Post\('drafts\/:draftId\/discard'\)/, 'the server route must still exist');
  assert.match(service, /MOBILE_OPNAME_DRAFT_DISCARDED/, 'and must still be audited');

  const html = read('apps/pos/public/stock-count/index.html');
  const script = read('apps/pos/public/stock-count/app.js');
  assert.match(html, /id="btn-discard"/, 'the screen needs a discard control');
  assert.match(script, /\/discard'/, 'the screen must actually call the route');
  assert.match(script, /body: \{ reason: reason \}/, 'a reason is required, because the server requires one and it is audited');
  assert.match(html, /id="discard-reason"/, 'and the operator must be able to type it');
  // The confirmation is a <dialog>, not a native window.prompt. The repository forbids native
  // prompts on operator surfaces for a reason: a native dialog cannot be styled and cannot be
  // asserted by a test, and this screen is held at arm's length in a warehouse.
  assert.match(html, /<dialog id="discard-confirm"/, 'the confirmation must be an in-page dialog');
  assert.doesNotMatch(script, /\bwindow\.(?:prompt|confirm|alert)\s*\(/, 'no native browser prompt on this screen either');
  // Discarding must clear local state, or the device keeps showing lines that no longer exist.
  assert.match(script, /draft = null;[\s\S]{0,80}lines = \[\]/, 'discarding must clear the local draft and lines');
});

// ---------------------------------------------------------------------------
// The decision this work did NOT make.
// ---------------------------------------------------------------------------

test('no update path was added to a committed purchase document', () => {
  // This is the part worth pinning, because it looks like an omission and is not.
  //
  // A purchase order is created APPROVED and nothing moves it back to a draft, and a goods receipt is
  // created directly into inspection. Adding a PATCH to either would either be dead code or would let
  // someone rewrite a commitment that a supplier or an inspection record already points at. The
  // editable document is the PurchaseRequest, which carries a real DRAFT stage and its own guard.
  // This assertion fails if someone "fixes" the missing update by adding one anyway.
  assert.doesNotMatch(poController, /@Patch\('?:id'?\)/, 'a PO must not gain a PATCH: it is created APPROVED and its quantities are what a supplier is paid against');
  assert.doesNotMatch(read('apps/api/src/goods-receipts/goods-receipts.controller.ts'), /@Patch\('?:id'?\)/,
    'a goods receipt must not gain a PATCH: it is created under inspection and its lines are referenced by the inspection');
  // And the document that IS editable says so explicitly, so the pattern is discoverable.
  assert.match(read('apps/api/src/purchase-orders/purchase-requests.service.ts'), /'DRAFT'/,
    'the editable document is the PurchaseRequest, which does have a DRAFT stage');
});
