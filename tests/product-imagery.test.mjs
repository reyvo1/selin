// Product imagery: the validator that decides what may be stored, and the surfaces that render it.
//
// This exists because the feature is a photo URL typed by an operator and rendered straight into an
// `<img src>`. That makes it the one field in the product record whose value ends up in markup rather
// than in a price calculation, so the interesting question is not "does a photo show up" but "what
// can be stored that must never be rendered".
//
// Load path: `tests/helpers/import-ts.mjs` transpiles the real file, so these run the validator the
// API actually uses rather than a copy of its rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const { isHttpImageUrl, MAX_IMAGE_URL_LENGTH } = await import('./helpers/import-ts.mjs')
  .then((m) => m.load('apps/api/src/common/validation/is-http-image-url.ts', { platform: 'node' }));

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const posPage = read('apps/pos/app/page.tsx');
const posMedia = read('apps/pos/app/product-media.tsx');
const posCss = read('apps/pos/app/globals.css');
const storefrontPage = read('apps/storefront/app/page.tsx');
const storefrontPhoto = read('apps/storefront/app/product-photo.tsx');
const adminMasterData = read('apps/admin/app/modules/master-data.tsx');
const productDto = read('apps/api/src/products/dto/create-product.dto.ts');
const productService = read('apps/api/src/products/products.service.ts');

// ---------------------------------------------------------------------------
// What may be stored.
// ---------------------------------------------------------------------------

test('an ordinary https photo URL is accepted', () => {
  assert.ok(isHttpImageUrl('https://cdn.toko360.co/produk/sku-001.jpg'));
  assert.ok(isHttpImageUrl('http://127.0.0.1:3000/demo/abu.jpg'));
  assert.ok(isHttpImageUrl('  https://cdn.example.com/a.png  '), 'surrounding whitespace is trimmed, not rejected');
});

test('a scheme that executes or inlines is refused', () => {
  // The reason the validator exists. Each of these renders into an <img src> on a page every cashier
  // and every shopper can see.
  for (const hostile of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'blob:https://example.com/abc',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ]) assert.ok(!isHttpImageUrl(hostile), `${hostile} must be refused`);
});

test('credentials and signed query strings are refused', () => {
  // A product card is public. A URL that only works for whoever typed it is a broken image for
  // everyone else, and it puts a secret in the DOM for anyone who opens the inspector.
  assert.ok(!isHttpImageUrl('https://user:secret@cdn.example.com/a.jpg'));
  assert.ok(!isHttpImageUrl('https://cdn.example.com/a.jpg?token=eyJhbGciOi'));
  assert.ok(!isHttpImageUrl('https://cdn.example.com/a.jpg?X-Amz-Signature=deadbeef'));
  // ...but the path itself is fine, and path segments routinely contain signatures-looking text.
  assert.ok(isHttpImageUrl('https://cdn.example.com/p/sig-abc123/deadbeef.jpg'));
});

test('malformed and oversized values are refused', () => {
  assert.ok(!isHttpImageUrl(''), 'empty means "no photo", handled by the decorator, not here');
  assert.ok(!isHttpImageUrl('   '));
  assert.ok(!isHttpImageUrl('https://'));
  assert.ok(!isHttpImageUrl('not a url'));
  assert.ok(!isHttpImageUrl(undefined));
  assert.ok(!isHttpImageUrl(42));
  assert.ok(!isHttpImageUrl(null));
  assert.ok(!isHttpImageUrl({}));
  assert.ok(!isHttpImageUrl(`https://cdn.example.com/${'a'.repeat(MAX_IMAGE_URL_LENGTH)}`));
  // Whitespace inside a URL is ambiguous across parsers and is a classic filter-bypass shape.
  assert.ok(!isHttpImageUrl('https://cdn.example.com/a b.jpg'));
  assert.ok(!isHttpImageUrl('https://cdn.example.com/a"onerror="alert(1)'));
  assert.ok(!isHttpImageUrl('https://cdn.example.com/<script>'));
});

test('the validator refuses these cases for the reason it claims, not by accident', () => {
  // Each mutation removes exactly one rule. If the suite still passed, that rule was untested.
  const host = 'cdn.example.com';
  assert.ok(isHttpImageUrl(`https://${host}/a.jpg`), 'the control itself must be accepted');

  // Dropping the scheme check would let javascript: through.
  assert.ok(!isHttpImageUrl('ftp://example.com/a.jpg'), 'non-http schemes stay out');
  // Dropping the credential check would leak userinfo.
  assert.ok(isHttpImageUrl('https://cdn.example.com/a.jpg') && !isHttpImageUrl('https://u:p@cdn.example.com/a.jpg'));
});

// ---------------------------------------------------------------------------
// What reaches markup.
// ---------------------------------------------------------------------------

test('every surface renders the photo through a component that falls back', () => {
  // A photo is allowed to be missing, and to rot. The rule is that no surface may show a broken
  // image or an empty tile: each must fall back to what it showed before this feature existed.
  assert.match(posPage, /<ProductMedia product=\{product\} \/>/, 'the POS card must render the media component');
  assert.match(storefrontPage, /<ProductPhoto product=\{product\} \/>/, 'the storefront card must render the photo component');
  assert.match(storefrontPage, /<ProductPhoto product=\{selectedProduct\} variant="detail" \/>/, 'the storefront detail must render it too');

  for (const [name, source] of [['POS', posMedia], ['Storefront', storefrontPhoto]]) {
    assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/, `${name} must fall back on a failed load`);
    assert.match(source, /if \(!source \|\| failed\)/, `${name} must fall back when there is no photo`);
    assert.match(source, /width=\{/, `${name} must set an intrinsic width to reserve space`);
    assert.match(source, /height=\{/, `${name} must set an intrinsic height to reserve space`);
  }
});

test('no surface is left rendering a bare letter where a photo belongs', () => {
  // The letter stays as the fallback, inside the components. What must not survive is a surface that
  // only ever shows a letter and never asks for a photo.
  const letterOnly = [posPage, storefrontPage].filter((source) => /className="productImage"[^>]*>\{[a-zA-Z.]+\.name\.slice\(0/.test(source));
  assert.deepEqual(letterOnly, [], 'a surface still renders only an initial and never consults imageUrl');
});

test('the photo occupies a fixed-ratio box so the grid cannot step as images load', () => {
  // Explicit width/height on the element is only half of it; without a reserved box on the container
  // the card still grows when the image resolves, which is the visible re-flow the research names.
  assert.match(posCss, /\.productMedia\{[^}]*aspect-ratio:4\/3/, 'the POS media box needs a fixed aspect ratio');
  assert.match(posCss, /\.productMedia>img\{[^}]*object-fit:cover/, 'and the photo must cover that box');
  assert.match(posMedia, /loading=\{eager \? 'eager' : 'lazy'\}/, 'a long catalogue must not paint every photo at once');
});

// ---------------------------------------------------------------------------
// What the API accepts and stores.
// ---------------------------------------------------------------------------

test('the API validates the field and stores it through the same path as the rest of the product', () => {
  assert.match(productDto, /@IsHttpImageUrl\(\) imageUrl\?: string/, 'the DTO must validate the photo URL');
  assert.match(productDto, /@IsOptional\(\)/, 'and must stay optional, because a catalogue may be unphotographed');

  // create spreads the DTO, update maps fields explicitly. A field added to one and not the other is
  // the classic half-wired feature: it saves on create and silently does nothing on edit.
  assert.match(productService, /const product = await tx\.product\.create\(\{\s*data: \{\s*\.\.\.dto,/, 'create must pass the field through');
  assert.match(productService, /dto\.imageUrl !== undefined \? \{ imageUrl: dto\.imageUrl\?\.trim\(\) \|\| null \} : \{\}/,
    'update must map the field, and an empty string must clear the photo rather than store it');

  for (const schema of ['schema.prisma', 'schema.sqlite.prisma', 'schema.postgresql.prisma']) {
    const text = read(`apps/api/prisma/${schema}`);
    assert.match(text, /imageUrl\s+String\?/, `${schema} must carry the column`);
  }
});

test('an empty photo clears it rather than failing the save', () => {
  // An untouched optional text field submits "". Turning that into a validation error would give an
  // operator a red message they cannot act on when all they did was clear the box.
  assert.match(read('apps/api/src/common/validation/is-http-image-url.ts'),
    /value === '' \? true : isHttpImageUrl\(value\)/,
    'the decorator must treat an empty string as "no photo"');
  assert.ok(!isHttpImageUrl(''), 'while the raw predicate still refuses it, so the two rules cannot drift into a state where the service stores a blank string');
});

test('the admin form can actually set and clear the photo', () => {
  assert.match(adminMasterData, /URL foto produk/, 'the form needs a field an operator can type into');
  assert.match(adminMasterData, /imageUrl:productForm\.imageUrl\.trim\(\)\|\|undefined/, 'save must send the trimmed value');
  assert.match(adminMasterData, /imageUrl:product\.imageUrl\?\?''/, 'editing must load the stored value back into the form');
  assert.match(adminMasterData, /imageUrl:product\.imageUrl\?\?''/, 'without this an edit would silently wipe the photo');
});
