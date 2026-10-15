// Two POS defects that are invisible to every other gate, and both of which shipped.
//
// 1. SCANNING OUTSIDE THE SEARCH BOX DID NOT ADD AN ITEM. The global listener recognised a scan and
//    then only wrote the code into the search box. The cashier had to press Enter a second time, on a
//    surface that was not the one they were scanning into — which is precisely the flow the listener
//    was added to remove. `scanExactBarcode` had exactly one call site, the search input.
//
// 2. CLASSES IN THE JSX WITH NO RULE ANYWHERE. A class name is not a style. One rendered as a
//    bulleted <ul>, one as an overflowing <pre>, and the sync icon's busy class had no animation at
//    all because the stylesheet contained zero @keyframes — so the one indicator that told a cashier
//    a minutes-long offline sync was running never moved.
//
// The class-coverage check below is MEASURED, not curated. Earlier findings in this repo were closed
// with allow-lists of expected class names, which cannot fail when a new class is added and so prove
// nothing. Here a token is accepted only if a rule for it exists in globals.css, or if Tailwind
// itself generates it — decided by running the project's own Tailwind compiler over the token, not
// by a regex guessing which names "look like" utilities. A class that satisfies neither is reported
// with the JSX line that introduced it.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const { matchBarcode } = await import('./helpers/import-ts.mjs').then((m) => m.load('apps/pos/lib/barcode.ts'));
const ts = (await import('typescript')).default;

const POS_APP = path.join(ROOT, 'apps/pos/app');
const pageSource = fs.readFileSync(path.join(POS_APP, 'page.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(POS_APP, 'globals.css'), 'utf8');

// ---------------------------------------------------------------------------
// Part 1 — the scan decision, executed.
// ---------------------------------------------------------------------------

const baseProduct = { id: 'p1', name: 'Indomie Goreng', unit: 'pcs', barcode: '8991002101015', salePrice: '3500', barcodes: [] };
const packProduct = {
  id: 'p2', name: 'Susu UHT', unit: 'box', barcode: null, salePrice: '18000',
  barcodes: [{ code: '8997223771019', unitCode: 'PCS', quantityFactor: '12', productUnitId: 'u1', variantId: 'v1' }],
};

test('a scanned base barcode resolves to its product at factor 1', () => {
  const match = matchBarcode([baseProduct], '8991002101015', { online: true });
  assert.equal(match.status, 'matched');
  assert.equal(match.product.id, 'p1');
  assert.equal(match.quantityFactor, 1);
  assert.equal(match.unitCode, 'pcs');
});

test('a packaging barcode resolves to the printed unit, not the base unit', () => {
  // The defect this guards is real money: adding 1 carton as 1 base box would post 12 units of stock
  // as 1 and under-charge the customer by the difference.
  const match = matchBarcode([packProduct], '8997223771019', { online: true });
  assert.equal(match.status, 'matched');
  assert.equal(match.unitCode, 'PCS');
  assert.equal(match.quantityFactor, 12);
  assert.equal(match.productUnitId, 'u1');
  assert.equal(match.variantId, 'v1');
});

test('a code that matches nothing is unmatched, and surrounding whitespace is not part of it', () => {
  assert.equal(matchBarcode([baseProduct], '  8991002101015  ', { online: true }).status, 'matched');
  assert.equal(matchBarcode([baseProduct], '0000000000000', { online: true }).status, 'unmatched');
  assert.equal(matchBarcode([baseProduct], '   ', { online: true }).status, 'unmatched');
});

test('a factor that cannot be posted as integer stock is refused, not rounded', () => {
  // These are the negative controls that make the guard above meaningful. A `>= 0` instead of `> 0`,
  // or a `Math.round` instead of a refusal, would silently post fractional stock.
  for (const quantityFactor of ['0', '-1', '1.5', 'NaN', 'Infinity']) {
    const product = { ...packProduct, barcodes: [{ code: '8997223771019', unitCode: 'PCS', quantityFactor }] };
    const match = matchBarcode([product], '8997223771019', { online: true });
    assert.equal(match.status, 'unpostable', `factor ${quantityFactor} must be refused`);
    assert.equal(match.reason, 'quantity-factor', `factor ${quantityFactor} must refuse for the right reason`);
  }
});

test('offline, a packaging barcode is refused because its conversion only exists on the server', () => {
  const offline = { online: false };
  assert.equal(matchBarcode([packProduct], '8997223771019', offline).status, 'unpostable');
  assert.equal(matchBarcode([packProduct], '8997223771019', offline).reason, 'offline-packaging');
  // A base-unit scan carries no server authority, so an offline till must still be able to sell it.
  assert.equal(matchBarcode([baseProduct], '8991002101015', offline).status, 'matched');
});

test('a packaging entry wins when the same code is both the primary and an alternate barcode', () => {
  // Pinned deliberately rather than decided here. When a product's own barcode is ALSO listed as a
  // packaging barcode, this resolves as the packaging one, which is what the screen has always done.
  // The alternative reading — treat a printed base barcode as factor 1 — is defensible, but changing
  // it would alter which unit stock is drawn for existing master data, so it is Finance's call and
  // is raised in the work item rather than silently applied. What must not happen is the two entry
  // points disagreeing, which is why both now route through this one function.
  const both = { ...baseProduct, barcodes: [{ code: '8991002101015', quantityFactor: '6' }] };
  const match = matchBarcode([both], '8991002101015', { online: true });
  assert.equal(match.status, 'matched');
  assert.equal(match.quantityFactor, 6);
});

// ---------------------------------------------------------------------------
// Part 2 — the wiring, which no runtime test can reach.
// ---------------------------------------------------------------------------

/**
 * Would a scan be committed, or only displayed?
 *
 * Source-level because the defect lived in a React effect: the only way to prove it is to read the
 * handler. Returns the reason it would fail, or null when the screen commits.
 */
function scanCommitDefect(source) {
  const handler = source.match(/onScan: \(barcode\) => \{([\s\S]*?)\n {4}\},/);
  if (!handler) return 'there is no onScan handler, so a scan outside the search box does nothing at all';
  const body = handler[1];
  if (!/scanHandlerRef\.current\(barcode\)/.test(body)) {
    return 'onScan does not call the commit path; it only writes the code into the search box, which is the defect this work item closed';
  }
  if (!/setSearch\(barcode\)/.test(body)) {
    return 'a code that matches nothing is dropped instead of left visible, so a cashier cannot see what failed';
  }
  if (!/useEffect\(\(\) => \{ scanHandlerRef\.current = scanExactBarcode; \}\)/.test(source)) {
    return 'the ref is never refreshed, so the once-registered listener commits against the first render\'s empty catalog and every real barcode reads as unknown';
  }
  if (!/const match = matchBarcode\(products, code, \{ online: apiOnline \}\)/.test(source)) {
    return 'scanExactBarcode no longer delegates the unit/online decision to matchBarcode, so the tested decision is not the one the screen uses';
  }
  if (!/function scanExactBarcode\(raw: string\): 'added' \| 'blocked' \| 'unmatched'/.test(source)) {
    return 'scanExactBarcode no longer reports what it did, so a caller cannot fall back on an unmatched code';
  }
  if (!/onKeyDown=\{\(e\) => \{ if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); scanExactBarcode\(search\); \} \}\}/.test(source)) {
    return 'the search box no longer routes through the shared commit path';
  }
  return null;
}

test('a scan anywhere on the screen commits the item, and both entry points share one path', () => {
  assert.equal(scanCommitDefect(pageSource), null);
  // Exactly one commit path. A second one is how the two callers drift into different answers.
  const commitPaths = pageSource.match(/add\(match\.product, 1, \{ unitCode: match\.unitCode/g) ?? [];
  assert.equal(commitPaths.length, 1, 'the cart must be fed from one place, not one per caller');
});

test('the scan-commit detector fails on the defect it was written for', () => {
  // The pre-fix handler: recognised the scan, filled the box, added nothing.
  const preFix = pageSource.replace('if (scanHandlerRef.current(barcode) === \'unmatched\') {', 'if (true) {');
  assert.match(scanCommitDefect(preFix), /does not call the commit path/);

  // The subtler regression: a working commit path reached through a ref that is set once at mount,
  // which is the stale-closure trap and looks correct in review.
  const staleRef = pageSource.replace('useEffect(() => { scanHandlerRef.current = scanExactBarcode; });', '');
  assert.match(scanCommitDefect(staleRef), /never refreshed/);

  // The lossy fix: commit, but swallow a code that matched nothing.
  const silentDrop = pageSource.replace('setSearch(barcode);', '');
  assert.match(scanCommitDefect(silentDrop), /dropped instead of left visible/);

  // The split-brain fix: the screen commits a path the tests do not exercise.
  const untestedPath = pageSource.replace('const match = matchBarcode(products, code, { online: apiOnline });', 'const match = { status: "unmatched" };');
  assert.match(scanCommitDefect(untestedPath), /no longer delegates/);
});

// ---------------------------------------------------------------------------
// Part 3 — measured class coverage.
// ---------------------------------------------------------------------------

/**
 * Class-name tokens the JSX puts on an element, with the line that introduced each.
 *
 * Parsed with the TypeScript compiler rather than by regex, because the regex version was wrong in
 * two ways that matter. It matched text inside expressions — `message.includes('berhasil')` inside a
 * template literal contributed `includes('berhasil'))` as a "class" — and it could not see a token
 * assembled across a conditional. Only static string positions are collected; an expression with no
 * static text (an interpolated variable) contributes nothing rather than a guess.
 */
function jsxClassTokens(source) {
  const found = new Map();
  const file = ts.createSourceFile('pos.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const add = (text, line) => {
    for (const token of text.split(/\s+/)) {
      if (!token) continue;
      if (!found.has(token)) found.set(token, line);
    }
  };
  const collect = (node, line) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return add(node.text, line);
    if (ts.isJsxExpression(node)) return collect(node.expression, line);
    if (ts.isTemplateExpression(node)) {
      add(node.head.text, line);
      for (const span of node.templateSpans) {
        add(span.literal.text, line);
        // `${ok ? 'a' : 'b'}` contributes classes too; reading only the literal text misses them.
        collect(span.expression, line);
      }
      return undefined;
    }
    // A conditional picks one of two class strings; both are real and either may render.
    if (ts.isConditionalExpression(node)) {
      collect(node.whenTrue, line);
      collect(node.whenFalse, line);
      return undefined;
    }
    if (ts.isParenthesizedExpression(node)) return collect(node.expression, line);
    return undefined;
  };

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === 'className') {
      collect(node.initializer, file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/**
 * Tokens that have a rule in the stylesheet, read from the selectors themselves.
 *
 * Comments and `@apply` argument lists are removed first, and both matter. A class named in a
 * comment is not styled, and `@apply text-xs` is a Tailwind utility being consumed, not a selector
 * that styles anything — counting either would hide the exact gap this gate exists to find.
 */
function styledTokens(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const selectorsOnly = withoutComments.replace(/@apply\s+[^;]+;/g, ' ');
  const tokens = new Set();
  for (const match of selectorsOnly.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) tokens.add(match[1]);
  return tokens;
}

/**
 * Does Tailwind emit a rule for this candidate?
 *
 * Tailwind escapes every character outside `[A-Za-z0-9_-]` in the selector it writes, so
 * `lg:flex-row` ships as `.lg\:flex-row` and `max-w-[1720px]` as `.max-w-\[1720px\]`. Matching is
 * done on the escaped string rather than through a RegExp, because the two escaping layers compose
 * badly: a regex has to emit `\\\[` to match a literal backslash followed by a literal bracket, and
 * getting that one level wrong turns `[1720px\\]` into a character class that matches nothing —
 * which is exactly how the earlier version reported nine real utilities as unstyled.
 *
 * The trailing check rejects a prefix match, so a candidate named `text-sm` cannot be certified by
 * `text-sm/6` alone. A following backslash counts as part of the identifier too, since that is how
 * Tailwind continues an escaped name.
 */
function tailwindMatcher(generated) {
  return (token) => {
    const needle = `.${Array.from(token).map((character) => (/[A-Za-z0-9_-]/.test(character) ? character : `\\${character}`)).join('')}`;
    const at = generated.indexOf(needle);
    if (at === -1) return false;
    const next = generated[at + needle.length] ?? ' ';
    return !/[\w\\-]/.test(next);
  };
}

/**
 * Run the coverage measurement over a set of JSX sources and a stylesheet.
 *
 * Split out from the test so the negative controls below can drive the real measurement over
 * synthetic input. A guard whose own failure modes are untested is the thing this repo has been
 * closing findings about, so the fixture path is part of the gate rather than a copy of it.
 */
async function measureClassCoverage(sources, css) {
  const used = new Map();
  for (const { name, source } of sources) {
    for (const [token, line] of jsxClassTokens(source)) {
      if (!used.has(token)) used.set(token, `${name}:${line}`);
    }
  }

  const styled = styledTokens(css);

  // Tailwind decides its own vocabulary. Running the project's compiler is the only answer that
  // cannot drift from what actually ships: `srOnly` is a component class while `sr-only` is a
  // utility, `bg-current/5` and `max-w-[1720px]` are utilities that no name-shape regex gets right,
  // and a Tailwind upgrade can change the answer for any of them.
  let compile;
  try {
    ({ compile } = await import('tailwindcss'));
  } catch (error) {
    assert.fail(`tailwindcss could not be loaded, so class coverage cannot be measured and this gate must not pass silently: ${error.message}`);
  }
  const stylesheet = fs.readFileSync(new URL('../index.css', import.meta.resolve('tailwindcss')), 'utf8');
  const compiler = await compile('@import "tailwindcss";', {
    base: POS_APP,
    loadStylesheet: async () => ({ base: 'tailwindcss', content: stylesheet }),
  });
  const isUtility = tailwindMatcher(compiler.build([...used.keys()]));

  return {
    used,
    unstyled: [...used.entries()].filter(([token]) => !styled.has(token) && !isUtility(token)).map(([token, where]) => `${token} (${where})`),
  };
}

test('every class in the POS JSX is styled by the stylesheet or generated by Tailwind', async () => {
  const sources = fs.readdirSync(POS_APP)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => ({ name, source: fs.readFileSync(path.join(POS_APP, name), 'utf8') }));

  const { used, unstyled } = await measureClassCoverage(sources, cssSource);

  assert.deepEqual(unstyled, [], `these classes are used in the POS JSX but no rule styles them, so they render as browser defaults:\n  ${unstyled.join('\n  ')}`);
  // Guards against the opposite failure: an extractor that matches nothing passes this test vacuously.
  assert.ok(used.size > 50, `the extractor found only ${used.size} class tokens, which cannot be right`);
});

test('the class-coverage gate reports a class that nothing styles, and says where it came from', async () => {
  // The end-to-end failure this gate exists to catch: a name in the JSX with no rule anywhere.
  const fixture = [{ name: 'fixture.tsx', source: 'export const A = () => <div className="knownThing rawBrowserDefault" />;' }];
  const { unstyled } = await measureClassCoverage(fixture, '.knownThing{color:red}');
  assert.deepEqual(unstyled, ['rawBrowserDefault (fixture.tsx:1)']);

  // A Tailwind utility in the same position is accepted, proving the fixture is not failing for an
  // unrelated reason such as an unreachable compiler.
  const withUtility = [{ name: 'fixture.tsx', source: 'export const A = () => <div className="rawBrowserDefault lg:flex-row" />;' }];
  assert.deepEqual((await measureClassCoverage(withUtility, '.knownThing{color:red}')).unstyled, ['rawBrowserDefault (fixture.tsx:1)']);
});

test('the extractor reads class attributes, not arbitrary strings inside them', () => {
  // Both of these were real defects while this gate was being written, and both make it fail for
  // the wrong reason: the first invents classes that do not exist, the second misses ones that do.
  const expression = [...jsxClassTokens('const A = () => <p className={`notice ${ok ? "on" : "off"} ${message.includes(\'berhasil\') ? "good" : "bad"}`} />;')].map(([token]) => token);
  assert.deepEqual(expression.sort(), ['bad', 'good', 'notice', 'off', 'on']);

  // `@apply` consumes a utility, it does not style anything, and a comment is not a selector.
  // Counting either would mark a genuinely unstyled class as covered.
  const styled = styledTokens('/* .mentionedInAComment */ .real{@apply text-xs flex;}');
  assert.ok(styled.has('real'));
  assert.ok(!styled.has('mentionedInAComment'), 'a class named only in a comment is not styled');
  assert.ok(!styled.has('text-xs'), '@apply arguments are consumed utilities, not selectors');
});

test('Tailwind matching handles the escapes it actually writes', () => {
  const isUtility = tailwindMatcher('.max-w-\\[1720px\\] {}\n.lg\\:flex-row {}\n.text-sm\\/6 {}');
  for (const token of ['max-w-[1720px]', 'lg:flex-row', 'text-sm/6']) assert.ok(isUtility(token), `${token} must be recognised`);
  // A prefix match is not a match: `text-sm` is not certified by `text-sm/6` alone.
  assert.ok(!tailwindMatcher('.text-sm\\/6 {}')('text-sm'));
  assert.ok(!isUtility('chip'), 'a component class is not a Tailwind utility');
});

test('the styling that fixes the reported defects cannot be silently reverted', () => {
  // The split-payment rows overlapped because `.summary>div` is a flex row and the tender list is a
  // direct child of it, so the tenders laid out horizontally across the cart. The exclusion is the fix.
  assert.match(cssSource, /\.summary>div:not\(\.splitPayments\):not\(\.approvalHint\)\{@apply flex items-center justify-between gap-3;\}/,
    'the split-payment and approval-hint blocks must stay stacked inside .summary');
  // ModalPortal renders into <body>, so every .posWorkspaceBody rule misses it: without these the
  // supervisor PIN and Click & Collect dialogs ship with default labels and unstyled buttons.
  assert.match(cssSource, /\.modalCard button:not\(\[class\]\)\{/, 'modal action buttons must be styled');
  assert.match(cssSource, /\.modalCard label\{/, 'modal field labels must be styled');
  // A busy indicator that cannot animate is worse than none: it looks broken on purpose.
  assert.match(cssSource, /\.spin\{animation:pos-spin/, 'the sync busy indicator must animate');
  assert.match(cssSource, /@keyframes pos-spin\{/, 'and the animation it names must be defined');

  // The PPOB form's heading had no rule anywhere, so it rendered at the browser default size inside a
  // styled panel. The assertion is on the heading rule specifically rather than on the token existing:
  // this file already shipped a `.formStack{gap:…}` that was dead, outranked by
  // `.posWorkspaceBody form:not(.inlineForm)`, and a token-exists check passed over it happily.
  assert.match(cssSource, /^\.formStack>h2\{/m, 'the PPOB form heading must be styled');
  // And the dead declaration must stay gone rather than return as reassurance that the class is handled.
  assert.doesNotMatch(cssSource, /^\.formStack\{/m,
    '.formStack must not declare a bare gap: the form:not(.inlineForm) rule outranks it, so it would be dead code');
});
