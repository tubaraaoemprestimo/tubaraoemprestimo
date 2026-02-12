#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SUPABASE_DB_PASSWORD='...' bash deploy/migrate_supabase_data_to_vps.sh
#
# Optional env vars:
#   SUPABASE_PROJECT_REF (default: cwhiujeragsethxjekkb)
#   SUPABASE_DB_USER    (default: postgres.cwhiujeragsethxjekkb)
#   SUPABASE_DB_HOST    (default: aws-1-sa-east-1.pooler.supabase.com)
#   SUPABASE_DB_NAME    (default: postgres)
#   SUPABASE_DB_PORT    (default: 5432)
#   TARGET_DB_CONTAINER (default: tubarao_postgres)
#   TARGET_DB_NAME      (default: tubarao_db)
#   TARGET_DB_USER      (default: postgres)

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "ERROR: SUPABASE_DB_PASSWORD is required." >&2
  exit 1
fi

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-cwhiujeragsethxjekkb}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres.${SUPABASE_PROJECT_REF}}"
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-aws-1-sa-east-1.pooler.supabase.com}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"

TARGET_DB_CONTAINER="${TARGET_DB_CONTAINER:-tubarao_postgres}"
TARGET_DB_NAME="${TARGET_DB_NAME:-tubarao_db}"
TARGET_DB_USER="${TARGET_DB_USER:-postgres}"

SOURCE_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}?sslmode=require"
WORK_DIR="/tmp/supabase_migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"

cleanup() {
  rm -rf "$WORK_DIR"
}


echo "[1/7] Checking source connection..."
psql "$SOURCE_URL" -c "SELECT NOW();" >/dev/null

echo "[2/7] Collecting table list from source and target..."
psql "$SOURCE_URL" -At -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" > "$WORK_DIR/source_tables.txt"
docker exec "$TARGET_DB_CONTAINER" psql -U "$TARGET_DB_USER" -d "$TARGET_DB_NAME" -At -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" > "$WORK_DIR/target_tables.txt"

python3 - "$WORK_DIR" <<'PY2'
from pathlib import Path
import sys
wd = Path(sys.argv[1])
source = set(wd.joinpath('source_tables.txt').read_text().splitlines())
target = set(wd.joinpath('target_tables.txt').read_text().splitlines())
ignore = {'_prisma_migrations', 'risk_events'}
common = sorted((source & target) - ignore)
wd.joinpath('tables_to_migrate.txt').write_text('
'.join(common) + ('
' if common else ''))
print(f"Tables to migrate: {len(common)}")
PY2

if [[ ! -s "$WORK_DIR/tables_to_migrate.txt" ]]; then
  echo "No common tables to migrate. Exiting."
  exit 0
fi

echo "[3/7] Truncating target tables..."
python3 - "$WORK_DIR" <<'PY3' | docker exec -i "$TARGET_DB_CONTAINER" psql -U "$TARGET_DB_USER" -d "$TARGET_DB_NAME"
from pathlib import Path
import sys
wd = Path(sys.argv[1])
tables = [t.strip() for t in wd.joinpath('tables_to_migrate.txt').read_text().splitlines() if t.strip()]
print('BEGIN;')
for t in tables:
    print(f'TRUNCATE TABLE public."{t}" RESTART IDENTITY CASCADE;')
print('COMMIT;')
PY3

echo "[4/7] Dumping source data (per table)..."
while IFS= read -r tbl; do
  [[ -z "$tbl" ]] && continue
  echo "  - Dumping $tbl"
  pg_dump "$SOURCE_URL" --data-only --column-inserts --inserts --table="public.${tbl}" > "$WORK_DIR/${tbl}.sql"
done < "$WORK_DIR/tables_to_migrate.txt"

echo "[5/7] Importing into target..."
while IFS= read -r tbl; do
  [[ -z "$tbl" ]] && continue
  echo "  - Importing $tbl"
  docker exec -i "$TARGET_DB_CONTAINER" psql -U "$TARGET_DB_USER" -d "$TARGET_DB_NAME" -v ON_ERROR_STOP=1 < "$WORK_DIR/${tbl}.sql"
done < "$WORK_DIR/tables_to_migrate.txt"

export SOURCE_URL TARGET_DB_CONTAINER TARGET_DB_USER TARGET_DB_NAME

echo "[6/7] Running per-table count comparison..."
python3 - "$WORK_DIR" <<'PY4'
from pathlib import Path
import subprocess
import os
import sys
wd = Path(sys.argv[1])
source_url = os.environ['SOURCE_URL']
container = os.environ['TARGET_DB_CONTAINER']
user = os.environ['TARGET_DB_USER']
db = os.environ['TARGET_DB_NAME']
rows = []
for tbl in [t.strip() for t in wd.joinpath('tables_to_migrate.txt').read_text().splitlines() if t.strip()]:
    src = subprocess.check_output(['psql', source_url, '-At', '-c', f'SELECT COUNT(*) FROM public."{tbl}";'], text=True).strip()
    tgt = subprocess.check_output(['docker','exec',container,'psql','-U',user,'-d',db,'-At','-c',f'SELECT COUNT(*) FROM public."{tbl}";'], text=True).strip()
    status = 'OK' if src == tgt else 'DIFF'
    rows.append((tbl, src, tgt, status))
out = wd / 'count_report.tsv'
out.write_text('
'.join('	'.join(r) for r in rows) + ('
' if rows else ''))
print(f'Count report: {out}')
print('Mismatches:')
for tbl, src, tgt, status in rows:
    if status != 'OK':
        print(f'  {tbl}: source={src}, target={tgt}')
PY4

echo "[7/7] Migration complete."
echo "Count report path: $WORK_DIR/count_report.tsv"
