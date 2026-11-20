#!/bin/sh
# Makes the MongoDB root password on the first `docker compose up` (ASVS
# 13.2.3), so the database never starts with a default one: 32 random bytes,
# written once into the private `torr_db_secrets` volume and kept from then
# on. MONGO_ROOT_PASSWORD in .env wins instead. The backend has no password
# at all: it signs in with its TLS certificate (MONGODB-X509, ASVS 12.3.5).
#
# Read it with: docker compose run --rm db-secrets cat /secrets/root-password
set -eu
umask 077

file=/secrets/root-password
if [ -n "${MONGO_ROOT_PASSWORD:-}" ]; then
  printf %s "$MONGO_ROOT_PASSWORD" > "$file"
elif [ ! -s "$file" ]; then
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$file"
  echo "generated root-password"
fi
# mongod reads it as the `mongodb` user, uid 999 in the mongo image.
chown 999 "$file"
chmod 0400 "$file"
