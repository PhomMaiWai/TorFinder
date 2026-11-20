# Cryptography inventory and migration plan

Every place TorFinder uses cryptography, what for, and what would replace it (ASVS 5.0 11.1.1–11.1.4). The [summary by purpose](./asvs-l2.md#cryptography) is in the Level 2 file; this file is the complete list, file by file.

## Discovery

The inventory below is checked against the code on every CI run, so it can't silently fall behind (ASVS 11.1.3). [`check-crypto-inventory.mjs`](../../.github/scripts/check-crypto-inventory.mjs) scans `backend/src` and `frontend/src` for:

- Node `crypto` hashes, HMACs, random sources, constant-time comparison and password KDFs: `createHash`, `createHmac`, `randomBytes`, `randomInt`, `randomUUID`, `timingSafeEqual`, `scrypt` and `pbkdf2` imports
- Web Crypto: `crypto.subtle.*`, `getRandomValues`
- Ciphers, signatures and key exchange, which TorFinder doesn't use today: `createCipheriv`, `createSign`, `generateKeyPair`, `publicEncrypt`, `hkdf`
- Libraries that do cryptography for us: `jose`, `@simplewebauthn/*`, `google-auth-library`, `bcrypt`, `argon2`

The job fails if a file uses something not listed in its row, a file isn't listed at all, or a listed file no longer uses cryptography. Run it locally with `node .github/scripts/check-crypto-inventory.mjs`.

**Not covered by the scan:** TLS, which the hosting proxy terminates (see [Migration plan](#migration-plan)); MongoDB's own authentication (SCRAM-SHA-256, set by the server); and cryptography inside dependencies, which is covered by their rows here and by `npm audit` in CI.

## Inventory

The **Uses** column is exactly what the check expects; keep it in the same form when adding a row.

| File | Uses | Purpose | Key or parameters |
| --- | --- | --- | --- |
| `backend/src/common/password.ts` | `randomBytes`, `scrypt`, `timingSafeEqual` | Password hashing and verification | 16-byte random salt per password; cost parameters stored with each hash (`passwordParams`), raised by rehash on sign-in |
| `backend/src/common/token.ts` | `HMAC-SHA256`, `timingSafeEqual` | Signs and verifies session tokens | `SESSION_SECRET` (≥ 32 random characters; production refuses weak values) |
| `frontend/src/lib/auth.ts` | `subtle.importKey`, `subtle.sign`, `timingSafeEqual` | The same session tokens, verified and re-signed in the frontend (Web Crypto, so it runs in the proxy) | `SESSION_SECRET`, shared with the backend |
| `backend/src/common/form-timing.guard.ts` | `HMAC-SHA256`, `timingSafeEqual` | Verifies sign-up and comment form timing tokens (ASVS 2.4.2) | `SESSION_SECRET`, with a `form-timing:` prefix so a form token is never a valid session signature |
| `frontend/src/lib/form-timing.ts` | `HMAC-SHA256` | Issues those form timing tokens | As above |
| `backend/src/auth/account-links.service.ts` | `SHA-256`, `randomBytes` | Email links (password reset, address check): a 32-byte random token; only its hash is stored | None; 1 h or 24 h lifetime, single use |
| `backend/src/auth/passkeys.service.ts` | `@simplewebauthn/server`, `SHA-256` | Staff passkeys: registration and sign-in assertions are verified by the library (ES256, RS256, EdDSA); challenges are stored as SHA-256 hashes | Each credential's public key; 32-byte single-use challenges, 5 minutes |
| `backend/src/auth/auth.controller.ts` | `@simplewebauthn/server` | Type imports only (the passkey response shapes) | None |
| `frontend/src/lib/passkeys-client.ts` | `@simplewebauthn/browser` | Asks the browser's authenticator to create or use a passkey | Private keys never leave the authenticator |
| `frontend/src/components/auth/sign-in-form.tsx` | `@simplewebauthn/browser` | The passkey step of a staff sign-in | As above |
| `frontend/src/components/auth/google-sign-in-button.tsx` | `@simplewebauthn/browser` | The passkey step after a staff Google sign-in | As above |
| `backend/src/auth/auth.service.ts` | `google-auth-library` | Verifies Google ID tokens (RS256) | Google's published keys, fetched and cached by the library |
| `backend/src/auth/google-claims.ts` | `timingSafeEqual` | Compares the Google token's nonce with this browser's | None |
| `frontend/src/lib/google-nonce.ts` | `getRandomValues` | The 32-byte nonce that binds a Google sign-in to this browser | None |
| `backend/src/auth/known-devices.ts` | `SHA-256` | Stores sign-in device ids only as hashes (ASVS 6.3.5) | None; the id is 32 random bytes |
| `frontend/src/lib/device-cookie.ts` | `getRandomValues` | Generates that 32-byte device id | None |
| `backend/src/notifications/line-link.ts` | `HMAC-SHA256`, `SHA-256`, `randomInt`, `timingSafeEqual` | Verifies LINE webhook signatures; generates one-time LINE link codes and stores only their hash | `LINE_CHANNEL_SECRET` |
| `frontend/src/proxy.ts` | `randomUUID` | The per-response CSP nonce | None; new on every page |
| `backend/src/common/all-exceptions.filter.ts` | `randomUUID` | An error id shown to the user and logged, to match a report to a log line. Not a secret | None |
| `backend/src/gproc/gproc.service.ts` | `randomUUID` | Id of an e-GP capture run. Not a secret | None |
| `backend/src/similar/similar.service.ts` | `SHA-1` | Change detection only: a hash of the text an embedding was made from, so an edited TOR is embedded again. Not a security use; a collision would only leave one embedding stale | None |

**Not used anywhere:** encryption (no data is encrypted by the application; disks and transport are the host's), digital signatures made by TorFinder, key exchange, and JWT libraries.

## Migration plan

(ASVS 11.1.4.) What would replace each algorithm, what triggers the change, and how to make it without breaking existing data.

| Algorithm | Used for | Replace with | When | How |
| --- | --- | --- | --- | --- |
| scrypt | Passwords | Argon2id, or scrypt at higher cost | When OWASP's recommendation changes, or Node ships Argon2 | Already supported: each hash stores its parameters, and a sign-in with outdated ones rehashes the password (`needsRehash`). A new algorithm only needs a new `alg` value in `passwordParams` |
| HMAC-SHA256 | Session tokens, form tokens, LINE webhooks | HMAC-SHA512 or SHA3 | Only if SHA-256 is weakened for HMAC, which isn't expected | Sessions and form tokens last at most 7 days and 24 h, so a new algorithm can be accepted alongside the old for one session lifetime, then the old dropped. LINE's algorithm is set by LINE |
| SHA-256 | Hashes of random tokens, codes and device ids | SHA-512 or SHA3-256 | As above | The inputs are 256-bit random values, so hashing only hides them from a database reader; old hashes can be dropped as their tokens expire (1 h, 24 h, 5 min), and device hashes re-learned at next sign-in |
| SHA-1 | Change detection of embedding text | SHA-256 | Any time; no security impact | Change `hashOf`; every TOR is embedded once more |
| ES256 / RS256 / EdDSA (WebAuthn) | Passkeys | ML-DSA (post-quantum) | When the WebAuthn standard and browsers support a post-quantum algorithm | `@simplewebauthn/server` takes the allowed algorithm list; staff add a new passkey and remove the old one |
| RS256 | Google ID tokens | Whatever Google moves to | Google's decision | `google-auth-library` follows Google's published keys; update the library |
| TLS (ECDHE key exchange) | All traffic | Hybrid post-quantum key exchange (X25519MLKEM768) | Enable as soon as the hosting proxy offers it; current Chrome, Firefox and Cloudflare already negotiate it | A proxy setting; nothing in the application changes |

**Post-quantum exposure.** A quantum computer breaks public-key algorithms (RSA, ECDSA, ECDH), not symmetric ones: HMAC-SHA256 and scrypt keep about 128 bits of strength, which is enough. TorFinder's only public-key cryptography is TLS, Google's RS256 and passkey signatures. TLS matters most, because recorded traffic could be decrypted later; it is fixed at the proxy with hybrid key exchange. RS256 and passkey signatures are checked live, so they only need replacing before such a computer exists, and the replacement comes from Google and the WebAuthn standard.

**Review.** This plan is reviewed with the yearly secret rotation (see [limits and retention](../operations/limits-and-retention.md)), and whenever the inventory check reports a new kind of cryptography.
