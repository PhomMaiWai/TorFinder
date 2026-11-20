#!/bin/sh
# Makes the database passwords on the first `docker compose up` (ASVS 13.2.3):
# no account ships with a default password. Each is 32 random bytes, written
# once into the private `torr_db_secrets` volume, and kept from then on.
# A value set in .env (MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD) wins instead.
#
#   root-password  the MongoDB root account (db reads it when its volume is new)
#   app-password   the backend's own account (db-users sets it, the backend reads it)
#
# Read one with: docker compose run --rm db-secrets cat /secrets/root-password
set -eu
umask 077

random() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# write <file> <value from .env, or empty> <owner uid>
write() {
  file="/secrets/$1"
  if [ -n "$2" ]; then
    printf %s "$2" > "$file"
  elif [ ! -s "$file" ]; then
    random > "$file"
    echo "generated $1"
  fi
  chown "$3" "$file"
  chmod 0400 "$file"
}

# mongod runs as uid 999 in the mongo image; the backend as `node`, uid 1000.
write root-password "${MONGO_ROOT_PASSWORD:-}" 999
write app-password "${MONGO_APP_PASSWORD:-}" 1000
