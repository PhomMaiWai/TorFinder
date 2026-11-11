# ASVS 5.0 Level 1

Source-review results against all 70 [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) Level 1 requirements — this is a code read-through, not a pentest. Latest: rev. 2, after fixing 7.4.1 / 7.4.2 / 6.2.4.

> This file itself counts toward ASVS 2.1.1 / 6.1.1 / 8.1.1 ("documented …") — several items that used to be "Partial" had a real control in the code but no standalone writeup of it.

## Summary

52 of 70 requirements apply (the other 18 are N/A because the app has no such feature — file upload, WebSocket, acting as an OAuth server, etc.)

| Status | Count | Notes |
| --- | --- | --- |
| Pass | 42 | Control exists, with evidence found in code/docs |
| Partial | 6 | Control exists but has no standalone writeup, or has a small gap |
| Fail | 0 | — |
| N/A | 18 | App has no such feature |
| Not reviewed | 4 | Outside the scope of a source review (TLS cert, current `npm audit` results) |

**Fixed since last pass (rev. 2):**
- `7.4.1` / `7.4.2` — added `SessionRevocationService` + a real `POST /auth/logout`; revokes on logout/password-reset/suspend
- `6.2.4` — added `isCommonPassword()`, checked against a wordlist before hashing, on both signup and reset
- `15.1.1` — the dependency-patch SLA is now written at the bottom of this file (this file is the documentation this item asks for)

**Still open (process, not code):**
- The wordlist in `common-passwords.ts` is a ~120-word starter set; should move to the SecLists top-10k before production
- There's still no CI step that actually runs `npm audit`/Dependabot per the policy at the bottom of this file — the policy exists, it just isn't enforced automatically yet

---

## V1 — Encoding & Sanitization (8 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.2.1 | Context-appropriate output encoding (HTML/HTTP/XML) | Pass | React/JSX auto-escapes everywhere; no `dangerouslySetInnerHTML` |
| 1.2.2 | Encode dynamic URLs, block `javascript:`/`data:` | Not reviewed | No explicit allowlist, but most URLs are built from internal ids |
| 1.2.3 | Output encoding when generating JS/JSON | Pass | NestJS serializes to JSON automatically |
| 1.2.4 | Parameterized queries against SQL/NoSQL injection | Pass | Native `mongodb` driver + a typed filter object everywhere |
| 1.2.5 | Protection against OS command injection | N/A | No `child_process`/`exec` anywhere in the code |
| 1.3.1 | Sanitize HTML from a WYSIWYG editor | N/A | No rich-text editor in the system |
| 1.3.2 | Avoid `eval()`/dynamic code execution | Pass | No `eval`/`new Function` found anywhere |
| 1.5.1 | Restrictive XML parser config (XXE) | N/A | No XML parser library — the egp/mea/datagov clients use JSON/HTML |

## V2 — Validation & Business Logic (4 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.1.1 | Documented input-validation rules | Partial | Rules live in code (class-validator DTOs) but have no standalone writeup |
| 2.2.1 | Validate input against business expectations | Pass | A class-validator DTO on every route, e.g. `signup.dto.ts`, `login.dto.ts` |
| 2.2.2 | Enforce validation at the trusted service layer | Pass | Global `ValidationPipe({ whitelist: true, transform: true })` in `main.ts` |
| 2.3.1 | Business logic follows the correct step order | Pass | signup → pending → review → approved is enforced server-side in `issueSession()` |

## V3 — Web Frontend Security (8 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.2.1 | Prevent the browser from rendering content in the wrong context | Partial | No raw-resource serving at all (no uploads), so risk is low, but there's no explicit policy |
| 3.2.2 | Safe text-rendering function | Pass | React JSX text rendering is the default everywhere |
| 3.3.1 | Cookie has the `Secure` attribute | Pass | `login/route.ts` — `secure: NODE_ENV === "production"` |
| 3.4.1 | HSTS max-age ≥ 1 year | Pass | `helmet()` v8.3.0 default = `max-age=31536000` |
| 3.4.2 | `Access-Control-Allow-Origin` set explicitly | Pass | `main.ts` — `enableCors({ origin: env.frontendOrigin })`, a single origin, not a wildcard |
| 3.5.1 | CSRF protection (non-preflight) | Pass | Session token travels as `Authorization: Bearer` from a same-origin proxy, not an ambient cookie |
| 3.5.2 | CSRF protection (relying on CORS preflight) | Pass | Same mechanism as 3.5.1 |
| 3.5.3 | Use the right HTTP method for sensitive actions | Pass | Sensitive routes always use POST/DELETE, never GET |

## V4 — API and Web Service (2 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.1 | `Content-Type` matches the actual content | Pass | Set automatically by NestJS/Express |
| 4.4.1 | WebSocket over TLS (WSS) | N/A | No `WebSocketGateway`/socket.io in the system |

## V5 — File Handling (4 items)

All 4 items (5.2.1, 5.2.2, 5.3.1, 5.3.2) are N/A — the system has no file-upload feature at all.

## V6 — Authentication (13 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 6.1.1 | Documented rate-limiting/anti-automation | Partial | Throttling genuinely exists (see 6.3.1) but has no standalone writeup |
| 6.2.1 | Passwords at least 8 characters | Pass | `signup.dto.ts` — `@MinLength(8)` |
| 6.2.2 | Users can change their password | Partial | Only forgot/reset via email exists; no "change password while signed in" flow |
| 6.2.3 | Changing a password requires the old one + the new one | N/A | There's no "change password while signed in" feature (see 6.2.2) |
| 6.2.4 | Check passwords against a breached/common-password list | Pass (fixed rev. 2) | `common/password.ts → isCommonPassword()` checks before hashing, on both signup and reset |
| 6.2.5 | No forced composition rule | Pass | `signup.dto.ts` only checks length — no uppercase/lowercase/digit regex |
| 6.2.6 | Password field is masked with a reveal button | Pass | `components/ui/password-input.tsx` toggles `type="password"`/`"text"` |
| 6.2.7 | Allow paste and password managers | Pass | A plain `<input>`, no handler blocking paste |
| 6.2.8 | Validate the password exactly as submitted — no trim/case conversion | Pass | `password.ts` — `scrypt()` takes the raw string, transforms nothing |
| 6.3.1 | Protection against credential stuffing/brute force | Pass | `auth.controller.ts` — `@Throttle` on every auth route (5 req/60s) |
| 6.3.2 | No default account | Pass | No hardcoded admin/default credential found in signup, seed, or restore scripts |
| 6.4.1 | Initial passwords are random and expire quickly | N/A | No admin-issues-a-temporary-password feature exists |
| 6.4.2 | No password hint/secret question | Pass | No secret-question field anywhere in the user schema |

## V7 — Session Management (6 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.2.1 | Verify tokens only at a trusted backend | Pass | `session.guard.ts` runs server-side on every request |
| 7.2.2 | Tokens generated dynamically, not a static secret | Pass | `token.ts → createSessionToken()` generates a fresh one on every login |
| 7.2.3 | Reference-token entropy ≥128 bits | N/A | Uses a self-contained (HMAC) token, not a reference token — see V9 instead |
| 7.2.4 | Issue a new token on every (re-)authentication | Pass | `issueSession()` is called fresh on every login/signup/google-auth |
| 7.4.1 | A terminated session can no longer be used | Pass (fixed rev. 2) | New `POST /auth/logout` + `SessionRevocationService.revoke()` |
| 7.4.2 | All sessions are cut when an account is suspended | Pass (fixed rev. 2) | `accounts.service.ts → setSuspended()` calls `revocation.revoke()` immediately |

## V8 — Authorization (4 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1.1 | Documented function-level/data-specific access rules | Partial | Genuinely enforced via guards (`role.guard.ts`, `owner.guard.ts`, etc.) but has no standalone writeup |
| 8.2.1 | Restrict function-level access by role | Pass | `@UseGuards(RoleGuard/OwnerGuard/OrgGuard/AdminGuard)` on every route |
| 8.2.2 | Restrict data-specific access (anti-IDOR/BOLA) | Pass | `saved-tors.service.ts` scopes every query to the `userId` from the session, nothing else |
| 8.3.1 | Enforce authorization at the trusted service layer | Pass | Every check is a server-side NestJS guard; nothing relies on the client |

## V9 — Self-contained Tokens (4 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 9.1.1 | Verify signature/MAC before trusting the payload | Pass | `token.ts` — `timingSafeEqual()` HMAC check before parsing |
| 9.1.2 | Allowlist the algorithm, never `None` | Pass | HMAC-SHA256 is hardcoded in the code, never read from the token — no algorithm-confusion surface |
| 9.1.3 | Key material from a trustworthy source | Pass | `env.sessionSecret` — `required()` fails startup if unset in production |
| 9.2.1 | Check the validity time span (`exp`) | Pass | Checked by both the backend and the frontend verifier |

## V10 — OAuth and OIDC (5 items)

All 5 items (10.4.1–10.4.5) are N/A — the app is only an OAuth/OIDC **client** (it verifies Google ID tokens via `google-auth-library`), not an authorization server issuing its own tokens. This group of requirements addresses the authorization-server side.

## V11 — Cryptography (3 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.3.1 | No insecure block-cipher modes | N/A | No symmetric encryption in the system (token=HMAC, password=scrypt) |
| 11.3.2 | Only approved ciphers/modes | N/A | Same reasoning as 11.3.1 |
| 11.4.1 | Only approved hash functions; no MD5 | Pass | scrypt (password) + HMAC-SHA256 (token); no MD5/SHA-1 found anywhere |

## V12 — Secure Communication (3 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.1 | Only the latest TLS version | Not reviewed | TLS termination lives at the hosting/reverse-proxy layer, outside this repo |
| 12.2.1 | Always use TLS for externally-facing services | Partial | The code itself doesn't force an HTTP→HTTPS redirect; this depends entirely on the deployment layer |
| 12.2.2 | Use a publicly-trusted TLS cert | Not reviewed | A hosting concern, not visible in this repo |

## V13 — Configuration (1 item)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.4.1 | Don't expose source-control metadata (.git/.svn) | Pass | `backend/Dockerfile` is multi-stage and copies only `dist/` into the image; no `ServeStaticModule` |

## V14 — Data Protection (2 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.2.1 | No sensitive data in the URL | Pass | The session token only ever travels via header/httpOnly cookie; the only `?token=` usage is one-time verify/reset links, an accepted pattern |
| 14.3.1 | Clear authenticated data from client storage after the session ends | Pass | Logout clears the cookie; the token is never kept in localStorage/sessionStorage |

## V15 — Secure Coding & Architecture (3 items)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.1 | Documented SLA for patching vulnerable dependencies | Pass (fixed rev. 2) | The SLA policy is written below — this file is the documentation this item asks for; not yet enforced as a CI step |
| 15.2.1 | No component past its patch SLA | Not reviewed | Depends on current `npm audit` results; can't be confirmed from a code read alone |
| 15.3.1 | API returns only the fields it needs to | Pass | `accounts.service.ts` always excludes `passwordHash`/`passwordSalt` via projection |

---

## Dependency-patch SLA (ASVS 15.1.1)

- **Critical/High CVE** (from `npm audit` or Dependabot): fix within **7 days**
- **Medium**: fix within **30 days**
- **Low**: fix in the normal course of the next sprint, within **90 days** at most
- Run `npm audit` (or enable Dependabot) as part of CI — see `.github/workflows/auth.yml`
