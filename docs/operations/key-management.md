# Key management policy

How TorFinder's cryptographic keys and service credentials are made, kept, used, rotated and destroyed (ASVS 5.0 11.1.1). The lifecycle follows the key states of NIST SP 800-57 Part 1: pre-activation, active, deactivated, compromised, destroyed. [crypto-inventory.md](../security/crypto-inventory.md) lists every place the code uses cryptography; this file covers the keys behind those uses.

## Roles

- **Operator**: whoever runs the server. Holds `.env` and the Docker volumes, and makes, rotates and destroys every key below.
- **Developers**: never hold production keys. Local machines use their own generated values; CI uses published test values that no server accepts.
- **Admins in the app**: hold no keys. They can end sessions (Manage Users, "Sign out" and "Sign out everyone"), which needs no key change.

## Keys and credentials

| Key | Purpose | Made by | Kept in | Cryptoperiod |
| --- | --- | --- | --- | --- |
| `SESSION_SECRET` | HMAC-SHA-256 key for session and form-timing tokens | Operator: `openssl rand -base64 32` (production refuses shorter or the published placeholder) | `.env` on the server, read by frontend and backend | 12 months |
| MongoDB root password | Database administration and restores only | `docker/db-secrets/init.sh`, 32 random bytes, on the first `up` | `torr_db_secrets` volume, readable only by the database's user | 12 months |
| Internal CA key | Signs the certificates the services use to authenticate each other (ASVS 12.3.5) | `docker/certs/generate.sh`, ECDSA P-256, on the first `up` | `certs_ca` volume, mounted only by the one-shot `certs` service | 5 years |
| Service certificate keys (frontend, backend, backend's database login, database) | Mutual TLS between frontend, backend and MongoDB; the backend's database login (MONGODB-X509), so it has no password | `docker/certs/generate.sh`, ECDSA P-256 | One volume per service, readable only by that service's user | 397 days, renewed by the next `up` within 30 days of expiry |
| `LINE_CHANNEL_SECRET` | HMAC-SHA-256 check on LINE webhooks | LINE console | `.env` | 12 months |
| `LINE_CHANNEL_ACCESS_TOKEN`, `RESEND_API_KEY` | API credentials for notifications | LINE console, Resend dashboard | `.env` | 12 months |
| Passkey key pairs | Staff sign-in and step-up; optional for companies | The user's device | Private key on the device only; the server keeps the public key | Until the user removes it, or an admin resets it |
| TLS certificate | HTTPS | Hosting proxy (for example Let's Encrypt) | The proxy, outside this repository | As the proxy renews it (90 days for Let's Encrypt) |

Google's sign-in keys and Vertex AI credentials belong to Google and follow the Google Cloud key policy.

## Lifecycle

1. **Generation (pre-activation).** Keys come only from a cryptographically secure source: `openssl rand`, `/dev/urandom`, or the issuing service. Never a word, a default, or a value copied from documentation. No account ships with a default password (ASVS 13.2.3).
2. **Storage.** In `.env` (mode `600`, owned by the operator) or a Docker volume no other container mounts. Never in Git, in an image, in a log line, or in a URL. `.env` is in `.gitignore`, and GitHub secret scanning runs on the repository.
3. **Distribution.** Containers get keys from the environment or a read-only volume mount. Keys are never sent over chat or email. When a teammate needs a production key, the operator gives them shell access to the server instead.
4. **Use (active).** Each key has one purpose, as in the table. `SESSION_SECRET` signs two token types, and their prefixes keep one from being accepted as the other.
5. **Rotation (deactivation).** At the end of each cryptoperiod, and at once on compromise. The steps for each key are in [limits-and-retention.md, Secrets and rotation](./limits-and-retention.md#secrets-and-rotation). A scheduled `SESSION_SECRET` rotation keeps the old value as `SESSION_SECRET_PREVIOUS` for a grace period, so nobody is signed out; after an exposure, only the new value is set and every session ends. A service certificate is renewed by the next `up` within 30 days of expiry; a new CA means `docker volume rm <project>_certs_ca`, and every certificate is then reissued ([deployment-checklist.md](./deployment-checklist.md), Internal TLS).
6. **Compromise.**
   1. Rotate the key at once.
   2. For `SESSION_SECRET`, rotation already ends every session. For any other key, also use "Sign out everyone" in Manage Users when sessions may have been taken.
   3. Read the security log for the exposure window ([logging-and-errors.md](../security/logging-and-errors.md)).
   4. Record what happened in the team's operations notes.
7. **Destruction.** An old value is deleted from `.env` and from any backup copy of `.env` once its replacement works. For a revoked API key, the issuing dashboard is used too. `docker compose down -v` destroys the generated root password and the internal certificates together with the data they protect.

The operator records each generation, rotation and compromise, with its date, in the team's operations notes. Every key's next rotation date can be found there.

## Database passwords

The backend has no database password: it signs in with its TLS certificate (MONGODB-X509). The only password is root's, used for administration and restores.

The first `docker compose up` runs `db-secrets`, which writes `root-password` into the `torr_db_secrets` volume. `db` reads it when its data volume is first created, and `db-users` signs in with it to create the backend's certificate account. A value set in `.env` (`MONGO_ROOT_PASSWORD`) is written instead of a random one.

To read it, for `mongosh` or for `npm run dev` against this database:

```bash
docker compose run --rm db-secrets cat /secrets/root-password
```

**Rotating the root password, or moving an older volume off the old published `torr` root password** (`db-users` prints a warning while a volume still has it):
1. On a rotation (not needed for an older volume), make a new password: delete the file, then run `db-secrets` again.

   ```bash
   docker compose run --rm --entrypoint rm db-secrets /secrets/root-password
   docker compose run --rm db-secrets
   ```

2. Sign in as root with the current password and change it to the one in the file:

   ```bash
   docker compose run --rm -e OLD='the current root password' --entrypoint sh db-users -c \
     'mongosh --quiet --host db --tls --tlsCAFile /certs/ca.crt --tlsCertificateKeyFile /certs/db.pem \
        -u torr -p "$OLD" --authenticationDatabase admin \
        --eval "db.getSiblingDB(\"admin\").changeUserPassword(\"torr\", \"$(cat /secrets/root-password)\")"'
   ```

   `OLD` is the current root password: `torr` on an older volume.
3. Anything else that signs in as root, such as a backup job or a local `backend/.env`, uses the new password from then on.
