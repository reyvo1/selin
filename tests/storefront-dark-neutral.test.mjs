// Storefront dark mode must read neutral, not green.
//
// A shopper reported the dark theme as "menghijau": every dark surface was an
// emerald-tinted literal (#101c18, #0a1511, #0b1713, ...), so the whole page sat
// in a green cast. The fix moves dark surfaces to the neutral slate tokens
// (--sf-surface / --sf-border / --sf-text) and reserves emerald for accents
// (active nav, badges, focus, hover glow). This test pins that split: no
// green-tinted literal may appear inside a dark-theme rule, while the emerald
// accent must still exist so a future edit cannot "fix" the cast by deleting
// the brand colour entirely.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const css = fs.readFileSync(path.join(ROOT, 'apps/storefront/app/globals.css'), 'utf8');

const BANNED_IN_DARK = [
  '#101c18', '#0a1511', '#0b1713', '#13211c', '#123126', '#050a08',
  '#20362f', '#294038', '#355249', '#2c473e', '#9fb0aa', '#8fa39a',
  '7,17,14', '10,21,17',
];

const darkLines = css.split('\n').filter((line) => line.includes("[data-theme='dark']"));

test('dark rules exist and cover the shell', () => {
  assert.ok(darkLines.length > 0, 'expected dark-theme rules in storefront globals.css');
  assert.ok(
    darkLines.some((line) => line.includes('.storefrontV4[')),
    'expected a dark shell rule',
  );
});

test('no green-tinted literal inside dark-theme rules', () => {
  for (const literal of BANNED_IN_DARK) {
    const offenders = darkLines.filter((line) => line.includes(literal));
    assert.equal(offenders.length, 0, `dark rule still carries green cast ${literal}`);
  }
});

test('dark shell has no emerald radial glow', () => {
  const shell = darkLines.filter((line) => line.includes('.storefrontV4[data-theme'));
  assert.ok(shell.length > 0);
  for (const line of shell) {
    assert.ok(!line.includes('16,185,129'), 'dark shell must not glow emerald');
  }
});

test('emerald survives as accent, not as surface', () => {
  assert.ok(css.includes('--sf-accent:#34d399'), 'expected the emerald accent token');
  assert.ok(
    darkLines.some((line) => line.includes('#064e3b')),
    'expected an emerald active/accent state in dark mode',
  );
});
