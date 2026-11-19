#!/bin/bash
set -e
# Asegurar que el directorio de datos existe y tiene los permisos correctos
mkdir -p /var/lib/postgresql/data
if [ "$(stat -c %u /var/lib/postgresql/data)" != "$(id -u postgres)" ]; then
    chown -R postgres:postgres /var/lib/postgresql/data
fi
chmod 700 /var/lib/postgresql/data

# Arrancar Patroni como el usuario postgres
exec su postgres -c "patroni /etc/patroni/patroni.yml"
