import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const schemas = [
  read('apps/api/prisma/schema.prisma'),
  read('apps/api/prisma/schema.sqlite.prisma'),
  read('apps/api/prisma/schema.postgresql.prisma'),
];
const service = read('apps/api/src/inventory/costing.service.ts');
const receipts = read('apps/api/src/goods-receipts/goods-receipts.service.ts');
const sales = read('apps/api/src/sales/sales.service.ts');
const orders = read('apps/api/src/orders/orders.service.ts');
const returns = read('apps/api/src/returns/returns.service.ts');
const advancedInventory = read('apps/api/src/advanced-inventory/advanced-inventory.service.ts');
const assets = read('apps/api/src/assets/assets.service.ts');
const manufacturing = read('apps/api/src/manufacturing/manufacturing.service.ts');
const batchFefo = read('apps/api/src/common/batch-fefo.ts');
const seed = read('apps/api/prisma/seed.ts');
const manifest = JSON.parse(read('config/expand-migration-order.json'));
const costingItem = JSON.parse(read('work-items/active/T360-20261021-134120-costing-engine-dan-valuasi-persediaan.json'));

test('all runtime schemas expose the costing models, occurredAt, and idempotency keys', () => {
  for (const schema of schemas) {
    for (const model of ['CostingPolicy', 'InventoryCostState', 'InventoryCostEvent', 'InventoryCostLayer', 'InventoryCostConsumption', 'CostingRebuildRun']) {
      assert.match(schema, new RegExp(`model ${model} \\{`));
    }
    assert.match(schema, /occurredAt\s+DateTime\?/);
    assert.doesNotMatch(schema, /occurredAt\s+DateTime\?\s+@default\(now\(\)\)/);
    assert.match(schema, /@@unique\(\[companyId, operationKey\]\)/);
    assert.match(schema, /@@unique\(\[companyId, sourceType, sourceId, sourceLineKey, eventType\]\)/);
    assert.match(schema, /@@unique\(\[companyId, branchId, warehouseId, productId, batchKey, method\]\)/);
    assert.match(schema, /uncostedQuantity\s+Int\s+@default\(0\)/);
    assert.match(schema, /enum CostingMethod \{\s+MOVING_AVERAGE\s+FIFO\s+LIFO\s+\}/);
  }
});

test('expand migration is registered and creates both provider variants', () => {
  assert.ok(manifest.migrations.includes('T360-20261021-134120-costing-engine'));
  for (const file of ['sqlite-expand.sql', 'postgresql-expand.sql']) {
    const sql = read(`database/migrations/T360-20261021-134120-costing-engine/${file}`);
    assert.match(sql, /InventoryCostEvent/);
    assert.match(sql, /InventoryCostState/);
    assert.match(sql, /InventoryCostLayer/);
    assert.match(sql, /InventoryCostConsumption/);
    assert.match(sql, /CostingRebuildRun/);
    assert.match(sql, /occurredAt/);
  }
  const postgres = read('database/migrations/T360-20261021-134120-costing-engine/postgresql-expand.sql');
  assert.match(postgres, /CREATE TYPE "CostingMethod" AS ENUM/);
  assert.match(postgres, /CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCostEvent_company_operation_key"/);
  assert.doesNotMatch(postgres, /ALTER COLUMN "occurredAt" SET DEFAULT/);
  for (const sql of [
    read('database/migrations/T360-20261021-134120-costing-engine/sqlite-expand.sql'),
    postgres,
  ]) {
    assert.match(sql, /Keuntungan Selisih Harga Beli/);
    assert.match(sql, /Kerugian Selisih Harga Beli/);
    assert.match(sql, /PURCHASE-RETURN/);
    assert.match(sql, /amountKey.{0,3}inventory/);
  }
});

test('moving average posting is transactional, CAS-versioned, idempotent, and backdated-safe', () => {
  assert.match(service, /resolvePolicy\(/);
  assert.match(service, /policy\.method !== 'MOVING_AVERAGE'/);
  assert.match(service, /assertNotBackdated\(/);
  assert.match(service, /occurredAt: \{ gt: input\.occurredAt \}/);
  assert.match(service, /companyId_operationKey/);
  assert.match(service, /payloadHash !== input\.payloadHash/);
  assert.match(service, /where: \{ id: state\.id, version: state\.version \}/);
  assert.match(service, /version: \{ increment: 1 \}/);
  assert.match(service, /uncostedQuantity/);
  assert.match(service, /averageCost: quantity > 0 \? value\.div\(quantity\)/);
  assert.match(service, /policy\.mode === 'ACTIVE' && result\.uncostedQuantity > 0/);
});

test('sales posts ISSUE per FEFO batch and derives sale/line cost from the ledger', () => {
  assert.match(sales, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, occurredAt\)/);
  assert.match(sales, /const costingActive = costingMode === 'ACTIVE'/);
  assert.match(sales, /this\.costing\.recordIssue\(tx, \{/);
  assert.match(sales, /operationKey: `sale-cost:/);
  assert.match(sales, /batchKey: part\.batchKey/);
  assert.match(sales, /tx\.saleItem\.update\(\{ where: \{ id: saleItems\[lineIndex\]\.id \}/);
  assert.match(sales, /tx\.sale\.update\(\{ where: \{ id: sale\.id \}, data: \{ costTotal: saleCostTotal \}/);
  assert.match(batchFefo, /return consumed;/);
  assert.match(batchFefo, /consumed\.push\(\{ batchId: batch\.id, batchNumber: batch\.batchNumber, quantity: take \}\)/);
});

test('order shipment posts ISSUE per FEFO batch and uses ledger cost for COGS', () => {
  assert.match(orders, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, occurredAt\)/);
  assert.match(orders, /const costingActive = costingMode === 'ACTIVE'/);
  assert.match(orders, /this\.costing\.recordIssue\(tx, \{/);
  assert.match(orders, /sourceType: 'Order', sourceId: order\.id/);
  assert.match(orders, /operationKey: `order-cost:/);
  assert.match(orders, /sourceLineKey = batchConsumptions\.length > 0 \? `\$\{item\.id\}:\$\{part\.batchKey\}` : item\.id/);
  assert.match(orders, /tx\.orderItem\.update\(\{ where: \{ id: item\.id \}, data: \{ unitCost: lineCost\.div\(item\.quantity\)/);
  assert.match(orders, /cogs: costTotal, inventory: costTotal/);
  assert.match(orders, /referenceType: 'Order', referenceId: order\.id, occurredAt/);
  assert.match(read('apps/api/src/orders/orders.module.ts'), /InventoryModule/);
});

test('sale return restores the original issue cost and journals the COGS reversal', () => {
  assert.match(returns, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, postedAt\)/);
  assert.match(returns, /costingMode === 'ACTIVE' \? ledgerCogs : legacyCogs/);
  assert.match(returns, /this\.costing\.recordSaleReturn\(tx, \{/);
  assert.match(returns, /operationKey: `sale-return-cost:/);
  assert.match(returns, /sourceLineKey: `\$\{saleItemId\}:\$\{part\.batchKey\}:\$\{partIndex\}`/);
  assert.match(returns, /tx\.inventoryMovement\.create\(\{ data: \{[\s\S]*?occurredAt: postedAt/);
  assert.match(returns, /Costing ACTIVE menolak retur/);
  assert.match(service, /policy\.method, 'SALE_RETURN'/);
  assert.match(read('apps/api/src/returns/returns.module.ts'), /InventoryModule/);
  assert.match(sales, /const sourceLineKey = batchConsumptions\.length > 0 \? `\$\{saleItems\[lineIndex\]\.id\}/);
});

test('order return restores the original order ISSUE cost and journals COGS reversal', () => {
  assert.match(returns, /sourceType: 'Order',\s+sourceId: row\.orderId,\s+eventType: 'ISSUE'/);
  assert.match(returns, /sourceType: 'OrderReturn',\s+eventType: 'SALE_RETURN'/);
  assert.match(returns, /this\.costing\.recordSaleReturn\(tx, \{/);
  assert.match(returns, /operationKey: `order-return-cost:/);
  assert.match(returns, /sourceLineKey: `\$\{orderItemId\}:\$\{part\.batchKey\}:\$\{partIndex\}`/);
  assert.match(returns, /type: 'SALE_RETURN', quantity: item\.quantity[\s\S]*?occurredAt: postedAt/);
  assert.match(returns, /costingMode === 'ACTIVE' \? ledgerCogs : legacyCogs/);
  assert.match(returns, /Costing ACTIVE menolak retur order/);
  assert.match(returns, /Batch asal \$\{part\.batchKey\} untuk retur order/);
});

test('stock transfer posts source ISSUE and destination RECEIPT with the transferred ledger cost', () => {
  assert.match(advancedInventory, /this\.costing\.resolveMode\(tx, scope\.companyId, source\.branchId, occurredAt\)/);
  assert.match(advancedInventory, /this\.costing\.resolveMode\(tx, scope\.companyId, destination\.branchId, occurredAt\)/);
  assert.match(advancedInventory, /sourceType: 'StockTransfer'/);
  assert.match(advancedInventory, /operationKey: `stock-transfer-cost:/);
  assert.match(advancedInventory, /operationKey: `stock-transfer-receipt-cost:/);
  assert.match(advancedInventory, /const value = costingActive \? ledgerCost : legacyValue/);
  assert.match(advancedInventory, /const value = costingActive \? ledgerValue : legacyValue/);
  assert.match(advancedInventory, /Costing ACTIVE tujuan transfer menolak penerimaan/);
  assert.match(advancedInventory, /type: 'TRANSFER_OUT'[\s\S]*?occurredAt/);
  assert.match(advancedInventory, /type: 'TRANSFER_IN'[\s\S]*?occurredAt/);
  assert.match(read('apps/api/src/advanced-inventory/advanced-inventory.module.ts'), /InventoryModule/);
});

test('stock opname values gains and losses from the ledger cost state', () => {
  assert.match(advancedInventory, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, occurredAt\)/);
  assert.match(advancedInventory, /operationKey: `stock-opname-cost:/);
  assert.match(advancedInventory, /sourceType: 'StockOpname'/);
  assert.match(advancedInventory, /this\.costing\.recordReceipt\(tx, \{/);
  assert.match(advancedInventory, /this\.costing\.recordIssue\(tx, \{/);
  assert.match(advancedInventory, /Costing ACTIVE menolak penambahan opname/);
  assert.match(advancedInventory, /type: difference > 0 \? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'[\s\S]*?occurredAt/);
  assert.match(advancedInventory, /completedAt: occurredAt/);
});

test('maintenance parts consume ledger cost behind the costing flag', () => {
  assert.match(assets, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, completedAt\)/);
  assert.match(assets, /this\.costing\.recordIssue\(tx, \{/);
  assert.match(assets, /sourceType: 'MaintenanceWorkOrder'/);
  assert.match(assets, /operationKey: `maintenance-cost:/);
  assert.match(assets, /if \(costingActive\) lineCost = result\.cost/);
  assert.match(assets, /type: 'ADJUSTMENT_OUT'[\s\S]*?occurredAt: completedAt/);
  assert.match(read('apps/api/src/assets/assets.module.ts'), /InventoryModule/);
});

test('production consumes component cost and receives output cost from the ledger', () => {
  assert.match(manufacturing, /this\.costing\.resolveMode\(tx, scope\.companyId, order\.branchId, occurredAt\)/);
  assert.match(manufacturing, /this\.costing\.recordIssue\(tx, \{/);
  assert.match(manufacturing, /this\.costing\.recordReceipt\(tx, \{/);
  assert.match(manufacturing, /sourceType: 'ProductionOrder'/);
  assert.match(manufacturing, /operationKey: `production-cost:/);
  assert.match(manufacturing, /operationKey: `production-output-cost:/);
  assert.match(manufacturing, /if \(!costingActive && !new Prisma\.Decimal\(output\.costPrice\)\.equals\(nextMovingAverageCost\)\)/);
  assert.match(manufacturing, /type: 'PRODUCTION_CONSUME'[\s\S]*?occurredAt/);
  assert.match(manufacturing, /type: 'PRODUCTION_OUTPUT'[\s\S]*?occurredAt/);
  assert.match(read('apps/api/src/manufacturing/manufacturing.module.ts'), /InventoryModule/);
});

test('purchase return credits inventory at ledger cost and posts the purchase price variance', () => {
  assert.match(returns, /this\.costing\.resolveMode\(tx, scope\.companyId, scope\.branchId, postedAt\)/);
  assert.match(returns, /this\.costing\.recordPurchaseReturn\(tx, \{/);
  assert.match(returns, /operationKey: `purchase-return-cost:/);
  assert.match(returns, /sourceLineKey: item\.id/);
  assert.match(returns, /inventory: inventoryCost/);
  assert.match(returns, /purchasePriceVariance/);
  assert.match(returns, /accountCode: '4203'/);
  assert.match(returns, /accountCode: '5103'/);
  assert.match(returns, /tx\.inventoryMovement\.create\(\{ data: \{[\s\S]*?occurredAt: postedAt/);
  assert.match(service, /'PURCHASE_RETURN', 'retur pembelian'/);
  assert.match(seed, /'4203','Keuntungan Selisih Harga Beli'/);
  assert.match(seed, /'5103','Kerugian Selisih Harga Beli'/);
  assert.match(seed, /code: 'PURCHASE-RETURN', version: 2/);
  assert.match(seed, /accountCodeKey: 'inventory', side: 'CREDIT', amountKey: 'inventory'/);
});

test('costing is wired to goods receipt confirmation behind the inventory.costing flag', () => {
  assert.match(receipts, /costing\.isEnabled\(tx, scope\.companyId, receipt\.warehouse\.branchId\)/);
  assert.match(receipts, /if \(costingEnabled\)/);
  assert.match(receipts, /this\.costing\.recordReceipt\(tx, \{/);
  assert.match(receipts, /sourceType: 'GoodsReceipt'/);
  assert.match(receipts, /sourceLineKey: item\.id/);
  assert.match(receipts, /operationKey: `goods-receipt-cost:/);
});

test('costing policy API is permissioned, tenant-scoped, and blocks backdated activation', () => {
  const controller = read('apps/api/src/inventory/costing.controller.ts');
  const policyService = read('apps/api/src/inventory/costing-policy.service.ts');
  assert.match(controller, /@Controller\('inventory\/costing'\)/);
  assert.match(controller, /@Permissions\('inventory\.costing\.view'\) @Get\('policies'\)/);
  assert.match(controller, /@Permissions\('inventory\.costing\.manage'\) @Post\('policies'\)/);
  assert.match(controller, /@Permissions\('inventory\.costing\.manage'\) @Post\('policies\/:id\/activate'\)/);
  assert.match(controller, /@Permissions\('inventory\.costing\.view'\) @Get\('valuation'\)/);
  assert.match(seed, /'inventory\.costing\.view','inventory\.costing\.manage','inventory\.costing\.rebuild'/);
  const adminMatrix = seed.slice(seed.indexOf("['ADMIN', ["), seed.indexOf("['CASHIER'"));
  const warehouseMatrix = seed.slice(seed.indexOf("['WAREHOUSE', ["), seed.indexOf("['PURCHASING'"));
  const financeMatrix = seed.slice(seed.indexOf("['FINANCE', ["), seed.indexOf("['AUDITOR'"));
  assert.match(adminMatrix, /inventory\.costing\.manage/);
  assert.doesNotMatch(warehouseMatrix, /inventory\.costing\.manage/);
  assert.match(financeMatrix, /inventory\.costing\.view/);
  assert.match(financeMatrix, /inventory\.costing\.manage/);
  assert.match(policyService, /COSTING_POLICY_MAKER_CHECKER/);
  assert.match(policyService, /companyId: scope\.companyId/);
  assert.match(policyService, /branchId: scope\.branchId/);
  assert.match(policyService, /COSTING_POLICY_BACKDATED/);
  assert.match(policyService, /action: 'COSTING_POLICY_CREATED'/);
  assert.match(policyService, /action: 'COSTING_POLICY_ACTIVATED'/);
  assert.match(read('apps/api/src/inventory/inventory.module.ts'), /InventoryCostingController/);
});

test('ADR is accepted and the costing work item entered IMPLEMENTATION', () => {
  assert.match(read('docs/adr/ADR-T360-20261021-134120-COSTING-METHOD.md'), /\*\*Status:\*\* ACCEPTED/);
  assert.equal(costingItem.phase, 'IMPLEMENTATION');
});
