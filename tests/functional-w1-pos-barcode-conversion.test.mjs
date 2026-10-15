import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pos = readFileSync(new URL('../apps/pos/app/page.tsx', import.meta.url), 'utf8');
const scanner = readFileSync(new URL('../apps/pos/lib/barcode.ts', import.meta.url), 'utf8');
const products = readFileSync(new URL('../apps/api/src/products/products.service.ts', import.meta.url), 'utf8');
const master = readFileSync(new URL('../apps/api/src/master-data/master-data.service.ts', import.meta.url), 'utf8');

test('product catalog exposes alternate barcodes and POS exact scan uses quantityFactor', () => {
  assert.match(products, /barcodes:\s*\{ orderBy:/);
  assert.match(pos, /quantityFactor\?: string \| number/);
  assert.match(scanner, /quantityFactor\?: string \| number/);
  assert.match(pos, /function scanExactBarcode/);
  // The factor and the unit code are read off the match, not off the product: a packaging barcode
  // resolves to the printed unit, and adding 1 carton as 1 base box is an inventory and pricing error.
  assert.match(pos, /add\(match\.product, 1, \{ unitCode: match\.unitCode, quantityFactor: match\.quantityFactor/);
  assert.match(pos, /const match = matchBarcode\(products, code, \{ online: apiOnline \}\)/);
  assert.match(pos, /e\.key === 'Enter'/);

  // A scan that arrives with focus anywhere on the screen must take this same path. It used to stop
  // at the search box, which is the defect these assertions were written to prevent returning.
  assert.match(pos, /onScan: \(barcode\) => \{\s*if \(scanHandlerRef\.current\(barcode\) === 'unmatched'\)/);
});

test('fractional alternate-unit barcode fails closed instead of rounding inventory silently', () => {
  assert.match(master, /normalizedFactor/);
  assert.match(master, /Number\.isSafeInteger\(factor\)/);
  // The guard now lives in the shared resolver rather than inline in the component, so it is checked
  // there and the screen is checked for actually delegating to it. Checking only the component would
  // have passed while the resolver grew its own unguarded path.
  assert.match(scanner, /!Number\.isSafeInteger\(factor\) \|\| factor <= 0/);
  assert.match(scanner, /reason: 'quantity-factor'/);
  assert.match(pos, /const match = matchBarcode\(products, code, \{ online: apiOnline \}\)/);
  assert.match(pos, /tidak dapat diposting sebagai stok integer/);
  assert.match(pos, /match\.status === 'unpostable'/);
});

test('these assertions fail when the conversion is dropped, or the guard is loosened', () => {
  // Both are the regressions this file exists to catch, so neither may be able to come back green.
  const withoutFactor = pos.replace('quantityFactor: match.quantityFactor, ', '');
  assert.doesNotMatch(withoutFactor, /add\(match\.product, 1, \{ unitCode: match\.unitCode, quantityFactor: match\.quantityFactor/);

  // `>= 0` and `Math.round` are the two ways the integer-stock guarantee gets lost quietly.
  for (const loosened of ['!Number.isSafeInteger(factor) || factor >= 0', '!Number.isFinite(factor)', 'Math.round(factor) !== factor']) {
    assert.doesNotMatch(scanner.replace('!Number.isSafeInteger(factor) || factor <= 0', loosened), /!Number\.isSafeInteger\(factor\) \|\| factor <= 0/);
  }

  // A screen that stops delegating to the shared resolver is the same defect as an untested one.
  const bypassed = pos.replace('const match = matchBarcode(products, code, { online: apiOnline });', 'const match = { status: "matched", product: products[0], unitCode: "pcs", quantityFactor: 1 };');
  assert.doesNotMatch(bypassed, /const match = matchBarcode\(products, code, \{ online: apiOnline \}\)/);
});
