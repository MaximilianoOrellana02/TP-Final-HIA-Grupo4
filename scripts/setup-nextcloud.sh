#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${NEXTCLOUD_CONTAINER:-$(docker compose --profile documentacion ps -q nextcloud 2>/dev/null || true)}"
if [ -z "$CONTAINER" ]; then
  echo "Error: el contenedor nextcloud no esta corriendo. Ejecuta: docker compose --profile documentacion up -d" >&2
  exit 1
fi

occ() {
  docker exec -u www-data "$CONTAINER" php occ "$@"
}

echo "Esperando a que Nextcloud complete la instalacion inicial..."
for _ in $(seq 1 30); do
  if occ status 2>/dev/null | grep -q "installed: true"; then
    break
  fi
  sleep 3
done

if ! occ status 2>/dev/null | grep -q "installed: true"; then
  echo "Error: Nextcloud no respondio como instalado a tiempo." >&2
  exit 1
fi

echo "Habilitando app groupfolders (Team Folders)..."
if ! occ app:list --enabled | grep -q "groupfolders:"; then
  if occ app:list --disabled | grep -q "groupfolders:"; then
    occ app:enable groupfolders
  else
    occ app:install groupfolders
  fi
fi

for grp in equipo auditores automatizacion; do
  if ! occ group:info "$grp" >/dev/null 2>&1; then
    occ group:add "$grp"
  fi
done

crear_usuario() {
  local user="$1" group="$2" display="$3" pass="$4"
  if ! occ user:info "$user" >/dev/null 2>&1; then
    docker exec -u www-data -e OC_PASS="$pass" "$CONTAINER" \
      php occ user:add --password-from-env --display-name="$display" --group="$group" "$user"
  else
    occ group:adduser "$group" "$user" >/dev/null 2>&1 || true
  fi
}

crear_usuario "equipo_dev" "equipo" "Equipo Desarrollo" "${NEXTCLOUD_EQUIPO_PASS:-EquipoSoderia2026!}"
crear_usuario "auditor" "auditores" "Auditor Catedra" "${NEXTCLOUD_AUDITOR_PASS:-AuditorSoderia2026!}"
crear_usuario "n8n_bot" "automatizacion" "Bot Automatizacion n8n" "${NEXTCLOUD_N8N_PASS:-N8nSoderia2026!}"

FOLDER_NAME="Soderia-TP-Final"
FOLDER_ID="$(occ groupfolders:list --output=json | php -r '
  $d = json_decode(stream_get_contents(STDIN), true) ?: [];
  foreach ($d as $id => $f) {
    if (($f["mount_point"] ?? "") === $argv[1]) { echo $id; exit; }
  }
' "$FOLDER_NAME")"

if [ -z "$FOLDER_ID" ]; then
  FOLDER_ID="$(occ groupfolders:create "$FOLDER_NAME" | tr -dc '0-9')"
fi

echo "Configurando permisos en carpeta compartida '$FOLDER_NAME' (ID: $FOLDER_ID)..."
occ groupfolders:group "$FOLDER_ID" equipo read write create delete share
occ groupfolders:group "$FOLDER_ID" automatizacion read write create
occ groupfolders:group "$FOLDER_ID" auditores read

BASE_DIR="/var/www/html/data/__groupfolders/$FOLDER_ID"
docker exec -u www-data "$CONTAINER" mkdir -p \
  "$BASE_DIR/01-Documentacion-Tecnica" \
  "$BASE_DIR/02-Informes-Pruebas" \
  "$BASE_DIR/03-Configuraciones-Infra" \
  "$BASE_DIR/04-Reportes-n8n" \
  "$BASE_DIR/05-Evidencias"

occ groupfolders:scan "$FOLDER_ID"
echo "Listo: estructura y permisos de Nextcloud configurados."
