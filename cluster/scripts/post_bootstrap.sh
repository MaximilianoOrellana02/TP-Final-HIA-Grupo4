#!/bin/bash
# Se ejecuta una unica vez como post_bootstrap de Patroni, en el nodo que
# gana la eleccion inicial. Debe ser idempotente por si se invoca a mano.
set -euo pipefail

export PATH="${PATRONI_POSTGRESQL_BIN_DIR:-/usr/lib/postgresql/17/bin}:$PATH"

DB_NAME="${SODERIA_DB_NAME:-soderia}"
DB_USER="${SODERIA_DB_USER:-soderia}"
DB_PASSWORD="${SODERIA_DB_PASSWORD:-soderia_local}"
SUPERUSER="${PATRONI_SUPERUSER_USERNAME:-postgres}"

echo "[post_bootstrap] Creando rol '${DB_USER}' y base '${DB_NAME}'..."

# CREATE ROLE no admite IF NOT EXISTS. Se genera la sentencia solo si falta el rol.
psql -v ON_ERROR_STOP=1 \
     -v db_user="$DB_USER" \
     -v db_password="$DB_PASSWORD" \
     -h 127.0.0.1 -U "$SUPERUSER" -d postgres <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password')
\gexec
SQL

if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" \
        -h 127.0.0.1 -U "$SUPERUSER" -d postgres | grep -q 1; then
    createdb -h 127.0.0.1 -U "$SUPERUSER" -O "$DB_USER" "$DB_NAME"
    echo "[post_bootstrap] Base '${DB_NAME}' creada."
else
    echo "[post_bootstrap] La base '${DB_NAME}' ya existe."
fi

# pg_trgm: indices GIN para busquedas ILIKE/%similarity%.
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$SUPERUSER" -d "$DB_NAME" <<SQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
GRANT ALL ON SCHEMA public TO "$DB_USER";
ALTER SCHEMA public OWNER TO "$DB_USER";
SQL

echo "[post_bootstrap] Listo: base '${DB_NAME}', usuario '${DB_USER}', extension pg_trgm."
