# Production hardening services

Four ASVS Level 2 requirements need services the application itself doesn't run: a virus scanner (5.4.3), an egress allowlist (13.2.5), a secrets vault (13.3.1) and a separate log store (16.4.2, 16.4.3). They live in `docker-compose.hardening.yml`, which is opt-in, like the HTTPS edge:

```bash
docker compose -f docker-compose.yml -f docker-compose.hardening.yml up -d --build
```

A plain `docker compose up` doesn't use it, so a laptop and the demo stay light. On a server, use all three files: `docker-compose.yml`, `docker-compose.edge.yml` and `docker-compose.hardening.yml`. The first start takes a few minutes while ClamAV downloads its signatures (about 300 MB).

Evidence 18 ([`evidence/screenshots/18-hardening-services.png`](../security/evidence/screenshots/18-hardening-services.png)) shows every check below. The `hardening` shot in `capture-screenshots.js` retakes it.

In the commands below, `H` stands for `docker compose -f docker-compose.yml -f docker-compose.hardening.yml`.

## Egress allowlist (ASVS 13.2.5)

- The backend sits on the `internal` network, which has no gateway, so it can't reach the internet by itself.
- Its only way out is the `egress` service, a Squid proxy (`docker/hardening/squid.conf`). It allows HTTPS to these hosts only:
  - the procurement portals: `egp2.bangkok.go.th`, `process5.gprocurement.go.th`, `procurement.mea.or.th`, `data.go.th`;
  - Resend, LINE and Slack, for notifications;
  - `googleapis.com`, for Google sign-in checks and Vertex AI.
- Node follows the proxy through `HTTPS_PROXY` with `NODE_USE_ENV_PROXY=1`.
- **A new outside service** must be added to `squid.conf`, or its calls fail with a refusal.

Check it:
- a portal answers through the proxy: `H exec backend node -e 'fetch("https://data.go.th/").then(r => console.log(r.status))'` gives 200;
- `example.com` is refused;
- `H exec egress tail /var/log/squid/access.log` shows each `TCP_DENIED/403` and `TCP_TUNNEL/200`.

## Virus scanning (ASVS 5.4.3)

`clamav` runs clamd; the backend scans with it through `scanForViruses` (`backend/src/common/virus-scan.ts`). What gets scanned:
- **Company uploads** (certificates and library files), before their type is even checked.
- **Every portal file** before it is served: TOR archive entries, e-GP bundles and invitations.

What happens:
- **A known signature:** the file is refused with 422, and the backend logs a `file.malware` security event.
- **The scanner can't answer:** the file is refused with 503, never served unscanned.
- **No scanner configured** (`CLAMAV_HOST` empty): nothing is scanned, and a production start logs `config.virus_scan_off`.

Check it: `docs/security/evidence/virus-probe.js` scans an ordinary PDF and the EICAR test file inside the backend. The command is in the `hardening` shot.

## Separate log store (ASVS 16.4.2, 16.4.3)

- **How logs get there:** Docker's `fluentd` logging driver sends every line the backend and frontend write to the `log-store` service (Fluent Bit, `docker/hardening/log-store.conf`).
- **Where they are kept:** the store appends them to files in its own `security_logs` volume.
- **What can reach them:**
  - no application container mounts that volume;
  - the store listens only on this machine;
  - its only interface takes new records, so nothing can change or delete a line through it.
- **`docker compose logs`** still works, because Docker keeps a local copy too.
- **On a real server,** run the store on another host and point `fluentd-address` at it, so a compromised application host can't reach the stored logs at all.

Check it: `docker run --rm -v torfinder_security_logs:/logs:ro alpine ls -l /logs` lists one file per container.

## Secrets vault (ASVS 13.3.1)

`vault` is HashiCorp Vault. It is reachable only on the internal network and only over TLS, with a certificate from the internal CA (`docker/certs/generate.sh` makes it when this file is in use). On every `up`, `vault-init` (`docker/hardening/vault-init.sh`):

1. Initialises the vault the first time. The unseal key and root token stay in the `vault_keys` volume, which only `vault-init` mounts.
2. Unseals it, and keeps one read policy per service: `backend` may read `secret/backend` only, `frontend` may read `secret/frontend` only.
3. Loads the secrets from `.env` the first time (`SESSION_SECRET`, the LINE and Resend keys). From then on the vault is where they live, and `.env` can drop them.
4. Writes each service's secrets to that service's own volume (`/run/app-secrets/app.env`, mode `0400`). It reads them with a five-minute token that carries only that service's policy, then revokes the token.

The apps' compose variables for these secrets are emptied in this file, so the vault is their only source.

**To change a secret:** `H exec vault-init` can't be used, because it is a one-shot service. Instead:
1. Run `H run --rm --entrypoint sh vault-init`.
2. Set `VAULT_ADDR=https://vault:8200` and `VAULT_CACERT=/certs/ca.crt`.
3. Use the root token from `/keys/init.txt` with `vault kv patch secret/backend KEY=value` (and `secret/frontend` for the session secret).
4. Restart the services with `H up -d`.

**On a real server:**
- Use Vault's auto-unseal with the cloud provider's key service, instead of an unseal key kept in a volume.
- Revoke the root token once the policies exist.

## Also in this setup

- **MongoDB as a replica set** (ASVS 2.3.3): `docker-compose.yml` always runs MongoDB as a one-member replica set, because transactions need one. This isn't part of the hardening file. `db-secrets` makes its member key, and `db-users` starts the set.
- **Company passkeys** (ASVS 6.3.3) are a setting, not a service: `COMPANY_PASSKEYS_REQUIRED`, on by default in production. See [passkeys.md](../security/passkeys.md).
