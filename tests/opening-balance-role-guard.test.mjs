import assert from 'node:assert/strict';
import test from 'node:test';
import { Reflector } from '@nestjs/core';
import { load } from './helpers/import-ts.mjs';

const opts = { platform: 'node', external: ['@nestjs/core', '@nestjs/common'] };
const { OpeningBalanceController } = await load('apps/api/src/opening-balance/opening-balance.controller.ts', opts);
const { RolesGuard } = await load('apps/api/src/auth/roles.guard.ts', opts);
const { ROLES_KEY } = await load('apps/api/src/auth/roles.decorator.ts', opts);

const guard = new RolesGuard(new Reflector());
const proto = OpeningBalanceController.prototype;

function contextFor(method, user) {
  return {
    getHandler: () => proto[method],
    getClass: () => OpeningBalanceController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

const role = (name) => ({ sub: `u-${name}`, name, authType: 'SESSION', companyId: 'acme', branchId: 'br-1', roles: [name] });

function allows(method, user) {
  try { guard.canActivate(contextFor(method, user)); return true; } catch { return false; }
}

const financeOnly = ['settle', 'cutover', 'yearEndClose', 'reverseYearEndClose', 'post', 'approve', 'submit', 'create', 'preview', 'revalidate', 'cancel', 'reverse'];
const readOnly = ['list', 'get', 'rows', 'cutoverStatus'];

for (const method of financeOnly) {
  test(`AUDITOR cannot call ${method}`, () => {
    assert.equal(allows(method, role('AUDITOR')), false, `${method} must not be available to AUDITOR`);
  });
  test(`FINANCE can call ${method}`, () => {
    assert.equal(allows(method, role('FINANCE')), true, `${method} must be available to FINANCE`);
  });
}

for (const method of readOnly) {
  test(`AUDITOR can call ${method}`, () => {
    assert.equal(allows(method, role('AUDITOR')), true, `${method} should be readable by AUDITOR`);
  });
}