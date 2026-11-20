# Cryptographic inventory

Every place TorFinder uses cryptography, what it protects, and how it would move to newer algorithms (ASVS 5.0 11.1.3, 11.1.4). The algorithm choices themselves are reviewed in [asvs-l2.md, Cryptography](./asvs-l2.md#cryptography).

## How the inventory is kept

[`scripts/crypto-inventory.mjs`](../../scripts/crypto-inventory.mjs) scans `backend/src` and `frontend/src` for cryptographic APIs, ignoring comments:
- Node's `crypto`: hashes, HMACs, scrypt, random numbers and constant-time compare;
- the Web Crypto API;
- the libraries that verify signatures for us: Google ID tokens and WebAuthn.

Its output is recorded in [`crypto-inventory.json`](./crypto-inventory.json).

`backend/test/crypto-inventory.test.mjs` runs the scan in CI and fails when the code uses cryptography in a file, or through an API, that the recorded inventory doesn't list. A new use can't slip in unreviewed.

To update after a reviewed change: run `node scripts/crypto-inventory.mjs --json > docs/security/crypto-inventory.json` and add a row below.

## Inventory

| Use | Where | Algorithm | Key or secret | Protects |
| --- | --- | --- | --- | --- |
| Session tokens | `backend/src/common/token.ts`, `frontend/src/lib/auth.ts` (Web Crypto) | HMAC-SHA-256, constant-time compare | `SESSION_SECRET` (32+ chars) | Sessions can't be forged or altered |
| Form timing tokens | `backend/src/common/form-timing.guard.ts`, `frontend/src/lib/form-timing.ts` | HMAC-SHA-256, prefixed so it can't pass as a session | `SESSION_SECRET` | Forms submitted too fast are refused (2.4.2) |
| Password storage | `backend/src/common/password.ts` | scrypt N=2^14, r=8, p=5, 16-byte salt; settings stored with each hash | None (per-password salt) | Passwords at rest |
| Emailed links | `backend/src/auth/account-links.service.ts` | 32 random bytes; SHA-256 of the token stored | None | Reset and email-check links can't be rebuilt from a database read |
| Passkey challenges | `backend/src/auth/passkeys.service.ts` | 32 random bytes; SHA-256 stored | None | Single-use WebAuthn challenges |
| Passkeys (WebAuthn) | `backend/src/auth/passkeys.service.ts` (`@simplewebauthn/server`) | Authenticator's key pair: ES256 (P-256) or RS256, as the device chooses | Private key never leaves the device | Staff sign-in and step-up |
| Google sign-in | `backend/src/auth/auth.service.ts` (`google-auth-library`), `backend/src/auth/google-claims.ts` | RS256 ID token from Google; nonce compared in constant time | Google's keys | Who the Google user is, bound to this browser |
| Google nonce | `frontend/src/lib/google-nonce.ts` | 32 random bytes (Web Crypto) | None | Ties a Google token to one browser's sign-in |
| Session ids | `backend/src/auth/auth.service.ts` | 16 random bytes, base64url; a key in the `sessions` collection, never a secret on its own (the token's HMAC is) | None | Lets an account or an admin end one session (7.5.2, 7.4.5) |
| Device id | `frontend/src/lib/device-cookie.ts`, `backend/src/auth/known-devices.ts` | 32 random bytes; SHA-256 stored | None | Recognising a known device for new-device emails |
| LINE webhook | `backend/src/notifications/line-link.ts` | HMAC-SHA-256 over the raw body, constant-time compare | `LINE_CHANNEL_SECRET` | Webhook calls really come from LINE |
| LINE link codes | `backend/src/notifications/line-link.ts` | `randomInt` code; SHA-256 stored | None | One-time codes can't be read back from the database |
| CSP nonce | `frontend/src/lib/csp.ts` (called from `frontend/src/proxy.ts`) | `crypto.randomUUID` per request | None | Only this response's own scripts run |
| Error and run ids | `backend/src/common/all-exceptions.filter.ts`, `backend/src/gproc/gproc.service.ts` | `randomUUID` | None | Not security: correlation ids |
| Similar-TOR cache key | `backend/src/similar/similar.service.ts` | SHA-1 of public announcement text | None | Not security: a content key for a cache. SHA-1's collision weakness doesn't matter here, because nothing trusts the hash |
| HTTPS (public) | Caddy edge, `docker/caddy/Caddyfile` | TLS 1.2 (ECDHE with AES-GCM or ChaCha20 only) and 1.3 | The site's certificate, obtained and renewed by Caddy | Everything between the browser and the site |
| Internal mutual TLS | `docker/certs/generate.sh`, `backend/src/common/internal-tls.ts`, `frontend/src/lib/internal-tls.ts`, `db` in `docker-compose.yml` | TLS 1.3 only; private CA and one certificate per service, ECDSA P-256 / SHA-256 | CA key in the `certs_ca` volume, mounted only by the `certs` service; each service's key readable only by that service | Frontend → backend and backend → MongoDB: each side proves which service it is (12.3.5) |

There is no encryption at rest in the application and no custom cryptographic code. TorFinder's own keys are the internal CA's and each service's ECDSA P-256 TLS keys. Everything comes from Node, the browser, or a maintained library.

## Migration plan

(ASVS 11.1.4, including post-quantum cryptography)

**Where quantum computers matter.** A large quantum computer would break public-key signatures and key exchange (RSA, ECC). It would only weaken symmetric primitives and hashes, by about half their bit strength. For TorFinder:

| Primitive | Exposure | Plan |
| --- | --- | --- |
| HMAC-SHA-256 (sessions, form tokens, LINE) | Low: 256-bit keys keep about 128 bits of strength | No change needed. If ever required, move to HMAC-SHA-512 in `token.ts` and `form-timing`: rotating `SESSION_SECRET` already signs everyone out cleanly |
| SHA-256 (stored token hashes, device ids) | Low: preimage resistance stays about 128-bit | No change needed |
| scrypt (passwords) | Low: memory-hard, symmetric | Settings are stored per hash and old hashes are redone at sign-in (`needsRehash`), so moving to stronger settings or Argon2id is one change in `password.ts` plus `alg` handling |
| WebAuthn ES256 / RS256 (passkeys) | High in the long term (ECC/RSA) | Follow the WebAuthn standard: when authenticators and `@simplewebauthn` support post-quantum algorithms (e.g. ML-DSA), add them to the accepted list, let staff add a new passkey, then retire the old one with "Reset passkeys" |
| Google RS256 ID tokens | High in the long term | Owned by Google; the library verifies whatever Google signs with. Keep `google-auth-library` current |
| TLS key exchange | High ("harvest now, decrypt later") | Owned by the hosting proxy: enable hybrid post-quantum key exchange (X25519MLKEM768), which current Caddy, nginx/OpenSSL 3.5 and Cloudflare already support, when the course deployment moves to real hosting |

**Process.**
1. Review this inventory with each dependency update, and whenever NIST or OWASP guidance changes. The CI test makes sure it matches the code.
2. Keep algorithms behind one function each (`token.ts`, `password.ts`, `form-timing`, `line-link.ts`), so a change happens in one place.
3. For stored hashes, change through the stored settings (`passwordParams`), never by bulk rewrite. Session tokens are short-lived, so rotating the secret is enough.
4. Record each change here, with its date.
