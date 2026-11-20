#!/bin/sh
# Signs in as root and runs app-user.js, which creates or updates the
# backend's account with the password docker/db-secrets/init.sh made.
set -eu
ROOT_USER="${MONGO_ROOT_USERNAME:-torr}"
ROOT_PASSWORD="$(cat /secrets/root-password)"

if ! mongosh --quiet --host db -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin --eval "1" > /dev/null 2>&1; then
  # A database volume made before generated passwords still has the old
  # published root password. Keep working with it, and say how to move off it.
  ROOT_PASSWORD=torr
  echo "WARNING: this database volume's root password is still the old default." >&2
  echo "  Change it with docs/operations/key-management.md (Database passwords)." >&2
fi

MONGO_APP_PASSWORD="$(cat /secrets/app-password)" \
  mongosh --quiet --host db -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin /scripts/app-user.js
