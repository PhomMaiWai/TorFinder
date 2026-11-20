#!/bin/sh
# Certificates for TLS between TorFinder's own services (ASVS 12.3.5): a
# private CA, and one certificate per service, each written only to that
# service's volume and readable only by the user that service runs as.
#
#   frontend  client cert (CN=frontend)          frontend → backend
#   backend   server cert (CN=backend)           backend's HTTPS API
#             client cert (CN=torr_app)          backend → MongoDB, MONGODB-X509 login
#   db        server + client cert (CN=db)       MongoDB's TLS; health check and db-users
#   dev       client cert (CN=local-dev)         `npm run dev` from the shell (export only)
#
# Run by the `certs` service in docker-compose.yml on every `up`; idempotent.
# A certificate is made again only when it is missing, within 30 days of
# expiry, or not signed by the current CA. The CA's key never leaves the
# certs_ca volume. Uses the openssl that ships in the mongo image.
#
#   docker compose run --rm certs export   # copy the dev client cert to docker/certs/dev/
set -eu

CA_DIR=/certs/ca
CA_DAYS=1825      # 5 years
LEAF_DAYS=397     # what browsers accept for public certs; the same rule here
RENEW_SECONDS=2592000  # 30 days
NODE_UID=1000     # the `node` user in node:22-alpine
MONGO_UID=999     # the `mongodb` user in mongo:7

mkdir -p "$CA_DIR" /certs/frontend /certs/backend /certs/db /certs/dev
umask 077

if [ "${1:-}" = "export" ]; then
  mkdir -p /export
  cp /certs/dev/local-dev.pem /certs/dev/ca.crt /export/
  chmod 644 /export/ca.crt
  chmod 600 /export/local-dev.pem
  echo "copied local-dev.pem and ca.crt to docker/certs/dev/"
  exit 0
fi

new_ca=no
if [ ! -f "$CA_DIR/ca.key" ] || ! openssl x509 -checkend "$RENEW_SECONDS" -noout -in "$CA_DIR/ca.crt" >/dev/null 2>&1; then
  openssl ecparam -name prime256v1 -genkey -noout -out "$CA_DIR/ca.key"
  openssl req -x509 -new -key "$CA_DIR/ca.key" -sha256 -days "$CA_DAYS" \
    -subj "/O=TorFinder/OU=internal/CN=TorFinder internal CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out "$CA_DIR/ca.crt"
  new_ca=yes
  echo "made a new internal CA"
fi

# leaf <dir> <name> <subject> <extendedKeyUsage> <subjectAltName or ""> <owner uid> <combined pem: yes/no>
leaf() {
  dir=$1 name=$2 subject=$3 eku=$4 san=$5 owner=$6 combined=$7
  crt="$dir/$name.crt" key="$dir/$name.key"
  if [ "$new_ca" = no ] && [ -f "$crt" ] && [ -f "$key" ] \
    && openssl x509 -checkend "$RENEW_SECONDS" -noout -in "$crt" >/dev/null 2>&1 \
    && openssl verify -CAfile "$CA_DIR/ca.crt" "$crt" >/dev/null 2>&1; then
    return
  fi
  openssl ecparam -name prime256v1 -genkey -noout -out "$key"
  ext=$(mktemp)
  {
    echo "basicConstraints=critical,CA:FALSE"
    echo "keyUsage=critical,digitalSignature"
    echo "extendedKeyUsage=$eku"
    [ -n "$san" ] && echo "subjectAltName=$san"
  } > "$ext"
  openssl req -new -key "$key" -subj "$subject" -out "$dir/$name.csr"
  openssl x509 -req -in "$dir/$name.csr" -CA "$CA_DIR/ca.crt" -CAkey "$CA_DIR/ca.key" -CAcreateserial \
    -sha256 -days "$LEAF_DAYS" -extfile "$ext" -out "$crt"
  rm -f "$dir/$name.csr" "$ext"
  if [ "$combined" = yes ]; then
    cat "$crt" "$key" > "$dir/$name.pem"
    chmod 400 "$dir/$name.pem"
    chown "$owner" "$dir/$name.pem"
  fi
  chmod 444 "$crt"
  chmod 400 "$key"
  chown "$owner" "$crt" "$key"
  echo "made $name"
}

leaf /certs/frontend frontend "/O=TorFinder/OU=frontend/CN=frontend" clientAuth "" "$NODE_UID" no
leaf /certs/backend server "/O=TorFinder/OU=backend/CN=backend" serverAuth "DNS:backend,DNS:localhost,IP:127.0.0.1" "$NODE_UID" no
leaf /certs/backend mongo-client "/O=TorFinder/OU=backend/CN=torr_app" clientAuth "" "$NODE_UID" yes
leaf /certs/db db "/O=TorFinder/OU=database/CN=db" "serverAuth,clientAuth" "DNS:db,DNS:localhost,IP:127.0.0.1" "$MONGO_UID" yes
leaf /certs/dev local-dev "/O=TorFinder/OU=developer/CN=local-dev" clientAuth "" 0 yes

# The secrets vault's server certificate, only when docker-compose.hardening.yml
# mounts its volume (ASVS 13.3.1). The vault image runs as uid 100.
dirs="/certs/frontend /certs/backend /certs/db /certs/dev"
if [ -d /certs/vault-volume ]; then
  leaf /certs/vault-volume vault "/O=TorFinder/OU=vault/CN=vault" serverAuth "DNS:vault" 100 no
  dirs="$dirs /certs/vault-volume"
fi

# Every service trusts only this CA.
for dir in $dirs; do
  cp "$CA_DIR/ca.crt" "$dir/ca.crt"
  chmod 444 "$dir/ca.crt"
done
echo "internal certificates ready"
