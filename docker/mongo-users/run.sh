#!/bin/sh
# Signs in as root, over TLS with the database's own certificate, and runs
# app-user.js, which creates or updates the backend's certificate account.
set -eu
ROOT_USER="${MONGO_ROOT_USERNAME:-torr}"
ROOT_PASSWORD="$(cat /secrets/root-password)"
TLS="--tls --tlsCAFile /certs/ca.crt --tlsCertificateKeyFile /certs/db.pem"

# shellcheck disable=SC2086
if ! mongosh --quiet --host db $TLS -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin --eval "1" > /dev/null 2>&1; then
  # A database volume made before generated passwords still has the old
  # published root password. Keep working with it, and say how to move off it.
  ROOT_PASSWORD=torr
  echo "WARNING: this database volume's root password is still the old default." >&2
  echo "  Change it with docs/operations/key-management.md (Database passwords)." >&2
fi

# shellcheck disable=SC2086
mongosh --quiet --host db $TLS -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin /scripts/app-user.js
