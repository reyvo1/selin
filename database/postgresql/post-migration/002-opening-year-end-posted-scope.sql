-- Satu fiscal year per company/branch hanya boleh memiliki satu YearEndCloseRun POSTED.
-- Prisma tidak dapat mengekspresikan partial unique index, sehingga index ini
-- ditambahkan ke baseline melalui post-migration SQL.
-- File ini hanya untuk PostgreSQL; SQLite memakai versi di migration expand.

CREATE UNIQUE INDEX IF NOT EXISTS "YearEndCloseRun_posted_scope_key"
  ON "YearEndCloseRun" ("companyId", "branchId", "fiscalYear")
  WHERE "status" = 'POSTED';
