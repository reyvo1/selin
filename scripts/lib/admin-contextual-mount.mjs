import fs from 'node:fs';
import path from 'node:path';

/**
 * A-15 mount enforcement.
 *
 * Finding A-15 says the UI audit proves handler presence, not workflow
 * completeness. It was demonstrated by R2HrConfiguration, which was defined
 * but never rendered, so /people/attendance and /people/compliance both
 * displayed the payroll lifecycle and all ten panels were unreachable from
 * every role while every gate stayed green. Presence in source is not a
 * mounted workflow.
 *
 * The per-view reachability tests are hand-written one view at a time, so a
 * view that silently unmounts is only caught if somebody happened to write a
 * test for that view. This module closes that gap mechanically, and the gap
 * was live: config/admin-contextual-workflow-map.json claims
 * inventory-control/overview is rendered by a component called InventoryLedger,
 * and that identifier appears in no file in the repository. The work shipped
 * under OperationsView plus an inline ledger section, and no gate noticed that
 * the map named a component that was never written. That is the same shape as
 * R2HrConfiguration, found by the same method, which is why the rule is
 * derived rather than a list of known-good names.
 *
 * The rule derives the mount site instead of hardcoding one. A renderer is
 * either mounted as JSX by the page, or it is a component the page imports and
 * mounts - the only thing a map row can legitimately name. A row whose
 * renderer appears nowhere is a map that lies about the product, and it fails
 * whether or not the underlying view happens to work.
 *
 * The renderer field has three real shapes, and a rule that assumed one of
 * them proved nothing:
 *   `Component`              - no mode; the component mounting is the contract
 *   `Component:subview`      - one component, one subview
 *   `A:m+B:n`                - a composite route; both halves must hold
 *   `AdminPage:Subview`      - the page itself is the component, so the page
 *                              source is both the callsite and the module
 */

export function parseRenderer(renderer) {
  return renderer.split('+').map((part) => {
    const [component, subview] = part.split(':');
    return { component, subview };
  });
}

export function callsiteModeUnion(pageSource, component) {
  const union = new Set();
  const sectionUnion = new Set();
  let dynamic = false;
  let routedBySection = false;

  const pattern = new RegExp(`<${component}\\b([\\s\\S]*?)(?:\\/>|>)`, 'g');
  for (const match of pageSource.matchAll(pattern)) {
    const attrs = match[1];

    // `mode` may be a string literal, a parenthesised literal, or a cast union
    // such as `as 'overview'|'traceability'`. Any of these binds the subview.
    for (const prop of ['mode']) {
      const literal = new RegExp(`${prop}\\s*=\\s*(?:\\{\\s*)?(?:\\(\\s*)?['"]([^'"]+)['"]`).exec(attrs);
      if (literal) union.add(literal[1]);
      const asCast = new RegExp(`${prop}\\s*=\\s*\\{[\\s\\S]*?as\\s+([^}]+)\\}`).exec(attrs);
      if (asCast) {
        for (const value of asCast[1].matchAll(/'([^']+)'/g)) union.add(value[1]);
      }
      if (new RegExp(`${prop}\\s*=\\s*\\{activeDomainView`).test(attrs)) dynamic = true;
    }

    // `commerceSection` is the finer-grained axis under a `mode="commerce"`
    // callsite. Rows name that axis as `commerce/<section>`, so the two must
    // be read together rather than as independent unions.
    const section = /commerceSection\s*=\s*(?:\{\s*)?(?:\(\s*)?['"]([^'"]+)['"]/.exec(attrs);
    if (section) {
      routedBySection = true;
      sectionUnion.add(section[1]);
      union.delete('commerce');
      union.add(`commerce/${section[1]}`);
    }
  }

  return { union, sectionUnion, dynamic, routedBySection };
}

export function collectMountFailures(map, pageSource) {
  const failures = [];
  for (const row of map.rows) {
    const key = `${row.workspace}/${row.view}`;
    for (const { component } of parseRenderer(row.renderer)) {
      // `AdminPage` is the page's own function, not a JSX element the page
      // mounts, so it cannot be checked as a callsite. The page rendering at
      // all is its proof.
      if (component === 'AdminPage') continue;
      if (!new RegExp(`<${component}\\b`).test(pageSource)) {
        failures.push(`${key}: renderer ${component} is never mounted as JSX in the page, so the map claims a workflow the page does not render`);
      }
    }
  }
  return failures;
}

export function collectSubviewFailures(map, pageSource) {
  const failures = [];

  for (const row of map.rows) {
    const key = `${row.workspace}/${row.view}`;
    for (const { component, subview } of parseRenderer(row.renderer)) {
      if (component === 'AdminPage' || !subview) continue;

      // Recomputed per row rather than cached per component. A cache keyed by
      // component would make the result depend on row order, so the same map
      // could pass or fail depending on which row was checked first - a gate
      // whose verdict depends on iteration order is not a gate.
      const { union, dynamic } = callsiteModeUnion(pageSource, component);

      // A callsite with no mode and no commerceSection is self-routing: the
      // component owns its own view switching, so the page cannot be asked
      // which subviews it binds. Checking anyway would be inventing a contract
      // the code does not have, which is how a gate learns to be ignored.
      const routed = union.size > 0 || dynamic;
      if (!routed) continue;
      if (!dynamic && !union.has(subview)) {
        failures.push(`${key}: view '${subview}' is not bound as a mode by any callsite of ${component} in the page, so the view is unreachable`);
      }
    }
  }

  return failures;
}

export function auditAdminContextualMount({ root = process.cwd() } = {}) {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'config/admin-contextual-workflow-map.json'), 'utf8'));
  const pageSource = fs.readFileSync(path.join(root, 'apps/admin/app/page.tsx'), 'utf8');
  const failures = [
    ...collectMountFailures(map, pageSource),
    ...collectSubviewFailures(map, pageSource, { root }),
  ];
  return {
    expectedContextualViews: map.expectedContextualViews,
    rows: map.rows.length,
    failures,
    passed: failures.length === 0,
  };
}
