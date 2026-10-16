import fs from 'node:fs';
import path from 'node:path';

/**
 * A-17 endpoint coverage.
 *
 * Finding A-17 says the repository cannot answer "which backend endpoint can
 * no user actually reach?", because the only frontend/backend audit it owns
 * answers a different question. config/f1-backend-ui-audit.json computes
 * controllerExposure from `routeStrings.some(...)` against a raw substring of
 * the app's whole source, so a controller whose single route is mentioned once
 * is reported EXPOSED_OR_PARTIAL while the rest of its routes are dead. The
 * measurement is real but its granularity is the controller, and an endpoint
 * is not a controller.
 *
 * Measured on 2026-10-15 across 45 controllers: 34 controllers are uniformly
 * reachable, 1 is uniformly unreachable, and 10 are MIXED - some endpoints
 * reachable from a UI app, some not. The mixed ones are the interesting ones,
 * because a uniformly unreachable controller is a normal API-only surface
 * (webhooks, node protocol, device ingest) while a mixed controller proves the
 * audience is already on screen: the product ships a route to this audience on
 * this controller, and then does not ship its sibling.
 *
 * So the rule is sibling inconsistency, not raw absence:
 *
 *   an endpoint is FLAGGED when no UI app reaches it AND at least one sibling
 *   endpoint in the same controller file IS reached.
 *
 * That second clause is what makes the rule derived instead of curated. There
 * is no list of "endpoints that ought to be reachable"; reachability is read
 * from source, and the expectation is read from the controller the endpoint
 * already lives in. A new API-only module contributes no flagged endpoint
 * until somebody ships one route of it to a UI, and then every route it shares
 * that audience with is held to the same standard.
 *
 * Two reachability shapes are recognised, because one of them decided whether
 * this control reports truthfully:
 *
 *   exact      a UI path token normalises to the same param-normalised path.
 *   assembled  some single source line carries a token that is a segment-wise
 *              PREFIX of the route and another that is a segment-wise SUFFIX,
 *              and together they cover every segment.
 *
 * `assembled` exists because a path is often not written as one literal. The
 * payroll approver is `${kind==='tax'?'/payroll/tax-rule-sets':'/payroll/social-security-rule-sets'}/${rule.id}/approve`
 * at apps/admin/app/modules/hr-payroll.tsx:681: no single token there equals
 * `/payroll/tax-rule-sets/:p/approve`, and a control with exact matching only
 * reported both approvers as unreachable while a user was clicking them. A
 * control that reports a live click as dead teaches its reader to ignore it,
 * which is the failure mode this module exists to prevent. The two halves are
 * required to meet on the SAME line so the rule cannot join a prefix in one
 * file to a suffix in another.
 */

const HTTP_METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

/**
 * A path is normalised for comparison only. A query string never changes which
 * route handles a request; `${x}` following a `/` is a real segment and becomes
 * `:p`; `${x}` glued to the previous segment (`automation-jobs${suffix}` where
 * suffix is `?status=..`) opens no segment at all and is dropped - keeping it
 * produced `automation-jobs:p`, which matched nothing and manufactured a gap
 * while hiding a real one.
 */
export function normalizePath(raw) {
  let p = String(raw).split('?')[0].split('#')[0];
  p = p.replace(/(?<=\/)\$\{[^}]*\}/g, ':p');
  p = p.replace(/\$\{[^}]*\}/g, '');
  p = p.replace(/:[A-Za-z0-9_]+/g, ':p');
  p = p.replace(/\/{2,}/g, '/');
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

function segments(normalized) {
  return normalized.split('/').filter(Boolean);
}

function segmentMatches(a, b) {
  return a === b || a === ':p' || b === ':p';
}

/**
 * Segment rule for the `assembled` path only, and it is deliberately stricter
 * than `pathMatches`.
 *
 * In exact matching a param may stand for a literal in either direction: the
 * UI writes `/users/123/edit` while the controller declares
 * `/users/:userId/edit`, and both must be the same route.
 *
 * In assembled matching the same leniency destroyed the rule. Admin's
 * `domainRoute` at apps/admin/app/domain-workspaces.ts:122 is
 * `return \`${workspace.route}/${view.key}\`;`, which yields exactly one token
 * `/:p`. Under two-way leniency that single token matched the first segment of
 * ANY two-segment route as a prefix and its last segment as a suffix, so one
 * line covered eleven unrelated endpoints - branch-continuity, edge-sync,
 * sync, platform - and reported them reachable. A bare `${x}` is not evidence
 * that a route exists; it is evidence that a template interpolated something.
 *
 * So a `:p` token segment covers only a `:p` route segment. A literal token
 * may still cover a `:p` route segment, because that direction is the UI
 * writing a concrete id into a parameterised route.
 */
function assembledSegmentMatches(tokenSegment, routeSegment) {
  if (tokenSegment === ':p') return routeSegment === ':p';
  return routeSegment === ':p' || tokenSegment === routeSegment;
}

function sameSegments(a, b) {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => segmentMatches(seg, b[i]));
}

export function pathMatches(normalizedA, normalizedB) {
  if (normalizedA === normalizedB) return true;
  return sameSegments(segments(normalizedA), segments(normalizedB));
}

/**
 * Exact or same-line assembled reachability of one route against one UI source
 * line's tokens.
 */
export function lineCoversRoute(routeNormalized, lineTokens, { interpolated = false } = {}) {
  const segs = segments(routeNormalized);
  if (!segs.length) return false;
  const covered = new Set();
  for (const token of lineTokens) {
    const t = segments(token);
    if (!t.length || t.length > segs.length) continue;
    if (t.every((seg, i) => assembledSegmentMatches(seg, segs[i]))) {
      for (let i = 0; i < t.length; i += 1) covered.add(i);
    }
    const offset = segs.length - t.length;
    if (t.every((seg, i) => assembledSegmentMatches(seg, segs[offset + i]))) {
      for (let i = 0; i < t.length; i += 1) covered.add(offset + i);
    }
  }
  // An interpolation between two covered runs stands for the segments it skipped, and only those.
  //
  // The restriction to PARAMETER segments is the whole safety argument. `assembledSegmentMatches`
  // already refuses to let `:p` stand for a literal or a literal stand for `:p`, and that rule is
  // what stops one route-building line certifying every endpoint sharing its prefix or suffix. This
  // addition keeps it: a gap may only be closed where the ROUTE itself declares a parameter, so a
  // line can never invent a literal segment of the endpoint. A line that merely mentions two
  // unrelated paths, with no concatenation, is unaffected.
  if (interpolated) {
    for (let i = 0; i < segs.length; i += 1) {
      if (covered.has(i) || !segs[i].startsWith(':')) continue;
      const coveredBefore = [...covered].some((index) => index < i);
      const coveredAfter = [...covered].some((index) => index > i);
      if (coveredBefore && coveredAfter) covered.add(i);
    }
  }
  return covered.size === segs.length;
}

/**
 * Every HTTP route declared by a controller, with the guard that precedes it.
 * Decorators for route i sit between the end of route i-1's match and route
 * i's own match, so the LAST @Roles/@Permissions in that window belongs to
 * route i; taking the first would attribute the previous route's guard here.
 */
export function collectRoutes(rootDir) {
  const routes = [];
  const controllersDir = path.join(rootDir, 'apps', 'api', 'src');
  for (const file of walk(controllersDir)) {
    if (!file.endsWith('.controller.ts')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const base = text.match(/@Controller\(([^)]*)\)/s)?.[1]?.match(/['"]([^'"]+)['"]/)?.[1] ?? '';
    const decl = [...text.matchAll(new RegExp(`@(${HTTP_METHODS.join('|')})\\(([^)]*)\\)`, 'g'))];
    for (let i = 0; i < decl.length; i += 1) {
      const from = i > 0 ? decl[i - 1].index + decl[i - 1][0].length : 0;
      const window = text.slice(from, decl[i].index);
      const roles = [...window.matchAll(/@Roles\(([^)]*)\)/g)].at(-1)?.[1] ?? null;
      const perm = [...window.matchAll(/@Permissions\(([^)]*)\)/g)].at(-1)?.[1] ?? null;
      const sub = decl[i][2].match(/['"]([^'"]*)['"]/)?.[1] ?? '';
      const raw = `/${base.replace(/^\/|\/$/g, '')}/${sub.replace(/^\/|\/$/g, '')}`;
      routes.push({
        file: relative(rootDir, file),
        method: decl[i][1].toUpperCase(),
        raw: raw.replace(/\/{2,}/g, '/'),
        path: normalizePath(raw),
        roles,
        permissions: perm,
      });
    }
  }
  return routes;
}

/**
 * The five storefront/admin/employee UI apps. apps/worker is deliberately out
 * of scope: it is not a frontend and reaches providers, not our HTTP surface.
 *
 * The extension list includes `.dart` because apps/customer-mobile is a Flutter
 * app - three Dart sources under lib/, reaching `/platform/manifest` and
 * `/api/v1/products`. Scanning only TypeScript would have made that app
 * invisible to this control, and an audit that cannot see one of the apps it
 * claims to cover reports its blind spot as a product gap.
 */
export function uiAppNames(rootDir) {
  const appsDir = path.join(rootDir, 'apps');
  return ['admin', 'pos', 'storefront', 'employee-portal', 'customer-mobile']
    .map((name) => ({ name, dir: path.join(appsDir, name) }))
    .filter(({ dir }) => fs.existsSync(dir));
}

/**
 * Path tokens grouped by source line. A line is the unit for `assembled`
 * because a template literal that spans lines is a different expression in the
 * eyes of a reader, and joining across lines would pair unrelated paths.
 */
export function collectUiLines(rootDir) {
  const SEG = String.raw`(?:[A-Za-z0-9_.@-]+|\$\{[^}]*\}|:[A-Za-z0-9_]+)+`;
  // `${...}` must be consumable inside a segment: `automation-jobs${suffix}`
  // has no slash between the literal and the interpolation, and a SEG that
  // could only match whole `${...}` truncated the token to `automation-jobs`.
  const tokenRe = new RegExp(String.raw`(?<![A-Za-z0-9_/.:-])(\/${SEG}(?:\/${SEG})*)(?![A-Za-z0-9_])`, 'g');
  const lines = [];
  const tokens = new Set();
  for (const { dir } of uiAppNames(rootDir)) {
    for (const file of walk(dir)) {
      if (!/\.(ts|tsx|js|jsx|dart)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      text.split('\n').forEach((line, index) => {
        const found = [...line.matchAll(tokenRe)].map((m) => normalizePath(m[1]));
        if (!found.length) return;
        found.forEach((t) => tokens.add(t));
        // A client may build a path by concatenating quoted pieces around an interpolation:
        //   api('/mobile-ops/drafts/' + encodeURIComponent(draft.id) + '/scan')
        // The pieces are two separate tokens and the parameter between them is not a token at all, so
        // the route looked unreachable while the screen was calling it in front of us. This records
        // that the line interpolated something, which `lineCoversRoute` may use to cover PARAMETER
        // segments only. It is deliberately not a licence to cover a literal: see the note there.
        const concatenated = found.length >= 2 && /['"`][^'"`]*['"`]\s*\+\s*[^'"`+;]+\+\s*['"`]/.test(line);
        lines.push({ file: relative(rootDir, file), line: index + 1, tokens: found, interpolated: concatenated });
      });
    }
  }
  return { tokens, lines };
}

export function routeIsReachable(route, ui) {
  for (const token of ui.tokens) {
    if (pathMatches(route.path, token)) return { reachable: true, how: 'exact', via: null };
  }
  for (const entry of ui.lines) {
    if (lineCoversRoute(route.path, entry.tokens, { interpolated: entry.interpolated })) {
      return { reachable: true, how: 'assembled', via: `${entry.file}:${entry.line}` };
    }
  }
  return { reachable: false, how: null, via: null };
}

/**
 * The finding itself: an unreachable endpoint inside a controller that a UI
 * already reaches. `method path` is the identity so two verbs on one path are
 * judged apart - a controller may ship GET and legitimately withhold DELETE.
 */
export function collectSiblingInconsistencies(rootDir) {
  const routes = collectRoutes(rootDir);
  const ui = collectUiLines(rootDir);
  const byFile = new Map();
  // The verdict travels with the route it was computed for. Returning the raw
  // declarations separately leaves `reachable` undefined on every route a
  // caller reads back, which is how a summary can report zero reachable routes
  // beside 36 fully-reached controllers.
  const withVerdict = routes.map((route) => ({ ...route, ...routeIsReachable(route, ui) }));
  for (const route of withVerdict) {
    if (!byFile.has(route.file)) byFile.set(route.file, []);
    byFile.get(route.file).push(route);
  }
  const flagged = [];
  const controllers = [];
  for (const [file, list] of byFile) {
    const reached = list.filter((r) => r.reachable);
    const unreached = list.filter((r) => !r.reachable);
    controllers.push({
      file,
      routes: list.length,
      reached: reached.length,
      unreached: unreached.length,
      uniform: reached.length === 0 ? 'NONE_REACHED' : unreached.length === 0 ? 'ALL_REACHED' : 'MIXED',
    });
    if (!reached.length) continue; // API-only surface: no sibling to compare with
    for (const route of unreached) flagged.push(route);
  }
  flagged.sort((a, b) => a.file.localeCompare(b.file) || a.raw.localeCompare(b.raw));
  return { routes: withVerdict, ui, controllers, flagged };
}

export const FLAG_IDENTITY = (route) => `${route.method} ${route.raw}`;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.turbo', 'dist', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function relative(rootDir, file) {
  return path.relative(rootDir, file).replaceAll(path.sep, '/');
}
