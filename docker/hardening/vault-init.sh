#!/bin/sh
# Sets up the secrets vault and hands each service its own secrets (ASVS 13.3.1).
# Run by the one-shot `vault-init` service on every `up`; idempotent.
#
# 1. The first time, initialises the vault. Its unseal key and root token stay
#    in the vault_keys volume, which only this service mounts. (On a real
#    server, use auto-unseal with the cloud provider's key service instead.)
# 2. Unseals it, and keeps one read policy per service: the backend may read
#    secret/backend only, the frontend secret/frontend only.
# 3. The first time, loads the secrets from the environment (.env); from then
#    on the vault is where they live, and .env can drop them.
# 4. Writes each service's secrets to its own volume, read with a five-minute
#    token that carries only that service's policy.
set -eu
umask 077
export VAULT_ADDR=https://vault:8200 VAULT_CACERT=/certs/ca.crt

i=0
until vault status > /dev/null 2>&1 || [ $? -eq 2 ]; do
  i=$((i + 1)); [ "$i" -ge 60 ] && { echo "vault not reachable" >&2; exit 1; }
  sleep 1
done

if ! vault status | grep -q "Initialized *true"; then
  vault operator init -key-shares=1 -key-threshold=1 > /keys/init.txt
  echo "initialised the vault"
fi
UNSEAL_KEY=$(sed -n 's/^Unseal Key 1: //p' /keys/init.txt)
VAULT_TOKEN=$(sed -n 's/^Initial Root Token: //p' /keys/init.txt)
export VAULT_TOKEN
if vault status | grep -q "Sealed *true"; then
  vault operator unseal "$UNSEAL_KEY" > /dev/null
  echo "unsealed the vault"
fi

vault secrets list | grep -q '^secret/' || vault secrets enable -path=secret kv-v2 > /dev/null
printf 'path "secret/data/backend" { capabilities = ["read"] }\n' | vault policy write backend - > /dev/null
printf 'path "secret/data/frontend" { capabilities = ["read"] }\n' | vault policy write frontend - > /dev/null

BACKEND_KEYS="SESSION_SECRET SESSION_SECRET_PREVIOUS SESSION_SECRET_PREVIOUS_UNTIL RESEND_API_KEY LINE_CHANNEL_ACCESS_TOKEN LINE_CHANNEL_SECRET"
FRONTEND_KEYS="SESSION_SECRET SESSION_SECRET_PREVIOUS SESSION_SECRET_PREVIOUS_UNTIL"

# load <service> <keys>: the first time only, from this container's environment.
load() {
  vault kv get "secret/$1" > /dev/null 2>&1 && return
  stored=0
  for key in $2; do
    value=$(printenv "$key" || true)
    [ -z "$value" ] && continue
    # One key at a time, quoted: a value may hold any character.
    if [ "$stored" -eq 0 ]; then vault kv put "secret/$1" "$key=$value" > /dev/null; else vault kv patch "secret/$1" "$key=$value" > /dev/null; fi
    stored=$((stored + 1))
  done
  [ "$stored" -eq 0 ] && { echo "no secrets for $1 in the environment" >&2; exit 1; }
  echo "stored $stored of $1's secrets in the vault"
}

# render <service> <keys> <uid>: what the service reads at start, from the vault.
render() {
  token=$(vault token create -policy="$1" -ttl=5m -field=token)
  out="/out/$1/app.env"
  : > "$out"
  for key in $2; do
    value=$(VAULT_TOKEN="$token" vault kv get -field="$key" "secret/$1" 2> /dev/null || true)
    [ -n "$value" ] && printf "%s='%s'\n" "$key" "$(printf %s "$value" | sed "s/'/'\\\\''/g")" >> "$out"
  done
  VAULT_TOKEN="$token" vault token revoke -self > /dev/null
  chown "$3" "$out"
  chmod 0400 "$out"
  echo "gave $1 its secrets"
}

load backend "$BACKEND_KEYS"
load frontend "$FRONTEND_KEYS"
render backend "$BACKEND_KEYS" 1000
render frontend "$FRONTEND_KEYS" 1000
