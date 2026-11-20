#!/bin/sh
# Signs in as root, over TLS with the database's own certificate, and runs
# app-user.js, which creates or updates the backend's certificate account.
set -eu
ROOT_USER="${MONGO_ROOT_USERNAME:-torr}"
ROOT_PASSWORD="$(cat /secrets/root-password)"
TLS="--tls --tlsCAFile /certs/ca.crt --tlsCertificateKeyFile /certs/db.pem"

# On a new volume the database first runs an import reachable only inside its
# own container, so wait until it answers here; only a refused password means
# the volume predates the generated one.
i=0
while :; do
  # shellcheck disable=SC2086
  if out=$(mongosh --quiet --host db $TLS -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin --eval "1" 2>&1); then
    break
  fi
  case "$out" in
    *"Authentication failed"*)
      # A database volume made before generated passwords still has the old
      # published root password. Keep working with it, and say how to move off it.
      ROOT_PASSWORD=torr
      echo "WARNING: this database volume's root password is still the old default." >&2
      echo "  Change it with docs/operations/key-management.md (Database passwords)." >&2
      break
      ;;
  esac
  i=$((i + 1))
  [ "$i" -ge 90 ] && { echo "database not reachable: $out" >&2; exit 1; }
  sleep 2
done

# The replica set (ASVS 2.3.3: transactions need one) is started once, then
# this waits until the member is primary and takes writes.
# shellcheck disable=SC2086
mongosh --quiet --host db $TLS -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin --eval '
  try { const status = rs.status(); } catch (error) {
    if (error.codeName !== "NotYetInitialized") throw error;
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "db:27017" }] });
    print("started replica set rs0");
  }
  for (let i = 0; i < 60 && !db.hello().isWritablePrimary; i++) sleep(500);
  if (!db.hello().isWritablePrimary) throw new Error("replica set rs0 has no primary");
  print("replica set rs0 is primary");
'

# shellcheck disable=SC2086
mongosh --quiet --host db $TLS -u "$ROOT_USER" -p "$ROOT_PASSWORD" --authenticationDatabase admin /scripts/app-user.js
