# T360-20261107-transfer-file-payload

Adds payload/checksum/audit fields to TransferFile for offline branch transfer
import (F09/F10). Existing rows keep NULL payload and are not reprocessed.

**Intent.** F09/F10: branch transfer via file, with idempotent import tracking.

**Expand-only, no backfill.** New nullable columns; existing rows untouched.

**Backfill plan.** None.

**Index/query impact.** New composite index on (companyId, direction, status).

**Rollback.** Deploy previous application version; leave columns in place.

**Verification.** `npm run db:migrations:rehearse:sqlite` + Prisma field-parity test.
