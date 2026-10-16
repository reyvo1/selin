#!/usr/bin/env bash
# Run the one gate this workstation cannot run on its own.
#
# Every claim about PostgreSQL in this repository's evidence says "pending" because the local
# machine only ever had postgresql-client-18 installed. This script closes that gap the moment a
# server is available, and it refuses to report anything it did not actually observe.
#
# Usage:  bash scripts/run-local-postgres-gates.sh
#
# Requires:
#   1. A running PostgreSQL server. If `sudo service postgresql start` reports nothing, the server
#      package is missing: `sudo apt-get install -y postgresql-18`.
#   2. A SCRATCH database. This script creates and drops its own; never point it at anything you
#      care about. It refuses to run if the URL does not look like a scratch name.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCRATCH_DB="${T360_PG_SCRATCH_DB:-t360_local_gate}"

# Peer authentication over the unix socket maps the OS user to a role of the same name, which is the
# only way this works without a password and without sudo. The default was `postgres`, which forced
# either an interactive password prompt or `sudo -u postgres` — and the script's whole point is that
# an operator can run it unattended.
#
# T360_PG_ADMIN_URL still wins when set, so a CI job or a remote server can point this anywhere.
PG_USER_NAME="${T360_PG_USER:-$(id -un)}"
ADMIN_URL="${T360_PG_ADMIN_URL:-postgresql://${PG_USER_NAME}@localhost/postgres?host=/var/run/postgresql}"
SCRATCH_URL="${T360_PG_ADMIN_URL:-postgresql://${PG_USER_NAME}@localhost/${SCRATCH_DB}?host=/var/run/postgresql}"

say() { printf '\n=== %s ===\n' "$1"; }

# --- 0. refuse early rather than half-run -------------------------------------------------
case "$SCRATCH_DB" in
  *prod*|*live*|*tokofinal*) echo "REFUSING: scratch database name '$SCRATCH_DB' looks production-like." >&2; exit 2 ;;
esac

# Refuse early rather than half-run: the whole gate depends on being able to create a scratch
# database, and discovering that halfway through leaves a stray database behind.
if ! psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; then
  echo "REFUSING: cannot connect as '${PG_USER_NAME}' over the unix socket."
  echo "  Peer authentication maps the OS user to a role of the same name. Create it once:"
  echo "    sudo -u postgres psql -c \"CREATE ROLE ${PG_USER_NAME} LOGIN SUPERUSER;\""
  echo "  or point T360_PG_ADMIN_URL at a database this user can already reach."
  exit 2
fi

if ! pg_isready -q 2>/dev/null; then
  echo "REFUSING: no PostgreSQL server is answering."
  echo "  sudo apt-get install -y postgresql-18   # the client alone is not enough"
  echo "  sudo service postgresql start"
  exit 2
fi

say "server"
pg_isready || exit 2
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -tAc "SELECT current_user || ' via peer auth on the unix socket'" || exit 2

# --- 1. a clean scratch database ----------------------------------------------------------
say "scratch database ${SCRATCH_DB}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\";" >/dev/null \
  || { echo "could not drop the scratch database"; exit 1; }
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${SCRATCH_DB}\";" >/dev/null \
  || { echo "could not create the scratch database"; exit 1; }
echo "created"

# --- 2. the gate this evidence has been calling pending ------------------------------------
say "MIGRATION_REHEARSAL_POSTGRES"
T360_MIGRATION_DATABASE_URL="$SCRATCH_URL" npm run db:migrations:rehearse:postgres
REHEARSE=$?

say "POSTGRES_SCHEMA_PREPARE"
DATABASE_URL="$SCRATCH_URL" npm run db:postgres:prepare
PREPARE=$?

# --- 3. report only what was observed ------------------------------------------------------
say "RESULT"
if [ "$REHEARSE" -eq 0 ]; then
  echo "PASS  the product-imagery migration applies on PostgreSQL and lands at the current schema"
else
  echo "FAIL  MIGRATION_REHEARSAL_POSTGRES (exit ${REHEARSE})"
fi
if [ "$PREPARE" -eq 0 ]; then
  echo "PASS  schema.prisma.postgresql.prisma prepares against a real PostgreSQL"
else
  echo "FAIL  POSTGRES_SCHEMA_PREPARE (exit ${PREPARE})"
fi

say "cleanup"
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\";" >/dev/null 2>&1 && echo "scratch database dropped"

if [ "$REHEARSE" -ne 0 ] || [ "$PREPARE" -ne 0 ]; then
  echo
  echo "Do NOT mark the PostgreSQL migration evidence as verified. Paste the failure above."
  exit 1
fi

cat <<'EOF'

Both PostgreSQL gates observed PASS on this machine.

What that closes: the migration is verified on the production engine, and the PostgreSQL Prisma
schema prepares against a real server. The evidence files may now state the PostgreSQL rehearsal as
PASS instead of pending.

What it still does NOT close, because it is not what these gates measure:
  - GitHub Full System Simulation and toko360-full-uat have not run against this exact commit.
  - Human Stage-20 UAT by the process owner has not happened.
  - Backup/restore point and dashboard metrics/alerts are staging-infrastructure facts.

Only now may a work item advance past VERIFICATION with PostgreSQL stated as proven.
EOF
