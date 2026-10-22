-- Toko360 PostgreSQL baseline (expand-only, versioned).
-- GENERATED FILE - jangan edit manual.
-- Regenerate: npm run db:baseline:postgres
-- Source schema: apps/api/prisma/schema.postgresql.prisma
-- Post-migration files: 1

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_STOCK', 'PURCHASE_RECEIPT', 'SALE', 'ONLINE_ORDER', 'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOCATION_MOVE_IN', 'LOCATION_MOVE_OUT', 'PRODUCTION_CONSUME', 'PRODUCTION_OUTPUT');

-- CreateEnum
CREATE TYPE "InventoryCondition" AS ENUM ('AVAILABLE', 'DAMAGED', 'QUARANTINE', 'LOST');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DigitalServiceTransactionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('POS', 'ONLINE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FeatureScope" AS ENUM ('GLOBAL', 'COMPANY', 'BRANCH', 'USER');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('PAYMENT', 'SHIPPING', 'MARKETPLACE', 'NOTIFICATION', 'ACCOUNTING', 'STORAGE', 'ANALYTICS', 'IDENTITY', 'DEVICE', 'PPOB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'DEGRADED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'PICKING', 'SHIPPED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOpnameStatus" AS ENUM ('DRAFT', 'COUNTING', 'WAITING_APPROVAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('OPERATING_EXPENSE', 'OTHER_INCOME', 'CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'TAX_PAYMENT', 'PAYROLL_LIABILITY_PAYMENT', 'CASH_TRANSFER', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceTransactionStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'RECEIVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'IN_TRANSIT', 'RESERVED', 'SOLD', 'RETURNED', 'CONSUMED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRE', 'REFUND');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfflineSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPLIED', 'CONFLICT', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'READY', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CostingMethod" AS ENUM ('MOVING_AVERAGE', 'FIFO', 'LIFO');

-- CreateEnum
CREATE TYPE "CostingMode" AS ENUM ('SHADOW', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CostingPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "InventoryCostEventType" AS ENUM ('RECEIPT', 'ISSUE', 'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'PRODUCTION_CONSUME', 'PRODUCTION_OUTPUT', 'ASSET_ISSUE', 'OPENING', 'REVERSAL', 'REBUILD');

-- CreateEnum
CREATE TYPE "InventoryCostEventStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "InventoryCostLayerStatus" AS ENUM ('OPEN', 'CONSUMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CostingRebuildStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATION', 'PERMANENT', 'CONTRACT', 'DAILY', 'PART_TIME', 'INTERN', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('FINGERPRINT', 'FACE_DEVICE', 'SELFIE_GPS', 'MOBILE_GPS', 'WEB', 'QR_CODE', 'MANUAL', 'API_IMPORT');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END', 'OVERTIME_START', 'OVERTIME_END');

-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('PRESENT', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'LEAVE', 'SICK', 'HOLIDAY', 'OFF_DAY', 'INCOMPLETE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'REVIEW', 'APPROVED', 'POSTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'REIMBURSEMENT', 'TAX');

-- CreateEnum
CREATE TYPE "PayrollCalculationType" AS ENUM ('FIXED', 'FORMULA', 'PERCENTAGE', 'ATTENDANCE', 'OVERTIME', 'TAX_ENGINE', 'SOCIAL_SECURITY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "BiometricType" AS ENUM ('FINGERPRINT', 'FACE');

-- CreateEnum
CREATE TYPE "GoodsReceiptOperationalStatus" AS ENUM ('DRAFT', 'PENDING_INSPECTION', 'READY_TO_CONFIRM', 'CONFIRMED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountingEventStatus" AS ENUM ('PENDING', 'VALIDATED', 'POSTED', 'FAILED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountingRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TaxScope" AS ENUM ('SALE', 'PURCHASE', 'EXPENSE', 'ASSET', 'PAYROLL', 'SHIPPING', 'WITHHOLDING', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxTransactionDirection" AS ENUM ('INPUT', 'OUTPUT', 'WITHHOLDING', 'SELF_ASSESSED');

-- CreateEnum
CREATE TYPE "TaxTransactionStatus" AS ENUM ('CALCULATED', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MOVABLE', 'IMMOVABLE', 'VEHICLE', 'LAND', 'BUILDING', 'EQUIPMENT', 'FURNITURE', 'IT', 'SOFTWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IDLE', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'SOLD', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetTransactionType" AS ENUM ('ACQUISITION', 'CAPITALIZATION', 'DEPRECIATION', 'IMPAIRMENT', 'REVALUATION', 'TRANSFER', 'MAINTENANCE', 'SALE', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PLANNED', 'OPEN', 'IN_PROGRESS', 'WAITING_PART', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('PURCHASE_INBOUND', 'TRANSFER_INBOUND', 'SALE_OUTBOUND', 'ORDER_OUTBOUND', 'RETURN_INBOUND', 'VEHICLE_PRETRIP', 'VEHICLE_POSTTRIP', 'ASSET_HANDOVER', 'ASSET_PERIODIC', 'DELIVERY_PROOF', 'GATE_SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PASSED', 'PARTIAL', 'FAILED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionResultCode" AS ENUM ('PASS', 'FAIL', 'OBSERVATION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GatePassDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('DRAFT', 'CHECKING', 'APPROVED', 'EXITED', 'ENTERED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'MAINTENANCE', 'INACTIVE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DeliveryTripStatus" AS ENUM ('DRAFT', 'PLANNED', 'LOADING', 'READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'RETURNING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'DELIVERED', 'PARTIAL', 'FAILED', 'RETURNED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AutomationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncNodeRole" AS ENUM ('CENTRAL', 'BRANCH');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('PUSH', 'PULL', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "SyncEventStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "SyncInboxOutcome" AS ENUM ('APPLIED', 'DUPLICATE', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncConflictStrategy" AS ENUM ('PENDING', 'KEEP_LOCAL', 'KEEP_REMOTE', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "BranchConnectionState" AS ENUM ('UNKNOWN', 'ONLINE', 'DEGRADED', 'OFFLINE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BranchTransferSyncState" AS ENUM ('AWAITING_DESTINATION', 'CONVERGED', 'DISCREPANT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "MobileDraftStatus" AS ENUM ('OPEN', 'SUBMITTED', 'POSTED', 'DISCARDED');

-- CreateTable
CREATE TABLE "IdempotencyReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "response" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySalesSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "itemQuantity" INTEGER NOT NULL DEFAULT 0,
    "grossSales" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cogs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySalesSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyFinanceSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyFinanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyInventorySummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "skuCount" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "lowStockCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyInventorySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "requestedById" TEXT,
    "scheduleId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "filters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "filters" JSONB,
    "frequency" TEXT NOT NULL,
    "localTime" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastJobId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "hotDays" INTEGER NOT NULL DEFAULT 365,
    "warmDays" INTEGER NOT NULL DEFAULT 1095,
    "archiveAfter" BOOLEAN NOT NULL DEFAULT true,
    "deleteAfterDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataArchiveRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "archiveUri" TEXT,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataArchiveRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Makassar',
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretEncrypted" TEXT,
    "twoFactorPendingSecretEncrypted" TEXT,
    "twoFactorRecoveryCodes" JSONB,
    "supervisorPinHash" TEXT,
    "canApprovePrivilegedActions" BOOLEAN NOT NULL DEFAULT false,
    "supervisorPinUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeBranchId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenHash" TEXT,
    "lastRotatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "categoryId" TEXT,
    "brandCode" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "unit" TEXT NOT NULL,
    "costPrice" DECIMAL(18,2) NOT NULL,
    "salePrice" DECIMAL(18,2) NOT NULL,
    "retailCeilingPrice" DECIMAL(18,2),
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "productType" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "taxCategoryCode" TEXT,
    "salesTaxCodeId" TEXT,
    "purchaseTaxCodeId" TEXT,
    "trackBatch" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "trackSerial" BOOLEAN NOT NULL DEFAULT false,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowCustomerStockVisibility" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRecipe" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outputProductId" TEXT NOT NULL,
    "outputQtyPerBatch" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantityPerBatch" INTEGER NOT NULL,
    "wastePct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "batchCount" INTEGER NOT NULL,
    "plannedOutputQty" INTEGER NOT NULL,
    "actualOutputQty" INTEGER,
    "totalCost" DECIMAL(65,30),
    "notes" TEXT,
    "releasedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderComponent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,
    "actualQty" INTEGER,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "taxIdNumber" TEXT,
    "taxProfile" JSONB,
    "defaultTaxCodeId" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConditionBalance" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "condition" "InventoryCondition" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConditionBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConditionMovement" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromCondition" "InventoryCondition" NOT NULL,
    "toCondition" "InventoryCondition" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryConditionMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvalRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "neededBy" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "unitCode" TEXT,
    "productUnitId" TEXT,
    "variantId" TEXT,
    "sourceBarcode" TEXT,
    "estimatedUnitCost" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "purchaseUnitCost" DECIMAL(18,2),
    "subtotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "supplierInvoice" TEXT,
    "deliveryNote" TEXT,
    "operationalStatus" "GoodsReceiptOperationalStatus" NOT NULL DEFAULT 'DRAFT',
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT true,
    "inspectionId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "accountingEventId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "damagedUnitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "quantityReceived" INTEGER NOT NULL,
    "quantityDamaged" INTEGER NOT NULL DEFAULT 0,
    "acceptedQty" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxCodeId" TEXT,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "serialNumbers" JSONB,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "address" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "customerType" TEXT NOT NULL DEFAULT 'RETAIL',
    "taxIdNumber" TEXT,
    "taxProfile" JSONB,
    "defaultTaxCodeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVerificationToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Rumah',
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "district" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFavorite" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DECIMAL(18,2) NOT NULL,
    "closingCash" DECIMAL(18,2),
    "expectedCash" DECIMAL(18,2),
    "difference" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "CashierShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierCashMovement" (
    "id" TEXT NOT NULL,
    "cashierShiftId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierCashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "customerId" TEXT,
    "cashierShiftId" TEXT,
    "channel" "SaleChannel" NOT NULL DEFAULT 'POS',
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "serviceFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "accountingEventId" TEXT,
    "taxDocumentId" TEXT,
    "total" DECIMAL(18,2) NOT NULL,
    "costTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "sourceBarcode" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "netSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "address" TEXT NOT NULL,
    "fulfillmentType" TEXT NOT NULL DEFAULT 'DELIVERY',
    "customerAddressId" TEXT,
    "shippingMethodCode" TEXT,
    "shippingMethodName" TEXT,
    "pickupWarehouseId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "shippingCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "accountingEventId" TEXT,
    "taxDocumentId" TEXT,
    "total" DECIMAL(18,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "sourceBarcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "netSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "saleId" TEXT,
    "orderId" TEXT,
    "method" TEXT NOT NULL,
    "methodName" TEXT,
    "methodReferenceId" TEXT,
    "methodSnapshot" JSONB,
    "provider" TEXT,
    "externalRef" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "settlementAccountCode" TEXT,
    "settlementBehavior" TEXT,
    "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feeAccountCode" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "accountingEventId" TEXT,
    "taxTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalRef" TEXT,
    "paymentId" TEXT,
    "orderId" TEXT,
    "amount" DECIMAL(65,30),
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMemo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "scope" "FeatureScope" NOT NULL DEFAULT 'COMPANY',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "userId" TEXT,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "category" TEXT NOT NULL,
    "featureKey" TEXT,
    "dependencies" JSONB,
    "capabilities" JSONB,
    "navigation" JSONB,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UiSchemaDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiSchemaDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "options" JSONB,
    "validation" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "documentType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}{MM}-{NUMBER}',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "resetPolicy" TEXT NOT NULL DEFAULT 'MONTHLY',
    "lastResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "IntegrationType" NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "config" JSONB,
    "encryptedSecrets" TEXT,
    "capabilities" JSONB,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalServiceProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerSku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "type" TEXT,
    "sellerName" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PREPAID',
    "costPrice" DECIMAL(65,30),
    "salePrice" DECIMAL(65,30) NOT NULL,
    "buyerProductStatus" BOOLEAN NOT NULL DEFAULT true,
    "sellerProductStatus" BOOLEAN NOT NULL DEFAULT true,
    "unlimitedStock" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalServiceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalServiceTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "providerSku" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PREPAID',
    "sellingPrice" DECIMAL(65,30) NOT NULL,
    "maxPrice" DECIMAL(65,30),
    "costAmount" DECIMAL(65,30),
    "cashierShiftId" TEXT,
    "paymentAccountingEventId" TEXT,
    "settlementAccountingEventId" TEXT,
    "refundAccountingEventId" TEXT,
    "refundCashierShiftId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "status" "DigitalServiceTransactionStatus" NOT NULL DEFAULT 'QUEUED',
    "providerRef" TEXT,
    "providerRc" TEXT,
    "message" TEXT,
    "serialNumber" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalServiceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT,
    "events" JSONB NOT NULL,
    "headers" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "conditions" JSONB,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "policyId" TEXT,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requesterId" TEXT,
    "amount" DECIMAL(18,2),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "context" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "delegatedToId" TEXT,
    "delegatedById" TEXT,
    "delegatedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BIN',
    "barcode" TEXT,
    "capacity" DECIMAL(18,3),
    "metadata" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocationBalance" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocationBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumbers" JSONB,
    "metadata" JSONB,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOpname" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "status" "StockOpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "approvedById" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOpname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOpnameItem" (
    "id" TEXT NOT NULL,
    "opnameId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "difference" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "StockOpnameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "producedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySerial" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostingPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "method" "CostingMethod" NOT NULL,
    "mode" "CostingMode" NOT NULL DEFAULT 'SHADOW',
    "status" "CostingPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCostState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL DEFAULT '',
    "method" "CostingMethod" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCostState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCostEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL DEFAULT '',
    "movementId" TEXT,
    "eventType" "InventoryCostEventType" NOT NULL,
    "method" "CostingMethod" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "uncostedQuantity" INTEGER NOT NULL DEFAULT 0,
    "valueDelta" DECIMAL(20,6) NOT NULL,
    "unitCost" DECIMAL(20,6) NOT NULL,
    "balanceQuantity" INTEGER NOT NULL,
    "balanceValue" DECIMAL(20,6) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineKey" TEXT NOT NULL DEFAULT '',
    "operationKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "InventoryCostEventStatus" NOT NULL DEFAULT 'POSTED',
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCostLayer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL DEFAULT '',
    "method" "CostingMethod" NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "originalQty" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "unitCost" DECIMAL(20,6) NOT NULL,
    "originalValue" DECIMAL(20,6) NOT NULL,
    "remainingValue" DECIMAL(20,6) NOT NULL,
    "status" "InventoryCostLayerStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCostConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCostConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostingRebuildRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "method" "CostingMethod" NOT NULL,
    "mode" "CostingMode" NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "CostingRebuildStatus" NOT NULL DEFAULT 'PENDING',
    "checkpoint" TEXT,
    "statistics" JSONB,
    "operationKey" TEXT NOT NULL,
    "approvedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostingRebuildRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "refundMethod" TEXT,
    "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "inspectionId" TEXT,
    "accountingEventId" TEXT,
    "approvedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturnItem" (
    "id" TEXT NOT NULL,
    "orderReturnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "sourceBarcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "unitAmount" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "taxCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "refundMethod" TEXT,
    "refundAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refundDetails" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "inspectionId" TEXT,
    "confirmationId" TEXT,
    "accountingEventId" TEXT,
    "taxDocumentId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "sourceBarcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "unitAmount" DECIMAL(18,2) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "goodsReceiptId" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payableOffsetAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "supplierReceivableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "supplierCreditNoteNumber" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "inspectionId" TEXT,
    "confirmationId" TEXT,
    "gatePassId" TEXT,
    "accountingEventId" TEXT,
    "taxDocumentId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "unitCode" TEXT,
    "unitQuantity" INTEGER,
    "quantityFactor" INTEGER NOT NULL DEFAULT 1,
    "sourceBarcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "earnRate" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "redemptionRate" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "minimumRedeem" INTEGER NOT NULL DEFAULT 0,
    "pointsExpireDays" INTEGER,
    "tiers" JSONB,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'MEMBER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "bankAccountId" TEXT,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "openingBalance" DECIMAL(18,2),
    "closingBalance" DECIMAL(18,2),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,2),
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedType" TEXT,
    "matchedId" TEXT,
    "raw" JSONB,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "bankAccountId" TEXT,
    "statementId" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bookBalance" DECIMAL(18,2) NOT NULL,
    "bankBalance" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "publicKey" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "encryptedSecret" TEXT,
    "publicKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAuthNonce" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "requestAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReceipt" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "checkpoint" TIMESTAMP(3) NOT NULL,
    "nextCursor" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "eventIds" JSONB NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineTransaction" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "transactionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OfflineSyncStatus" NOT NULL DEFAULT 'PENDING',
    "serverEntityType" TEXT,
    "serverEntityId" TEXT,
    "conflict" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OfflineTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "model" TEXT NOT NULL DEFAULT 'MOVING_AVERAGE',
    "horizonDays" INTEGER NOT NULL,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReorderSuggestion" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "averageDailySales" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "suggestedQty" INTEGER NOT NULL,
    "reason" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorInsight" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "sourceLinks" JSONB NOT NULL,
    "recommendedAction" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByRunId" TEXT,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantInteraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "sourceLinks" JSONB NOT NULL,
    "confidence" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT,
    "saleId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "integrationId" TEXT,
    "carrier" TEXT,
    "service" TEXT,
    "trackingNumber" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "shippingCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recipient" JSONB NOT NULL,
    "packages" JSONB,
    "deliveryTripId" TEXT,
    "outboundInspectionId" TEXT,
    "gatePassId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "labelUrl" TEXT,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "internalOrderId" TEXT,
    "marketplace" TEXT NOT NULL,
    "shopId" TEXT,
    "status" TEXT NOT NULL,
    "orderData" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "templateCode" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "externalRef" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "branchId" TEXT,
    "locationLabel" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "costCenterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "managerEmployeeId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Makassar',
    "workLocationType" TEXT NOT NULL DEFAULT 'ONSITE',
    "photoObjectKey" TEXT,
    "emergencyContactEncrypted" JSONB,
    "bankAccountTokenRef" TEXT,
    "settlementAccountCode" TEXT,
    "accountingEventId" TEXT,
    "identitySecretRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "managerEmployeeId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
    "minimumWorkMinutes" INTEGER,
    "overtimeAfterMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "shiftId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'ROSTER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowedMethods" JSONB NOT NULL,
    "requirePhoto" BOOLEAN NOT NULL DEFAULT false,
    "requireLocation" BOOLEAN NOT NULL DEFAULT false,
    "requireLiveness" BOOLEAN NOT NULL DEFAULT false,
    "allowOutsideGeofence" BOOLEAN NOT NULL DEFAULT false,
    "maxLocationAccuracyMeters" INTEGER,
    "duplicateWindowSeconds" INTEGER NOT NULL DEFAULT 60,
    "offlineAllowed" BOOLEAN NOT NULL DEFAULT true,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceGeofence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "allowedAccuracyMeters" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scheduleRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "ipAddress" TEXT,
    "integrationId" TEXT,
    "secretRef" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Makassar',
    "lastSeenAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBiometricCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDeviceId" TEXT,
    "biometricType" "BiometricType" NOT NULL,
    "deviceUserCode" TEXT NOT NULL,
    "externalTemplateRef" TEXT,
    "templateHash" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBiometricCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "eventType" "AttendanceEventType" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,
    "geofenceId" TEXT,
    "externalEventId" TEXT,
    "operationId" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(10,2),
    "distanceMeters" DECIMAL(10,2),
    "insideGeofence" BOOLEAN,
    "photoEvidenceId" TEXT,
    "livenessScore" DECIMAL(5,4),
    "faceMatchScore" DECIMAL(5,4),
    "sourcePayload" JSONB,
    "validationFlags" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePhotoEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "contentHash" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "livenessProvider" TEXT,
    "livenessScore" DECIMAL(5,4),
    "faceMatchScore" DECIMAL(5,4),
    "consentVersion" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "encryptionKeyRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePhotoEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "firstCheckInAt" TIMESTAMP(3),
    "lastCheckOutAt" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposedData" JSONB NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "annualQuota" DECIMAL(8,2),
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DECIMAL(8,2) NOT NULL,
    "reason" TEXT,
    "documentObjectKey" TEXT,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "requestedEnd" TIMESTAMP(3) NOT NULL,
    "approvedMinutes" INTEGER,
    "reason" TEXT,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollComponentDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentType" "PayrollComponentType" NOT NULL,
    "calculationType" "PayrollCalculationType" NOT NULL,
    "formula" TEXT,
    "defaultAmount" DECIMAL(18,2),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "affectsGross" BOOLEAN NOT NULL DEFAULT true,
    "affectsNet" BOOLEAN NOT NULL DEFAULT true,
    "proratable" BOOLEAN NOT NULL DEFAULT false,
    "attendanceBased" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayrollComponent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "percentage" DECIMAL(8,4),
    "formulaInputs" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "attendanceCutoffAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "payrollPeriodId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "taxRuleSetId" TEXT,
    "socialSecurityRuleSetId" TEXT,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerContributionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedJournalEntryId" TEXT,
    "adjustmentOfRunId" TEXT,
    "adjustmentSequence" INTEGER NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "adjustmentPostingDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceSnapshot" JSONB,
    "grossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxableIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employeeContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "incomeTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculationTrace" JSONB,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "componentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentType" "PayrollComponentType" NOT NULL,
    "quantity" DECIMAL(18,4),
    "rate" DECIMAL(18,4),
    "amount" DECIMAL(18,2) NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "objectKey" TEXT,
    "secureTokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "dataSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "bankAccountTokenRef" TEXT,
    "settlementAccountCode" TEXT,
    "accountingEventId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PayrollPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAccountingMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "componentCode" TEXT NOT NULL,
    "debitAccountId" TEXT,
    "creditAccountId" TEXT,
    "employerDebitAccountId" TEXT,
    "employerCreditAccountId" TEXT,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAccountingMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRuleSet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ID',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalReference" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "calculationMode" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "checksum" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "taxRuleSetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "formula" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTaxProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ID',
    "taxStatusCode" TEXT,
    "taxIdSecretRef" TEXT,
    "taxMethod" TEXT NOT NULL DEFAULT 'GROSS',
    "annualizationMethod" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialSecurityRuleSet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ID',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "parameters" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "legalReference" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSecurityRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSocialSecurityProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "healthMemberSecretRef" TEXT,
    "employmentMemberSecretRef" TEXT,
    "wageBase" DECIMAL(18,2),
    "programs" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSocialSecurityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeChannelBinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "channel" "EmployeeChannel" NOT NULL,
    "addressEncrypted" TEXT,
    "addressHash" TEXT,
    "externalUserId" TEXT,
    "verificationTokenHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeChannelBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeNotificationPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "eventCode" TEXT NOT NULL,
    "channel" "EmployeeChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeNotificationDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollResultId" TEXT,
    "eventCode" TEXT NOT NULL,
    "channel" "EmployeeChannel" NOT NULL,
    "notificationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "externalReference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendanceSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "scheduledCount" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "lateCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "leaveCount" INTEGER NOT NULL DEFAULT 0,
    "incompleteCount" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAttendanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriodSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employeeContributionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerContributionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriodSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "AccountingEventStatus" NOT NULL DEFAULT 'PENDING',
    "context" JSONB,
    "errorMessage" TEXT,
    "journalEntryId" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingEventLine" (
    "id" TEXT NOT NULL,
    "accountingEventId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemType" TEXT,
    "itemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "dimensions" JSONB,

    CONSTRAINT "AccountingEventLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPostingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "AccountingRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "conditions" JSONB,
    "journalLines" JSONB NOT NULL,
    "taxBehavior" JSONB,
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPosting" (
    "id" TEXT NOT NULL,
    "accountingEventId" TEXT NOT NULL,
    "ruleId" TEXT,
    "journalEntryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postingTrace" JSONB,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "AccountingPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "scope" "TaxScope" NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,
    "recoverable" BOOLEAN NOT NULL DEFAULT false,
    "payableAccountCode" TEXT,
    "receivableAccountCode" TEXT,
    "expenseAccountCode" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculationRules" JSONB,
    "legalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "accountingEventId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "direction" "TaxTransactionDirection" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxPeriod" TEXT,
    "taxableBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "TaxTransactionStatus" NOT NULL DEFAULT 'CALCULATED',
    "counterpartyType" TEXT,
    "counterpartyId" TEXT,
    "documentNumber" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxPeriod" TEXT,
    "counterpartyName" TEXT,
    "counterpartyTaxId" TEXT,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "externalReference" TEXT,
    "fileReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingCloseControl" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "module" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCloseControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeMonths" INTEGER,
    "residualValuePercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "assetAccountCode" TEXT,
    "accumulatedDepreciationCode" TEXT,
    "depreciationExpenseCode" TEXT,
    "maintenanceExpenseCode" TEXT,
    "defaultInspectionTemplateId" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "categoryId" TEXT NOT NULL,
    "parentAssetId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "serialNumber" TEXT,
    "registrationNumber" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "capitalizationDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "residualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bookValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "locationName" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "assignedEmployeeId" TEXT,
    "taxCodeId" TEXT,
    "supplierId" TEXT,
    "warrantyExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "assetId" TEXT NOT NULL,
    "type" "AssetTransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bookValueAfter" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "accountingEventId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "conditionAtIssue" JSONB,
    "conditionAtReturn" JSONB,
    "handoverInspectionId" TEXT,
    "returnInspectionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetDepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bookValueBefore" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bookValueAfter" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "trace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenancePlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "intervalOdometer" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "nextDueOdometer" INTEGER,
    "checklistTemplateId" TEXT,
    "autoCreateWorkOrder" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PLANNED',
    "maintenanceType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "vendorId" TEXT,
    "odometer" INTEGER,
    "estimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "inspectionId" TEXT,
    "accountingEventId" TEXT,
    "notes" TEXT,
    "parts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetId" TEXT,
    "code" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "capacityWeight" DECIMAL(18,3),
    "capacityVolume" DECIMAL(18,3),
    "currentOdometer" INTEGER NOT NULL DEFAULT 0,
    "fuelType" TEXT,
    "defaultDriverEmployeeId" TEXT,
    "gpsDeviceId" TEXT,
    "registrationExpiresAt" TIMESTAMP(3),
    "inspectionExpiresAt" TIMESTAMP(3),
    "insuranceExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDriverAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTrip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverEmployeeId" TEXT NOT NULL,
    "status" "DeliveryTripStatus" NOT NULL DEFAULT 'DRAFT',
    "originWarehouseId" TEXT,
    "plannedDepartureAt" TIMESTAMP(3),
    "actualDepartureAt" TIMESTAMP(3),
    "plannedReturnAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "startOdometer" INTEGER,
    "endOdometer" INTEGER,
    "totalWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "codExpected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "codCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "preTripInspectionId" TEXT,
    "loadingInspectionId" TEXT,
    "postTripInspectionId" TEXT,
    "gatePassId" TEXT,
    "routePlan" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "saleId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "DeliveryStopStatus" NOT NULL DEFAULT 'PENDING',
    "plannedArrivalAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "codExpected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "codCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "proofInspectionId" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryManifestItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "stopId" TEXT,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "serialId" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "scannedQty" INTEGER NOT NULL DEFAULT 0,
    "loadedQty" INTEGER NOT NULL DEFAULT 0,
    "deliveredQty" INTEGER NOT NULL DEFAULT 0,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryManifestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT,
    "supplierId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liters" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "odometer" INTEGER,
    "vendorName" TEXT,
    "receiptNumber" TEXT,
    "taxCodeId" TEXT,
    "accountingEventId" TEXT,
    "evidenceReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMeterReading" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "readingType" TEXT NOT NULL DEFAULT 'ODOMETER',
    "value" DECIMAL(18,3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "recordedById" TEXT,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "responseType" TEXT NOT NULL DEFAULT 'PASS_FAIL',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "expectedValue" JSONB,
    "failureSeverity" TEXT NOT NULL DEFAULT 'BLOCKING',
    "sequence" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "inspectedById" TEXT,
    "reviewedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "summary" JSONB,
    "mismatchCount" INTEGER NOT NULL DEFAULT 0,
    "blockingFailureCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResultItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "result" "InspectionResultCode" NOT NULL,
    "value" JSONB,
    "productId" TEXT,
    "expectedQty" INTEGER,
    "scannedQty" INTEGER,
    "acceptedQty" INTEGER,
    "rejectedQty" INTEGER,
    "damagedQty" INTEGER,
    "missingQty" INTEGER,
    "extraQty" INTEGER,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionResultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionEvidence" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sha256" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "capturedAt" TIMESTAMP(3),
    "capturedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalConfirmation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "confirmationType" TEXT NOT NULL,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "confirmedById" TEXT,
    "inspectionId" TEXT,
    "conditions" JSONB,
    "decision" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "direction" "GatePassDirection" NOT NULL,
    "status" "GatePassStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "plateNumber" TEXT,
    "driverName" TEXT,
    "driverEmployeeId" TEXT,
    "inspectionId" TEXT,
    "checkedById" TEXT,
    "approvedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "movementAt" TIMESTAMP(3),
    "documents" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requireInspection" BOOLEAN NOT NULL DEFAULT false,
    "requirePhoto" BOOLEAN NOT NULL DEFAULT false,
    "requireBarcodeScan" BOOLEAN NOT NULL DEFAULT false,
    "requireBatchScan" BOOLEAN NOT NULL DEFAULT false,
    "requireSerialScan" BOOLEAN NOT NULL DEFAULT false,
    "requireVehicle" BOOLEAN NOT NULL DEFAULT false,
    "requireGatePass" BOOLEAN NOT NULL DEFAULT false,
    "requireGeofence" BOOLEAN NOT NULL DEFAULT false,
    "requiredConfirmations" INTEGER NOT NULL DEFAULT 1,
    "blockOnMismatch" BOOLEAN NOT NULL DEFAULT true,
    "quantityTolerancePercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "autoPostInventory" BOOLEAN NOT NULL DEFAULT true,
    "autoPostAccounting" BOOLEAN NOT NULL DEFAULT true,
    "autoCalculateTax" BOOLEAN NOT NULL DEFAULT true,
    "approvalPolicyCode" TEXT,
    "inspectionTemplateCode" TEXT,
    "workflow" JSONB,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ruleCode" TEXT,
    "actionType" TEXT NOT NULL,
    "status" "AutomationJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalFinanceTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counterpartyType" TEXT,
    "counterpartyId" TEXT,
    "counterpartyName" TEXT,
    "description" TEXT NOT NULL,
    "netAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "debitAccountCode" TEXT NOT NULL,
    "creditAccountCode" TEXT NOT NULL,
    "taxAccountCode" TEXT,
    "paymentMethod" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "evidence" JSONB,
    "metadata" JSONB,
    "approvalRequestId" TEXT,
    "accountingEventId" TEXT,
    "taxDocumentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalFinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(65,30) NOT NULL,
    "minSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(65,30),
    "memberTier" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'ALL',
    "productIds" JSONB,
    "minQuantity" INTEGER,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "promoRuleId" TEXT NOT NULL,
    "customerId" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" DECIMAL(65,30) NOT NULL,
    "newValue" DECIMAL(65,30) NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterReference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "attributes" JSONB,
    "costPrice" DECIMAL(65,30),
    "salePrice" DECIMAL(65,30),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT 'BASE',
    "unitCode" TEXT NOT NULL,
    "quantityFactor" INTEGER NOT NULL,
    "isDefaultSale" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultPurchase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBarcode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "code" TEXT NOT NULL,
    "unitCode" TEXT,
    "quantityFactor" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productUnitId" TEXT,
    "branchId" TEXT,
    "segmentCode" TEXT NOT NULL DEFAULT 'RETAIL',
    "unitCode" TEXT,
    "minQty" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "SyncNodeRole" NOT NULL DEFAULT 'BRANCH',
    "branchId" TEXT,
    "protocolVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" TIMESTAMP(3),
    "duplicatesSuppressed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPeer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "peerNodeId" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "sharedSecretRef" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncPeer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "SyncEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "peerNodeId" TEXT NOT NULL,
    "cursor" TEXT,
    "lastEventId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lagCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncInbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "peerNodeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "outcome" "SyncInboxOutcome" NOT NULL DEFAULT 'APPLIED',
    "conflict" JSONB,
    "errorMessage" TEXT,
    "payloadDigest" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPeerNonce" (
    "id" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "requestAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncPeerNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "peerNodeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "remoteVersion" INTEGER,
    "strategy" "SyncConflictStrategy" NOT NULL DEFAULT 'PENDING',
    "resolution" JSONB,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncAggregateVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncAggregateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineCapability" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "degradedImpact" TEXT,
    "offlineCapable" BOOLEAN NOT NULL DEFAULT false,
    "localAuthoritative" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeCapabilityPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "flowCode" TEXT NOT NULL,
    "offlineCapable" BOOLEAN NOT NULL,
    "degradedImpact" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeCapabilityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReadWatermark" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "sourceCursor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncReadWatermark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchConnectivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "nodeId" TEXT,
    "state" "BranchConnectionState" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lagCount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchConnectivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchTransferSync" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "destinationNodeId" TEXT,
    "shippedEventId" TEXT,
    "destinationAckedAt" TIMESTAMP(3),
    "destinationAckedBy" TEXT,
    "state" "BranchTransferSyncState" NOT NULL DEFAULT 'AWAITING_DESTINATION',
    "sourceQuantity" INTEGER NOT NULL DEFAULT 0,
    "destinationQuantity" INTEGER,
    "discrepancyReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchTransferSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramIdentityBinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "platformChatId" TEXT,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramIdentityBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileOpnameDraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "opnameId" TEXT,
    "lines" JSONB NOT NULL,
    "status" "MobileDraftStatus" NOT NULL DEFAULT 'OPEN',
    "deviceLocalAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileOpnameDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyReceipt_status_createdAt_idx" ON "IdempotencyReceipt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyReceipt_expiresAt_idx" ON "IdempotencyReceipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyReceipt_companyId_scope_key_key" ON "IdempotencyReceipt"("companyId", "scope", "key");

-- CreateIndex
CREATE INDEX "DailySalesSummary_companyId_businessDate_idx" ON "DailySalesSummary"("companyId", "businessDate");

-- CreateIndex
CREATE INDEX "DailySalesSummary_businessDate_branchId_idx" ON "DailySalesSummary"("businessDate", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesSummary_branchId_businessDate_channel_key" ON "DailySalesSummary"("branchId", "businessDate", "channel");

-- CreateIndex
CREATE INDEX "DailyFinanceSummary_companyId_businessDate_idx" ON "DailyFinanceSummary"("companyId", "businessDate");

-- CreateIndex
CREATE INDEX "DailyFinanceSummary_accountId_businessDate_idx" ON "DailyFinanceSummary"("accountId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyFinanceSummary_branchId_businessDate_accountId_key" ON "DailyFinanceSummary"("branchId", "businessDate", "accountId");

-- CreateIndex
CREATE INDEX "DailyInventorySummary_companyId_businessDate_idx" ON "DailyInventorySummary"("companyId", "businessDate");

-- CreateIndex
CREATE INDEX "DailyInventorySummary_businessDate_warehouseId_idx" ON "DailyInventorySummary"("businessDate", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyInventorySummary_warehouseId_businessDate_key" ON "DailyInventorySummary"("warehouseId", "businessDate");

-- CreateIndex
CREATE INDEX "ReportJob_companyId_status_createdAt_idx" ON "ReportJob"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_status_createdAt_idx" ON "ReportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_scheduleId_createdAt_idx" ON "ReportJob"("scheduleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportJob_scheduleId_scheduledFor_key" ON "ReportJob"("scheduleId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "ReportSchedule_companyId_branchId_isActive_idx" ON "ReportSchedule"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchedule_companyId_branchId_name_key" ON "ReportSchedule"("companyId", "branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_companyId_entityType_key" ON "DataRetentionPolicy"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "DataArchiveRun_companyId_entityType_createdAt_idx" ON "DataArchiveRun"("companyId", "entityType", "createdAt");

-- CreateIndex
CREATE INDEX "DataArchiveRun_status_createdAt_idx" ON "DataArchiveRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_activeBranchId_revokedAt_expiresAt_idx" ON "AuthSession"("activeBranchId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_blockedUntil_idx" ON "RateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE INDEX "RateLimitBucket_updatedAt_idx" ON "RateLimitBucket"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_scope_keyHash_key" ON "RateLimitBucket"("scope", "keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Category_companyId_parentId_isActive_sortOrder_name_idx" ON "Category"("companyId", "parentId", "isActive", "sortOrder", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_slug_key" ON "Category"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_companyId_isActive_name_id_idx" ON "Product"("companyId", "isActive", "name", "id");

-- CreateIndex
CREATE INDEX "Product_companyId_sku_idx" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE INDEX "Product_isActive_name_id_idx" ON "Product"("isActive", "name", "id");

-- CreateIndex
CREATE INDEX "Product_createdAt_id_idx" ON "Product"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductionRecipe_companyId_isActive_name_idx" ON "ProductionRecipe"("companyId", "isActive", "name");

-- CreateIndex
CREATE INDEX "ProductionRecipe_outputProductId_idx" ON "ProductionRecipe"("outputProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRecipe_companyId_code_version_key" ON "ProductionRecipe"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "ProductionRecipeItem_componentProductId_idx" ON "ProductionRecipeItem"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRecipeItem_recipeId_componentProductId_key" ON "ProductionRecipeItem"("recipeId", "componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_number_key" ON "ProductionOrder"("number");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_branchId_status_createdAt_idx" ON "ProductionOrder"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionOrder_warehouseId_status_idx" ON "ProductionOrder"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "ProductionOrder_recipeId_idx" ON "ProductionOrder"("recipeId");

-- CreateIndex
CREATE INDEX "ProductionOrderComponent_productId_idx" ON "ProductionOrderComponent"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderComponent_orderId_productId_key" ON "ProductionOrderComponent"("orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_companyId_name_id_idx" ON "Supplier"("companyId", "name", "id");

-- CreateIndex
CREATE INDEX "Supplier_companyId_code_idx" ON "Supplier"("companyId", "code");

-- CreateIndex
CREATE INDEX "Supplier_name_id_idx" ON "Supplier"("name", "id");

-- CreateIndex
CREATE INDEX "Supplier_createdAt_id_idx" ON "Supplier"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_available_idx" ON "Inventory"("warehouseId", "available");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_updatedAt_id_idx" ON "Inventory"("warehouseId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Inventory_updatedAt_id_idx" ON "Inventory"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_warehouseId_productId_key" ON "Inventory"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_productId_createdAt_idx" ON "InventoryMovement"("warehouseId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_productId_occurredAt_idx" ON "InventoryMovement"("warehouseId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_locationId_productId_createdAt_idx" ON "InventoryMovement"("locationId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_id_idx" ON "InventoryMovement"("createdAt", "id");

-- CreateIndex
CREATE INDEX "InventoryMovement_occurredAt_id_idx" ON "InventoryMovement"("occurredAt", "id");

-- CreateIndex
CREATE INDEX "InventoryConditionBalance_warehouseId_productId_condition_idx" ON "InventoryConditionBalance"("warehouseId", "productId", "condition");

-- CreateIndex
CREATE INDEX "InventoryConditionBalance_warehouseId_locationId_condition_idx" ON "InventoryConditionBalance"("warehouseId", "locationId", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryConditionBalance_locationId_productId_condition_key" ON "InventoryConditionBalance"("locationId", "productId", "condition");

-- CreateIndex
CREATE INDEX "InventoryConditionMovement_warehouseId_productId_createdAt_idx" ON "InventoryConditionMovement"("warehouseId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryConditionMovement_locationId_productId_createdAt_idx" ON "InventoryConditionMovement"("locationId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryConditionMovement_referenceType_referenceId_idx" ON "InventoryConditionMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_approvalRequestId_key" ON "PurchaseRequest"("approvalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_purchaseOrderId_key" ON "PurchaseRequest"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_companyId_branchId_status_createdAt_idx" ON "PurchaseRequest"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequest_warehouseId_status_idx" ON "PurchaseRequest"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_supplierId_status_idx" ON "PurchaseRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_purchaseRequestId_idx" ON "PurchaseRequestItem"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_productId_idx" ON "PurchaseRequestItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_warehouseId_status_orderDate_idx" ON "PurchaseOrder"("warehouseId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_orderDate_idx" ON "PurchaseOrder"("supplierId", "orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_id_idx" ON "PurchaseOrder"("createdAt", "id");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_number_key" ON "GoodsReceipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_accountingEventId_key" ON "GoodsReceipt"("accountingEventId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_warehouseId_receivedAt_idx" ON "GoodsReceipt"("warehouseId", "receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_receivedAt_idx" ON "GoodsReceipt"("supplierId", "receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_createdAt_id_idx" ON "GoodsReceipt"("createdAt", "id");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_productId_idx" ON "GoodsReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "Customer_companyId_name_id_idx" ON "Customer"("companyId", "name", "id");

-- CreateIndex
CREATE INDEX "Customer_companyId_phone_idx" ON "Customer"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_email_key" ON "Customer"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_customerId_key" ON "CustomerAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_expiresAt_idx" ON "CustomerSession"("customerId", "expiresAt");

-- CreateIndex
CREATE INDEX "CustomerSession_expiresAt_revokedAt_idx" ON "CustomerSession"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "CustomerVerificationToken_customerId_type_createdAt_idx" ON "CustomerVerificationToken"("customerId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerVerificationToken_expiresAt_consumedAt_idx" ON "CustomerVerificationToken"("expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_isActive_isDefault_idx" ON "CustomerAddress"("customerId", "isActive", "isDefault");

-- CreateIndex
CREATE INDEX "ProductFavorite_productId_createdAt_idx" ON "ProductFavorite"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFavorite_customerId_productId_key" ON "ProductFavorite"("customerId", "productId");

-- CreateIndex
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_customerId_createdAt_idx" ON "ProductReview"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_customerId_productId_key" ON "ProductReview"("customerId", "productId");

-- CreateIndex
CREATE INDEX "CashierCashMovement_cashierShiftId_createdAt_idx" ON "CashierCashMovement"("cashierShiftId", "createdAt");

-- CreateIndex
CREATE INDEX "CashierCashMovement_createdById_createdAt_idx" ON "CashierCashMovement"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_accountingEventId_key" ON "Sale"("accountingEventId");

-- CreateIndex
CREATE INDEX "Sale_branchId_createdAt_idx" ON "Sale"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_warehouseId_createdAt_idx" ON "Sale"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_createdAt_idx" ON "Sale"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_createdAt_id_idx" ON "Sale"("createdAt", "id");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_saleId_idx" ON "SaleItem"("productId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accountingEventId_key" ON "Order"("accountingEventId");

-- CreateIndex
CREATE INDEX "Order_branchId_status_createdAt_idx" ON "Order"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_warehouseId_status_createdAt_idx" ON "Order"("warehouseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");

-- CreateIndex
CREATE INDEX "Order_createdAt_id_idx" ON "Order"("createdAt", "id");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_orderId_idx" ON "OrderItem"("productId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_externalRef_idx" ON "Payment"("externalRef");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_companyId_branchId_receivedAt_idx" ON "PaymentProviderEvent"("companyId", "branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_provider_externalRef_idx" ON "PaymentProviderEvent"("provider", "externalRef");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_paymentId_idx" ON "PaymentProviderEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_orderId_idx" ON "PaymentProviderEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_integrationId_eventId_key" ON "PaymentProviderEvent"("integrationId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_branchId_code_key" ON "Account"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalEntry_date_id_idx" ON "JournalEntry"("date", "id");

-- CreateIndex
CREATE INDEX "JournalEntry_referenceType_referenceId_idx" ON "JournalEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_journalEntryId_idx" ON "JournalLine"("accountId", "journalEntryId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffMemo_companyId_branchId_userId_archivedAt_isPinned_upd_idx" ON "StaffMemo"("companyId", "branchId", "userId", "archivedAt", "isPinned", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMemo_userId_branchId_operationKey_key" ON "StaffMemo"("userId", "branchId", "operationKey");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_enabled_idx" ON "FeatureFlag"("key", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_companyId_branchId_userId_key_key" ON "FeatureFlag"("companyId", "branchId", "userId", "key");

-- CreateIndex
CREATE INDEX "SystemSetting_namespace_key_idx" ON "SystemSetting"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_companyId_branchId_userId_namespace_key_key" ON "SystemSetting"("companyId", "branchId", "userId", "namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleDefinition_code_key" ON "ModuleDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UiSchemaDefinition_companyId_branchId_code_version_key" ON "UiSchemaDefinition"("companyId", "branchId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_companyId_entityType_key_key" ON "CustomFieldDefinition"("companyId", "entityType", "key");

-- CreateIndex
CREATE INDEX "CustomFieldValue_entityType_entityId_idx" ON "CustomFieldValue"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_definitionId_entityId_key" ON "CustomFieldValue"("definitionId", "entityId");

-- CreateIndex
CREATE INDEX "BusinessRule_trigger_isActive_idx" ON "BusinessRule"("trigger", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRule_companyId_code_key" ON "BusinessRule"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_companyId_branchId_documentType_key" ON "NumberSequence"("companyId", "branchId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_companyId_branchId_type_provider_name_key" ON "IntegrationConnection"("companyId", "branchId", "type", "provider", "name");

-- CreateIndex
CREATE INDEX "DigitalServiceProduct_companyId_active_category_brand_idx" ON "DigitalServiceProduct"("companyId", "active", "category", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalServiceProduct_integrationId_providerSku_key" ON "DigitalServiceProduct"("integrationId", "providerSku");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalServiceTransaction_number_key" ON "DigitalServiceTransaction"("number");

-- CreateIndex
CREATE INDEX "DigitalServiceTransaction_companyId_branchId_status_created_idx" ON "DigitalServiceTransaction"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DigitalServiceTransaction_integrationId_providerSku_idx" ON "DigitalServiceTransaction"("integrationId", "providerSku");

-- CreateIndex
CREATE INDEX "DigitalServiceTransaction_companyId_branchId_cashierShiftId_idx" ON "DigitalServiceTransaction"("companyId", "branchId", "cashierShiftId", "capturedAt");

-- CreateIndex
CREATE INDEX "DigitalServiceTransaction_companyId_branchId_refundCashierS_idx" ON "DigitalServiceTransaction"("companyId", "branchId", "refundCashierShiftId", "refundedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalServiceTransaction_companyId_idempotencyKey_key" ON "DigitalServiceTransaction"("companyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMapping_integrationId_entityType_internalId_key" ON "ExternalMapping"("integrationId", "entityType", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMapping_integrationId_entityType_externalId_key" ON "ExternalMapping"("integrationId", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_deliveredAt_idx" ON "WebhookDelivery"("status", "deliveredAt");

-- CreateIndex
CREATE INDEX "EventOutbox_status_availableAt_idx" ON "EventOutbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "EventOutbox_aggregateType_aggregateId_idx" ON "EventOutbox"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "EventOutbox_status_publishedAt_idx" ON "EventOutbox"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_companyId_code_key" ON "ApprovalPolicy"("companyId", "code");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_requestedAt_idx" ON "ApprovalRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_branchId_status_idx" ON "ApprovalRequest"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_expiresAt_idx" ON "ApprovalRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_delegatedToId_status_idx" ON "ApprovalRequest"("delegatedToId", "status");

-- CreateIndex
CREATE INDEX "ApprovalDecision_requestId_step_idx" ON "ApprovalDecision"("requestId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_code_key" ON "WarehouseLocation"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "InventoryLocationBalance_warehouseId_productId_idx" ON "InventoryLocationBalance"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "InventoryLocationBalance_warehouseId_available_idx" ON "InventoryLocationBalance"("warehouseId", "available");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocationBalance_locationId_productId_key" ON "InventoryLocationBalance"("locationId", "productId");

-- CreateIndex
CREATE INDEX "InventoryReservation_warehouseId_productId_status_idx" ON "InventoryReservation"("warehouseId", "productId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_sourceType_sourceId_status_idx" ON "InventoryReservation"("sourceType", "sourceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_sourceType_sourceId_locationId_product_key" ON "InventoryReservation"("sourceType", "sourceId", "locationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_number_key" ON "StockTransfer"("number");

-- CreateIndex
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_number_key" ON "StockOpname"("number");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameItem_opnameId_productId_batchNumber_key" ON "StockOpnameItem"("opnameId", "productId", "batchNumber");

-- CreateIndex
CREATE INDEX "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_warehouseId_productId_batchNumber_key" ON "InventoryBatch"("warehouseId", "productId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySerial_serialNumber_key" ON "InventorySerial"("serialNumber");

-- CreateIndex
CREATE INDEX "InventorySerial_warehouseId_productId_status_idx" ON "InventorySerial"("warehouseId", "productId", "status");

-- CreateIndex
CREATE INDEX "CostingPolicy_companyId_branchId_status_idx" ON "CostingPolicy"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "CostingPolicy_companyId_status_effectiveFrom_idx" ON "CostingPolicy"("companyId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CostingPolicy_companyId_scopeKey_version_key" ON "CostingPolicy"("companyId", "scopeKey", "version");

-- CreateIndex
CREATE INDEX "InventoryCostState_companyId_warehouseId_productId_idx" ON "InventoryCostState"("companyId", "warehouseId", "productId");

-- CreateIndex
CREATE INDEX "InventoryCostState_companyId_branchId_productId_idx" ON "InventoryCostState"("companyId", "branchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCostState_companyId_branchId_warehouseId_productId_key" ON "InventoryCostState"("companyId", "branchId", "warehouseId", "productId", "batchKey", "method");

-- CreateIndex
CREATE INDEX "InventoryCostEvent_companyId_branchId_warehouseId_productId_idx" ON "InventoryCostEvent"("companyId", "branchId", "warehouseId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryCostEvent_movementId_idx" ON "InventoryCostEvent"("movementId");

-- CreateIndex
CREATE INDEX "InventoryCostEvent_reversalOfId_idx" ON "InventoryCostEvent"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCostEvent_companyId_operationKey_key" ON "InventoryCostEvent"("companyId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCostEvent_companyId_sourceType_sourceId_sourceLine_key" ON "InventoryCostEvent"("companyId", "sourceType", "sourceId", "sourceLineKey", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCostLayer_sourceEventId_key" ON "InventoryCostLayer"("sourceEventId");

-- CreateIndex
CREATE INDEX "InventoryCostLayer_companyId_branchId_warehouseId_productId_idx" ON "InventoryCostLayer"("companyId", "branchId", "warehouseId", "productId", "batchKey", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "InventoryCostLayer_companyId_method_status_receivedAt_idx" ON "InventoryCostLayer"("companyId", "method", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "InventoryCostConsumption_companyId_layerId_idx" ON "InventoryCostConsumption"("companyId", "layerId");

-- CreateIndex
CREATE INDEX "InventoryCostConsumption_eventId_idx" ON "InventoryCostConsumption"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCostConsumption_layerId_eventId_key" ON "InventoryCostConsumption"("layerId", "eventId");

-- CreateIndex
CREATE INDEX "CostingRebuildRun_companyId_branchId_status_createdAt_idx" ON "CostingRebuildRun"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CostingRebuildRun_companyId_warehouseId_fromDate_toDate_idx" ON "CostingRebuildRun"("companyId", "warehouseId", "fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "CostingRebuildRun_companyId_operationKey_key" ON "CostingRebuildRun"("companyId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturn_number_key" ON "OrderReturn"("number");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturn_accountingEventId_key" ON "OrderReturn"("accountingEventId");

-- CreateIndex
CREATE INDEX "OrderReturn_companyId_branchId_status_createdAt_idx" ON "OrderReturn"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_orderId_createdAt_idx" ON "OrderReturn"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_customerId_createdAt_idx" ON "OrderReturn"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturnItem_orderReturnId_idx" ON "OrderReturnItem"("orderReturnId");

-- CreateIndex
CREATE INDEX "OrderReturnItem_orderItemId_idx" ON "OrderReturnItem"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderReturnItem_productId_idx" ON "OrderReturnItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_number_key" ON "SaleReturn"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_number_key" ON "PurchaseReturn"("number");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_programId_customerId_key" ON "LoyaltyAccount"("programId", "customerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_accountId_createdAt_idx" ON "LoyaltyTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_companyId_branchId_startDate_endDate_key" ON "FiscalPeriod"("companyId", "branchId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Device_companyId_code_key" ON "Device"("companyId", "code");

-- CreateIndex
CREATE INDEX "DeviceCredential_deviceId_status_createdAt_idx" ON "DeviceCredential"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_deviceId_keyId_key" ON "DeviceCredential"("deviceId", "keyId");

-- CreateIndex
CREATE INDEX "DeviceAuthNonce_credentialId_createdAt_idx" ON "DeviceAuthNonce"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceAuthNonce_createdAt_idx" ON "DeviceAuthNonce"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAuthNonce_credentialId_nonce_key" ON "DeviceAuthNonce"("credentialId", "nonce");

-- CreateIndex
CREATE INDEX "SyncReceipt_deviceId_status_createdAt_idx" ON "SyncReceipt"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncReceipt_companyId_branchId_createdAt_idx" ON "SyncReceipt"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncReceipt_deviceId_requestHash_key" ON "SyncReceipt"("deviceId", "requestHash");

-- CreateIndex
CREATE INDEX "OfflineTransaction_status_receivedAt_idx" ON "OfflineTransaction"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineTransaction_deviceId_localId_key" ON "OfflineTransaction"("deviceId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineTransaction_deviceId_sequence_key" ON "OfflineTransaction"("deviceId", "sequence");

-- CreateIndex
CREATE INDEX "ReorderSuggestion_warehouseId_productId_status_idx" ON "ReorderSuggestion"("warehouseId", "productId", "status");

-- CreateIndex
CREATE INDEX "OperatorInsight_companyId_branchId_status_severity_idx" ON "OperatorInsight"("companyId", "branchId", "status", "severity");

-- CreateIndex
CREATE INDEX "OperatorInsight_companyId_branchId_fingerprint_status_idx" ON "OperatorInsight"("companyId", "branchId", "fingerprint", "status");

-- CreateIndex
CREATE INDEX "AssistantInteraction_companyId_branchId_userId_createdAt_idx" ON "AssistantInteraction"("companyId", "branchId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_integrationId_externalOrderId_key" ON "MarketplaceOrder"("integrationId", "externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_companyId_code_channel_key" ON "NotificationTemplate"("companyId", "code", "channel");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_companyId_keyPrefix_key" ON "ApiKey"("companyId", "keyPrefix");

-- CreateIndex
CREATE INDEX "Department_companyId_isActive_name_idx" ON "Department"("companyId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE INDEX "Position_companyId_departmentId_isActive_idx" ON "Position"("companyId", "departmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Position_companyId_code_key" ON "Position"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_accountingEventId_key" ON "Employee"("accountingEventId");

-- CreateIndex
CREATE INDEX "Employee_companyId_branchId_isActive_idx" ON "Employee"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_departmentId_positionId_isActive_idx" ON "Employee"("departmentId", "positionId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeNumber_key" ON "Employee"("companyId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_userId_key" ON "Employee"("companyId", "userId");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_employeeId_effectiveFrom_idx" ON "EmployeeAssignment"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_branchId_effectiveFrom_idx" ON "EmployeeAssignment"("branchId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "WorkShift_companyId_branchId_isActive_idx" ON "WorkShift"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShift_companyId_code_key" ON "WorkShift"("companyId", "code");

-- CreateIndex
CREATE INDEX "EmployeeSchedule_companyId_branchId_workDate_idx" ON "EmployeeSchedule"("companyId", "branchId", "workDate");

-- CreateIndex
CREATE INDEX "EmployeeSchedule_shiftId_workDate_idx" ON "EmployeeSchedule"("shiftId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSchedule_employeeId_workDate_key" ON "EmployeeSchedule"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "AttendancePolicy_companyId_branchId_isActive_idx" ON "AttendancePolicy"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicy_companyId_code_key" ON "AttendancePolicy"("companyId", "code");

-- CreateIndex
CREATE INDEX "AttendanceGeofence_companyId_branchId_isActive_idx" ON "AttendanceGeofence"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceGeofence_companyId_code_key" ON "AttendanceGeofence"("companyId", "code");

-- CreateIndex
CREATE INDEX "AttendanceDevice_companyId_branchId_status_idx" ON "AttendanceDevice"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "AttendanceDevice_lastSeenAt_idx" ON "AttendanceDevice"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_companyId_code_key" ON "AttendanceDevice"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_companyId_serialNumber_key" ON "AttendanceDevice"("companyId", "serialNumber");

-- CreateIndex
CREATE INDEX "EmployeeBiometricCredential_employeeId_status_idx" ON "EmployeeBiometricCredential"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeBiometricCredential_companyId_attendanceDeviceId_de_key" ON "EmployeeBiometricCredential"("companyId", "attendanceDeviceId", "deviceUserCode", "biometricType");

-- CreateIndex
CREATE INDEX "AttendanceEvent_employeeId_occurredAt_idx" ON "AttendanceEvent"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_companyId_branchId_occurredAt_idx" ON "AttendanceEvent"("companyId", "branchId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_deviceId_occurredAt_idx" ON "AttendanceEvent"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_status_receivedAt_idx" ON "AttendanceEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_createdAt_idx" ON "AttendanceEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_companyId_externalEventId_key" ON "AttendanceEvent"("companyId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_companyId_operationId_key" ON "AttendanceEvent"("companyId", "operationId");

-- CreateIndex
CREATE INDEX "AttendancePhotoEvidence_employeeId_capturedAt_idx" ON "AttendancePhotoEvidence"("employeeId", "capturedAt");

-- CreateIndex
CREATE INDEX "AttendancePhotoEvidence_retentionUntil_idx" ON "AttendancePhotoEvidence"("retentionUntil");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_branchId_workDate_idx" ON "AttendanceRecord"("companyId", "branchId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_workDate_idx" ON "AttendanceRecord"("status", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_workDate_key" ON "AttendanceRecord"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_companyId_status_createdAt_idx" ON "AttendanceCorrection"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_employeeId_createdAt_idx" ON "AttendanceCorrection"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_companyId_code_key" ON "LeaveType"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_startDate_idx" ON "LeaveRequest"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_status_startDate_idx" ON "LeaveRequest"("companyId", "status", "startDate");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_requestedStart_idx" ON "OvertimeRequest"("employeeId", "requestedStart");

-- CreateIndex
CREATE INDEX "OvertimeRequest_companyId_status_requestedStart_idx" ON "OvertimeRequest"("companyId", "status", "requestedStart");

-- CreateIndex
CREATE INDEX "PayrollComponentDefinition_companyId_componentType_isActive_idx" ON "PayrollComponentDefinition"("companyId", "componentType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponentDefinition_companyId_code_key" ON "PayrollComponentDefinition"("companyId", "code");

-- CreateIndex
CREATE INDEX "EmployeePayrollComponent_employeeId_effectiveFrom_idx" ON "EmployeePayrollComponent"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeePayrollComponent_componentId_isActive_idx" ON "EmployeePayrollComponent"("componentId", "isActive");

-- CreateIndex
CREATE INDEX "PayrollPeriod_companyId_startDate_endDate_idx" ON "PayrollPeriod"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_code_key" ON "PayrollPeriod"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_year_month_key" ON "PayrollPeriod"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_branchId_createdAt_idx" ON "PayrollRun"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_branchId_status_createdAt_idx" ON "PayrollRun"("companyId", "branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRun_payrollPeriodId_status_idx" ON "PayrollRun"("payrollPeriodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_number_key" ON "PayrollRun"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_branchId_adjustmentOfRunId_adjustmentS_key" ON "PayrollRun"("companyId", "branchId", "adjustmentOfRunId", "adjustmentSequence");

-- CreateIndex
CREATE INDEX "PayrollResult_employeeId_payrollPeriodId_idx" ON "PayrollResult"("employeeId", "payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollResult_companyId_payrollPeriodId_status_idx" ON "PayrollResult"("companyId", "payrollPeriodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollResult_payrollRunId_employeeId_key" ON "PayrollResult"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollLine_payrollResultId_componentType_idx" ON "PayrollLine"("payrollResultId", "componentType");

-- CreateIndex
CREATE INDEX "PayrollLine_componentId_idx" ON "PayrollLine"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollResultId_key" ON "Payslip"("payrollResultId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_createdAt_idx" ON "Payslip"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Payslip_tokenExpiresAt_idx" ON "Payslip"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_companyId_number_key" ON "Payslip"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_accountingEventId_key" ON "PayrollPayment"("accountingEventId");

-- CreateIndex
CREATE INDEX "PayrollPayment_companyId_status_createdAt_idx" ON "PayrollPayment"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollPayment_payrollRunId_status_idx" ON "PayrollPayment"("payrollRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_payrollResultId_key" ON "PayrollPayment"("payrollResultId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAccountingMapping_companyId_branchId_componentCode_key" ON "PayrollAccountingMapping"("companyId", "branchId", "componentCode");

-- CreateIndex
CREATE INDEX "TaxRuleSet_companyId_countryCode_effectiveFrom_status_idx" ON "TaxRuleSet"("companyId", "countryCode", "effectiveFrom", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleSet_companyId_code_version_key" ON "TaxRuleSet"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "TaxRule_taxRuleSetId_priority_isActive_idx" ON "TaxRule"("taxRuleSetId", "priority", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_taxRuleSetId_code_key" ON "TaxRule"("taxRuleSetId", "code");

-- CreateIndex
CREATE INDEX "EmployeeTaxProfile_companyId_taxStatusCode_idx" ON "EmployeeTaxProfile"("companyId", "taxStatusCode");

-- CreateIndex
CREATE INDEX "EmployeeTaxProfile_companyId_employeeId_effectiveFrom_idx" ON "EmployeeTaxProfile"("companyId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTaxProfile_employeeId_effectiveFrom_key" ON "EmployeeTaxProfile"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "SocialSecurityRuleSet_companyId_effectiveFrom_status_idx" ON "SocialSecurityRuleSet"("companyId", "effectiveFrom", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialSecurityRuleSet_companyId_code_version_key" ON "SocialSecurityRuleSet"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "EmployeeSocialSecurityProfile_companyId_effectiveFrom_idx" ON "EmployeeSocialSecurityProfile"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeSocialSecurityProfile_companyId_employeeId_effectiv_idx" ON "EmployeeSocialSecurityProfile"("companyId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSocialSecurityProfile_employeeId_effectiveFrom_key" ON "EmployeeSocialSecurityProfile"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeChannelBinding_companyId_channel_verifiedAt_idx" ON "EmployeeChannelBinding"("companyId", "channel", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeChannelBinding_employeeId_channel_addressHash_key" ON "EmployeeChannelBinding"("employeeId", "channel", "addressHash");

-- CreateIndex
CREATE INDEX "EmployeeNotificationPreference_companyId_eventCode_enabled_idx" ON "EmployeeNotificationPreference"("companyId", "eventCode", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeNotificationPreference_employeeId_eventCode_channel_key" ON "EmployeeNotificationPreference"("employeeId", "eventCode", "channel");

-- CreateIndex
CREATE INDEX "EmployeeNotificationDelivery_companyId_status_createdAt_idx" ON "EmployeeNotificationDelivery"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeNotificationDelivery_employeeId_eventCode_createdAt_idx" ON "EmployeeNotificationDelivery"("employeeId", "eventCode", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeNotificationDelivery_status_sentAt_idx" ON "EmployeeNotificationDelivery"("status", "sentAt");

-- CreateIndex
CREATE INDEX "DailyAttendanceSummary_companyId_businessDate_idx" ON "DailyAttendanceSummary"("companyId", "businessDate");

-- CreateIndex
CREATE INDEX "DailyAttendanceSummary_branchId_businessDate_idx" ON "DailyAttendanceSummary"("branchId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceSummary_companyId_branchId_businessDate_key" ON "DailyAttendanceSummary"("companyId", "branchId", "businessDate");

-- CreateIndex
CREATE INDEX "PayrollPeriodSummary_companyId_payrollPeriodId_idx" ON "PayrollPeriodSummary"("companyId", "payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSummary_branchId_payrollPeriodId_idx" ON "PayrollPeriodSummary"("branchId", "payrollPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriodSummary_payrollPeriodId_branchId_key" ON "PayrollPeriodSummary"("payrollPeriodId", "branchId");

-- CreateIndex
CREATE INDEX "AccountingEvent_companyId_branchId_createdAt_id_idx" ON "AccountingEvent"("companyId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AccountingEvent_companyId_eventType_businessDate_idx" ON "AccountingEvent"("companyId", "eventType", "businessDate");

-- CreateIndex
CREATE INDEX "AccountingEvent_sourceType_sourceId_idx" ON "AccountingEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AccountingEvent_status_createdAt_idx" ON "AccountingEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingEvent_companyId_idempotencyKey_key" ON "AccountingEvent"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AccountingEventLine_itemType_itemId_idx" ON "AccountingEventLine"("itemType", "itemId");

-- CreateIndex
CREATE INDEX "AccountingEventLine_taxCodeId_idx" ON "AccountingEventLine"("taxCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingEventLine_accountingEventId_lineNumber_key" ON "AccountingEventLine"("accountingEventId", "lineNumber");

-- CreateIndex
CREATE INDEX "AccountingPostingRule_companyId_eventType_status_priority_idx" ON "AccountingPostingRule"("companyId", "eventType", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPostingRule_companyId_code_version_key" ON "AccountingPostingRule"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "AccountingPosting_journalEntryId_idx" ON "AccountingPosting"("journalEntryId");

-- CreateIndex
CREATE INDEX "AccountingPosting_ruleId_postedAt_idx" ON "AccountingPosting"("ruleId", "postedAt");

-- CreateIndex
CREATE INDEX "TaxCode_companyId_code_status_effectiveFrom_idx" ON "TaxCode"("companyId", "code", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TaxCode_companyId_scope_status_idx" ON "TaxCode"("companyId", "scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_companyId_code_version_key" ON "TaxCode"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "TaxTransaction_companyId_taxPeriod_direction_status_idx" ON "TaxTransaction"("companyId", "taxPeriod", "direction", "status");

-- CreateIndex
CREATE INDEX "TaxTransaction_sourceType_sourceId_idx" ON "TaxTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "TaxTransaction_taxCodeId_transactionDate_idx" ON "TaxTransaction"("taxCodeId", "transactionDate");

-- CreateIndex
CREATE INDEX "TaxDocument_companyId_taxPeriod_status_idx" ON "TaxDocument"("companyId", "taxPeriod", "status");

-- CreateIndex
CREATE INDEX "TaxDocument_sourceType_sourceId_idx" ON "TaxDocument"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDocument_companyId_number_key" ON "TaxDocument"("companyId", "number");

-- CreateIndex
CREATE INDEX "AccountingCloseControl_companyId_status_periodEnd_idx" ON "AccountingCloseControl"("companyId", "status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCloseControl_companyId_branchId_module_periodStar_key" ON "AccountingCloseControl"("companyId", "branchId", "module", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AssetCategory_companyId_assetType_isActive_idx" ON "AssetCategory"("companyId", "assetType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_companyId_code_key" ON "AssetCategory"("companyId", "code");

-- CreateIndex
CREATE INDEX "Asset_companyId_branchId_assetType_status_idx" ON "Asset"("companyId", "branchId", "assetType", "status");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_registrationNumber_idx" ON "Asset"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_companyId_code_key" ON "Asset"("companyId", "code");

-- CreateIndex
CREATE INDEX "AssetTransaction_assetId_transactionDate_idx" ON "AssetTransaction"("assetId", "transactionDate");

-- CreateIndex
CREATE INDEX "AssetTransaction_sourceType_sourceId_idx" ON "AssetTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_assignedAt_idx" ON "AssetAssignment"("assetId", "assignedAt");

-- CreateIndex
CREATE INDEX "AssetAssignment_employeeId_returnedAt_idx" ON "AssetAssignment"("employeeId", "returnedAt");

-- CreateIndex
CREATE INDEX "AssetDepreciationRun_companyId_periodEnd_status_idx" ON "AssetDepreciationRun"("companyId", "periodEnd", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationRun_companyId_number_key" ON "AssetDepreciationRun"("companyId", "number");

-- CreateIndex
CREATE INDEX "AssetDepreciationLine_assetId_createdAt_idx" ON "AssetDepreciationLine"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationLine_runId_assetId_key" ON "AssetDepreciationLine"("runId", "assetId");

-- CreateIndex
CREATE INDEX "AssetMaintenancePlan_companyId_nextDueDate_isActive_idx" ON "AssetMaintenancePlan"("companyId", "nextDueDate", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssetMaintenancePlan_assetId_code_key" ON "AssetMaintenancePlan"("assetId", "code");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_assetId_status_scheduledAt_idx" ON "MaintenanceWorkOrder"("assetId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_vehicleId_status_scheduledAt_idx" ON "MaintenanceWorkOrder"("vehicleId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_companyId_number_key" ON "MaintenanceWorkOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "Vehicle_branchId_status_idx" ON "Vehicle"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_code_key" ON "Vehicle"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_plateNumber_key" ON "Vehicle"("companyId", "plateNumber");

-- CreateIndex
CREATE INDEX "VehicleDriverAssignment_vehicleId_effectiveFrom_idx" ON "VehicleDriverAssignment"("vehicleId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "VehicleDriverAssignment_employeeId_effectiveTo_idx" ON "VehicleDriverAssignment"("employeeId", "effectiveTo");

-- CreateIndex
CREATE INDEX "DeliveryTrip_branchId_status_plannedDepartureAt_idx" ON "DeliveryTrip"("branchId", "status", "plannedDepartureAt");

-- CreateIndex
CREATE INDEX "DeliveryTrip_vehicleId_status_idx" ON "DeliveryTrip"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "DeliveryTrip_driverEmployeeId_status_idx" ON "DeliveryTrip"("driverEmployeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTrip_companyId_number_key" ON "DeliveryTrip"("companyId", "number");

-- CreateIndex
CREATE INDEX "DeliveryStop_shipmentId_idx" ON "DeliveryStop"("shipmentId");

-- CreateIndex
CREATE INDEX "DeliveryStop_orderId_idx" ON "DeliveryStop"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStop_tripId_sequence_key" ON "DeliveryStop"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "DeliveryManifestItem_tripId_productId_idx" ON "DeliveryManifestItem"("tripId", "productId");

-- CreateIndex
CREATE INDEX "DeliveryManifestItem_shipmentId_productId_idx" ON "DeliveryManifestItem"("shipmentId", "productId");

-- CreateIndex
CREATE INDEX "FuelTransaction_vehicleId_transactionDate_idx" ON "FuelTransaction"("vehicleId", "transactionDate");

-- CreateIndex
CREATE INDEX "FuelTransaction_supplierId_transactionDate_idx" ON "FuelTransaction"("supplierId", "transactionDate");

-- CreateIndex
CREATE INDEX "FuelTransaction_tripId_idx" ON "FuelTransaction"("tripId");

-- CreateIndex
CREATE INDEX "VehicleMeterReading_vehicleId_recordedAt_idx" ON "VehicleMeterReading"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "InspectionTemplate_companyId_type_status_idx" ON "InspectionTemplate"("companyId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_companyId_code_version_key" ON "InspectionTemplate"("companyId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplateItem_templateId_code_key" ON "InspectionTemplateItem"("templateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplateItem_templateId_sequence_key" ON "InspectionTemplateItem"("templateId", "sequence");

-- CreateIndex
CREATE INDEX "OperationalInspection_sourceType_sourceId_idx" ON "OperationalInspection"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "OperationalInspection_companyId_type_status_createdAt_idx" ON "OperationalInspection"("companyId", "type", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalInspection_companyId_number_key" ON "OperationalInspection"("companyId", "number");

-- CreateIndex
CREATE INDEX "InspectionResultItem_inspectionId_productId_idx" ON "InspectionResultItem"("inspectionId", "productId");

-- CreateIndex
CREATE INDEX "InspectionResultItem_result_inspectedAt_idx" ON "InspectionResultItem"("result", "inspectedAt");

-- CreateIndex
CREATE INDEX "InspectionEvidence_inspectionId_evidenceType_idx" ON "InspectionEvidence"("inspectionId", "evidenceType");

-- CreateIndex
CREATE INDEX "OperationalConfirmation_sourceType_sourceId_confirmationTyp_idx" ON "OperationalConfirmation"("sourceType", "sourceId", "confirmationType");

-- CreateIndex
CREATE INDEX "OperationalConfirmation_companyId_status_requestedAt_idx" ON "OperationalConfirmation"("companyId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "GatePass_branchId_direction_status_createdAt_idx" ON "GatePass"("branchId", "direction", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GatePass_sourceType_sourceId_idx" ON "GatePass"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_companyId_number_key" ON "GatePass"("companyId", "number");

-- CreateIndex
CREATE INDEX "OperationPolicy_companyId_operationType_enabled_idx" ON "OperationPolicy"("companyId", "operationType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "OperationPolicy_companyId_branchId_code_key" ON "OperationPolicy"("companyId", "branchId", "code");

-- CreateIndex
CREATE INDEX "AutomationJob_status_scheduledAt_priority_idx" ON "AutomationJob"("status", "scheduledAt", "priority");

-- CreateIndex
CREATE INDEX "AutomationJob_sourceType_sourceId_idx" ON "AutomationJob"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationJob_companyId_idempotencyKey_key" ON "AutomationJob"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OperationalFinanceTransaction_companyId_branchId_transactio_idx" ON "OperationalFinanceTransaction"("companyId", "branchId", "transactionDate");

-- CreateIndex
CREATE INDEX "OperationalFinanceTransaction_companyId_type_status_transac_idx" ON "OperationalFinanceTransaction"("companyId", "type", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "OperationalFinanceTransaction_counterpartyType_counterparty_idx" ON "OperationalFinanceTransaction"("counterpartyType", "counterpartyId", "transactionDate");

-- CreateIndex
CREATE INDEX "OperationalFinanceTransaction_referenceType_referenceId_idx" ON "OperationalFinanceTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalFinanceTransaction_companyId_number_key" ON "OperationalFinanceTransaction"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalFinanceTransaction_companyId_idempotencyKey_key" ON "OperationalFinanceTransaction"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PromoRule_companyId_branchId_isActive_idx" ON "PromoRule"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRule_companyId_code_key" ON "PromoRule"("companyId", "code");

-- CreateIndex
CREATE INDEX "PromoRedemption_promoRuleId_customerId_createdAt_idx" ON "PromoRedemption"("promoRuleId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PromoRedemption_companyId_branchId_createdAt_idx" ON "PromoRedemption"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_promoRuleId_referenceType_referenceId_key" ON "PromoRedemption"("promoRuleId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ProductPriceHistory_companyId_productId_changedAt_idx" ON "ProductPriceHistory"("companyId", "productId", "changedAt");

-- CreateIndex
CREATE INDEX "MasterReference_companyId_type_isActive_name_idx" ON "MasterReference"("companyId", "type", "isActive", "name");

-- CreateIndex
CREATE INDEX "MasterReference_branchId_type_isActive_idx" ON "MasterReference"("branchId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MasterReference_companyId_type_code_key" ON "MasterReference"("companyId", "type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_name_idx" ON "ProductVariant"("productId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_code_key" ON "ProductVariant"("productId", "code");

-- CreateIndex
CREATE INDEX "ProductUnit_productId_variantId_isActive_unitCode_idx" ON "ProductUnit"("productId", "variantId", "isActive", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_productId_scopeKey_unitCode_key" ON "ProductUnit"("productId", "scopeKey", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBarcode_code_key" ON "ProductBarcode"("code");

-- CreateIndex
CREATE INDEX "ProductBarcode_productId_variantId_isPrimary_idx" ON "ProductBarcode"("productId", "variantId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProductBarcode_productUnitId_idx" ON "ProductBarcode"("productUnitId");

-- CreateIndex
CREATE INDEX "ProductPrice_productId_variantId_branchId_segmentCode_isAct_idx" ON "ProductPrice"("productId", "variantId", "branchId", "segmentCode", "isActive", "minQty");

-- CreateIndex
CREATE INDEX "ProductPrice_productUnitId_idx" ON "ProductPrice"("productUnitId");

-- CreateIndex
CREATE INDEX "ProductPrice_branchId_segmentCode_effectiveFrom_effectiveTo_idx" ON "ProductPrice"("branchId", "segmentCode", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SyncNode_companyId_role_isActive_idx" ON "SyncNode"("companyId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SyncNode_companyId_code_key" ON "SyncNode"("companyId", "code");

-- CreateIndex
CREATE INDEX "SyncPeer_companyId_isActive_idx" ON "SyncPeer"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPeer_nodeId_peerNodeId_key" ON "SyncPeer"("nodeId", "peerNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOutbox_eventId_key" ON "SyncOutbox"("eventId");

-- CreateIndex
CREATE INDEX "SyncOutbox_nodeId_status_createdAt_idx" ON "SyncOutbox"("nodeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncOutbox_companyId_aggregateType_aggregateId_idx" ON "SyncOutbox"("companyId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "SyncCursor_companyId_nodeId_idx" ON "SyncCursor"("companyId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_nodeId_peerNodeId_key" ON "SyncCursor"("nodeId", "peerNodeId");

-- CreateIndex
CREATE INDEX "SyncInbox_companyId_outcome_receivedAt_idx" ON "SyncInbox"("companyId", "outcome", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncInbox_nodeId_eventId_key" ON "SyncInbox"("nodeId", "eventId");

-- CreateIndex
CREATE INDEX "SyncPeerNonce_peerId_createdAt_idx" ON "SyncPeerNonce"("peerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPeerNonce_peerId_nonce_key" ON "SyncPeerNonce"("peerId", "nonce");

-- CreateIndex
CREATE INDEX "SyncConflict_companyId_strategy_createdAt_idx" ON "SyncConflict"("companyId", "strategy", "createdAt");

-- CreateIndex
CREATE INDEX "SyncConflict_aggregateType_aggregateId_strategy_idx" ON "SyncConflict"("aggregateType", "aggregateId", "strategy");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_nodeId_eventId_key" ON "SyncConflict"("nodeId", "eventId");

-- CreateIndex
CREATE INDEX "SyncAggregateVersion_companyId_aggregateType_aggregateId_idx" ON "SyncAggregateVersion"("companyId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAggregateVersion_nodeId_aggregateType_aggregateId_key" ON "SyncAggregateVersion"("nodeId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OfflineCapability_companyId_isActive_offlineCapable_idx" ON "OfflineCapability"("companyId", "isActive", "offlineCapable");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineCapability_companyId_flowCode_key" ON "OfflineCapability"("companyId", "flowCode");

-- CreateIndex
CREATE INDEX "NodeCapabilityPolicy_companyId_nodeId_idx" ON "NodeCapabilityPolicy"("companyId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeCapabilityPolicy_nodeId_flowCode_key" ON "NodeCapabilityPolicy"("nodeId", "flowCode");

-- CreateIndex
CREATE INDEX "SyncReadWatermark_companyId_nodeId_idx" ON "SyncReadWatermark"("companyId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncReadWatermark_nodeId_resource_key" ON "SyncReadWatermark"("nodeId", "resource");

-- CreateIndex
CREATE INDEX "BranchConnectivity_companyId_state_lastSeenAt_idx" ON "BranchConnectivity"("companyId", "state", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BranchConnectivity_companyId_branchId_key" ON "BranchConnectivity"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "BranchTransferSync_companyId_state_updatedAt_idx" ON "BranchTransferSync"("companyId", "state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BranchTransferSync_transferId_key" ON "BranchTransferSync"("transferId");

-- CreateIndex
CREATE INDEX "TelegramIdentityBinding_companyId_isActive_idx" ON "TelegramIdentityBinding"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "TelegramIdentityBinding_employeeId_isActive_idx" ON "TelegramIdentityBinding"("employeeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramIdentityBinding_platformUserId_key" ON "TelegramIdentityBinding"("platformUserId");

-- CreateIndex
CREATE INDEX "MobileOpnameDraft_companyId_employeeId_status_idx" ON "MobileOpnameDraft"("companyId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "MobileOpnameDraft_opnameId_idx" ON "MobileOpnameDraft"("opnameId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileOpnameDraft_deviceId_warehouseId_locationId_status_key" ON "MobileOpnameDraft"("deviceId", "warehouseId", "locationId", "status");

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecipe" ADD CONSTRAINT "ProductionRecipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecipe" ADD CONSTRAINT "ProductionRecipe_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecipeItem" ADD CONSTRAINT "ProductionRecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductionRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecipeItem" ADD CONSTRAINT "ProductionRecipeItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductionRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderComponent" ADD CONSTRAINT "ProductionOrderComponent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderComponent" ADD CONSTRAINT "ProductionOrderComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVerificationToken" ADD CONSTRAINT "CustomerVerificationToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierCashMovement" ADD CONSTRAINT "CashierCashMovement_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMemo" ADD CONSTRAINT "StaffMemo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMemo" ADD CONSTRAINT "StaffMemo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMemo" ADD CONSTRAINT "StaffMemo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceProduct" ADD CONSTRAINT "DigitalServiceProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceProduct" ADD CONSTRAINT "DigitalServiceProduct_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceTransaction" ADD CONSTRAINT "DigitalServiceTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceTransaction" ADD CONSTRAINT "DigitalServiceTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceTransaction" ADD CONSTRAINT "DigitalServiceTransaction_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalServiceTransaction" ADD CONSTRAINT "DigitalServiceTransaction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameItem" ADD CONSTRAINT "StockOpnameItem_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "StockOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_orderReturnId_fkey" FOREIGN KEY ("orderReturnId") REFERENCES "OrderReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderSuggestion" ADD CONSTRAINT "ReorderSuggestion_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEventLine" ADD CONSTRAINT "AccountingEventLine_accountingEventId_fkey" FOREIGN KEY ("accountingEventId") REFERENCES "AccountingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPosting" ADD CONSTRAINT "AccountingPosting_accountingEventId_fkey" FOREIGN KEY ("accountingEventId") REFERENCES "AccountingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_accountingEventId_fkey" FOREIGN KEY ("accountingEventId") REFERENCES "AccountingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResultItem" ADD CONSTRAINT "InspectionResultItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "OperationalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionEvidence" ADD CONSTRAINT "InspectionEvidence_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "OperationalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterReference" ADD CONSTRAINT "MasterReference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterReference" ADD CONSTRAINT "MasterReference_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Post-migration: 001-trigram-product-search.sql
-- Pencarian nama produk pada skala besar memakai trigram PostgreSQL.
-- Lihat docs/LARGE-SCALE-DATA.md §5: barcode/SKU exact -> SKU prefix -> nama trigram.
-- File ini hanya untuk PostgreSQL; SQLite development tetap memakai LIKE.
-- Baseline/release baru: jalankan apa adanya (index dibuat saat tabel kosong).
-- Deployment yang tabelnya sudah besar: jalankan CREATE INDEX ... CONCURRENTLY
-- di luar transaksi, lalu catat di runbook migration.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductVariant_name_trgm_idx"
  ON "ProductVariant" USING gin ("name" gin_trgm_ops);
