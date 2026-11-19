# ASVS 5.0 Level 1

Source-review results against all 70 [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/master/5.0/docs_en) Level 1 requirements. This is a code read-through backed by local tests, not a pentest. TLS and certificates depend on hosting and are not covered.

**Rev. 3 (2026-11-16): 0 Fail, 0 Partial.** 56 Pass, 12 N/A, 2 not reviewed.

**Update 18 Nov 2026:** company file uploads (#354, #355) made V5.3.1 apply. It passes, because uploads are stored in GridFS and never written to disk. See [threat-model.md](./threat-model.md).

**Re-check 19 Nov 2026** (branch `fix/asvs-l3-quick-wins`): still 0 Fail in code. The [access rules](#access-rules-asvs-811) table had fallen behind the routes added for certificates, the proposal library, growth path, e-GP metrics and LINE (8.1.1 was briefly a documentation gap); it now lists every guarded route. Also on this branch: signup no longer reveals whether an address is registered, login takes the same time for unknown addresses, and password changes are emailed to the owner (Level 3 items, see [asvs-l3.md](./asvs-l3.md)).

Rev. 2 reported 0 Fail, but a full re-review of `main` at `0c9802e` found 7 failing and 10 partial items. All 17 are fixed on branch `fix/asvs-l1-critical-high`. The tables below describe the code on that branch.

## Summary

| Status | Count | Meaning |
| --- | --- | --- |
| Pass | 56 | Control exists, with evidence in code or this file |
| Partial | 0 | — |
| Fail | 0 | — |
| N/A | 12 | The app has no such feature |
| Not reviewed | 2 | TLS version and certificate, set by hosting |

### Changes since rev. 2

| ASVS | Rev. 2 | Re-review of `0c9802e` | Rev. 3 | What changed |
| --- | --- | --- | --- | --- |
| 9.1.3 | Pass | Partial | Pass | docker-compose fell back to the public dev `SESSION_SECRET`, so anyone could forge an admin token. Production now refuses a missing, published or short (< 32 chars) secret, in both `backend/src/config/env.ts` and `frontend/src/lib/auth.ts`; compose has no fallback |
| 6.3.2 | Pass | Fail | Pass | The production image seeded `admin@bma.go.th` / `Admin1234!` by default. Compose now seeds only when `.env` sets `SEED_DEMO_DATA=true`, and the backend warns if it ever seeds in production |
| 8.2.1 | Pass | Fail | Pass | `GET /tor/:torId/feedback?status=…` was public and returned pending and rejected comments; it is now approved-only. `/api/test-db` (any signed-in user could list collections) is deleted |
| 15.2.1 | Not reviewed | Fail | Pass | Backend had 1 critical and 4 high advisories in production dependencies; `npm audit fix` applied. CI now fails on high/critical; Dependabot added |
| 6.3.1 | Pass | Partial | Pass | Every login reached the backend from the Next.js server's IP, so 5 bad logins by anyone locked everyone out. The client IP is now forwarded and trusted only from loopback/private hops, and failed logins are capped per email |
| 6.2.8 | Pass | Fail | Pass | The signup action trimmed the password, so a password with a leading or trailing space never worked at login |
| 3.3.1 | Pass | Fail | Pass | The cookie is now `__Host-torr_session` and always `Secure` in production |
| 3.4.1 | Pass | Fail | Pass | HSTS came only from the backend, which browsers never reach. `frontend/next.config.ts` now sends it on every response |
| 6.2.4 | Pass | Fail | Pass | The common-password list had 116 entries; it now holds the 10,000 most common that the policy would otherwise accept |
| 6.2.2, 6.2.3 | Partial, N/A | Partial, N/A | Pass | New change-password form on `/profile`; it requires the current password |
| 15.3.1 | Pass | Partial | Pass | `/api/test-db` returned collection metadata and raw errors; deleted |
| 2.1.1, 6.1.1, 8.1.1 | Partial | Partial | Pass | Validation rules, rate limits and access rules are now written down in this file |
| 4.1.1 | Pass | Partial | Pass | Next.js JSON had no charset; every route handler and the proxy now use `jsonResponse()` (`application/json; charset=utf-8`) |
| 14.2.1 | Pass | Partial | Pass | Signup put the email in `/signup/pending?email=…`; it now travels in a 30-minute httpOnly cookie read by the server |
| 12.2.1 | Partial | Partial | Pass | Compose published plain HTTP on 3000/4000 and MongoDB on 27017 to the network; every port is now bound to `127.0.0.1`, so outside traffic must come through an HTTPS proxy. MongoDB credentials come from `.env` |
| 1.2.2 | Not reviewed | Pass | Pass | Checked: ids are URL-encoded; React 19 blocks `javascript:` hrefs |
| 3.2.1 | Partial | Pass | Pass | Relayed files: PDF/JPEG/PNG allowlist, magic-byte check, `nosniff` |
| 5.2.1, 5.2.2, 5.3.2 | N/A | Pass | Pass | The app does download and unzip portal files; size caps and type checks exist |
| 6.4.1 | N/A | Pass | Pass | Email-verify links are activation codes and meet the rule |

### Still open

No requirement is open in code. Two things are left to whoever runs the server:

- Put an HTTPS reverse proxy in front of `127.0.0.1:3000` (12.1.1, 12.2.2: TLS version and certificate), and set `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` in `.env` before the database volume is first created.
- Rotate `SESSION_SECRET` on any server that was ever started from compose with the old default.

---

## V1 — Encoding and Sanitization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.2.1 | Output encoding fits the context | Pass | React/JSX escapes all output; no `dangerouslySetInnerHTML` |
| 1.2.2 | Untrusted data in URLs is encoded; safe protocols only | Pass | Route handlers `encodeURIComponent` ids; React 19.2 blocks `javascript:` hrefs |
| 1.2.3 | Encoding when building JS/JSON | Pass | `JSON.stringify` / Nest serialization only |
| 1.2.4 | Database queries protected from injection | Pass | Typed Mongo filters; `ValidationPipe({ whitelist: true })` strips unknown fields; `common/regex.ts` escapes text before `$regex` |
| 1.2.5 | No OS command injection | N/A | No `child_process` / `exec` |
| 1.3.1 | WYSIWYG HTML is sanitized | N/A | No rich-text editor |
| 1.3.2 | No `eval()` or dynamic code | Pass | None found |
| 1.5.1 | XML parsers block XXE | N/A | No XML parser |

## V2 — Validation and Business Logic

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.1.1 | Validation rules are documented | Pass | [Input validation rules](#input-validation-rules-asvs-211) below |
| 2.2.1 | Input checked against business rules | Pass | A class-validator DTO on every body and query (28 DTO classes) |
| 2.2.2 | Validation runs on the trusted server | Pass | Global `ValidationPipe` in `backend/src/main.ts` |
| 2.3.1 | Business steps run in order | Pass | Signup → verify email → admin approval, enforced in `auth.service.ts` `issueSession()` |

## V3 — Web Frontend Security

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.2.1 | Responses can't render in the wrong context | Pass | Relayed documents limited to PDF/JPEG/PNG (`tor/tor-documents.ts`) with magic-byte checks (`common/archive-files.ts`); `nosniff` on every frontend response |
| 3.2.2 | Text rendered with safe functions | Pass | JSX text rendering only |
| 3.3.1 | Cookies `Secure` with `__Host-`/`__Secure-` prefix | Pass | `__Host-torr_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` in production (`frontend/src/lib/auth.ts`, `sessionCookieOptions()`). Dev keeps `torr_session` without `Secure` for plain-HTTP localhost |
| 3.4.1 | HSTS on all responses, max-age ≥ 1 year | Pass | `Strict-Transport-Security: max-age=31536000; includeSubDomains` from `frontend/next.config.ts`; backend via `helmet()` |
| 3.4.2 | CORS origin fixed or allowlisted | Pass | `enableCors({ origin: env.frontendOrigin })` |
| 3.5.1 | Cross-site requests to sensitive actions blocked | Pass | Session cookie is `SameSite=Lax`; Next.js server actions check `Origin` |
| 3.5.2 | No sensitive call skips CORS preflight | Pass | Backend accepts only `Authorization: Bearer`, never cookies |
| 3.5.3 | Sensitive actions don't use GET | Pass | Every write is POST/PUT/PATCH/DELETE |

## V4 — API and Web Service

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.1 | `Content-Type` matches the body, with charset | Pass | Nest sends `charset=utf-8`; the frontend's route handlers and proxy use `jsonResponse()` (`frontend/src/lib/json-response.ts`); relayed files keep their checked PDF/JPEG/PNG type |
| 4.4.1 | WebSockets use WSS | N/A | No WebSockets |

## V5 — File Handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 5.2.1 | Only file sizes it can process | Pass | 40 MB caps in `tor-document.service.ts`, `tor-archive.service.ts`, `archive-files.ts`; `inflateRawSync` with `maxOutputLength` (`common/zip.ts`) |
| 5.2.2 | Extension and content match the expected type | Pass | Extension and magic bytes both checked (`common/archive-files.ts`) |
| 5.3.1 | Untrusted files in public folders not executed | Pass | Company uploads (#354, #355) go to MongoDB GridFS, never to disk or a public folder, and are only ever served as attachments with `nosniff`; relayed portal files are never written to disk |
| 5.3.2 | File paths don't use user-supplied names | Pass | Zip entry names reduced to a base name, used only in `Content-Disposition`; uploaded files are stored under a GridFS id, and their name is only a display name (`safeFileName`) |

## V6 — Authentication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 6.1.1 | Anti-automation controls documented | Pass | [Rate limits](#rate-limits-and-anti-automation-asvs-611) below |
| 6.2.1 | Passwords ≥ 8 characters | Pass | `@MinLength(8)` on signup, reset and change |
| 6.2.2 | Users can change their password | Pass | Change-password form on `/profile` → `POST /auth/password` |
| 6.2.3 | Change needs current and new password | Pass | `ChangePasswordDto`; wrong current password → 400 and counts toward the per-email limit; all sessions end on success |
| 6.2.4 | Checked against ≥ 3,000 common passwords | Pass | `common/common-passwords.ts`: the 10,000 most common 8–128 character passwords (SecLists NCSC list); checked on signup, reset and change |
| 6.2.5 | No composition rules | Pass | Length only |
| 6.2.6 | Password fields masked | Pass | `components/ui/password-input.tsx` (`type="password"` with a show toggle) |
| 6.2.7 | Paste and password managers work | Pass | No paste blocking; `autocomplete` set on change-password fields |
| 6.2.8 | Password verified exactly as typed | Pass | Signup no longer trims the password; scrypt hashes the raw string |
| 6.3.1 | Brute force and credential stuffing limited | Pass | Per-IP throttle with the real client IP, plus 10 failures per email per 15 min (`auth/login-attempts.ts`) |
| 6.3.2 | No default accounts | Pass | Demo accounts are opt-in (`SEED_DEMO_DATA`), off by default in compose, warned about in production |
| 6.4.1 | Activation codes random, short-lived, single-use | Pass | 32 random bytes, SHA-256 stored, 1 h / 24 h expiry, deleted on use (`auth/account-links.service.ts`) |
| 6.4.2 | No password hints or secret questions | Pass | None in the schema |

## V7 — Session Management

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.2.1 | Tokens verified by a trusted backend | Pass | `session.guard.ts` / `role.guard.ts` check signature, expiry and revocation |
| 7.2.2 | Tokens generated per session | Pass | `createSessionToken()` in `common/token.ts` |
| 7.2.3 | Reference tokens ≥ 128 bits | N/A | Self-contained HMAC tokens |
| 7.2.4 | New token on every sign-in | Pass | `issueSession()` on every login and Google sign-in |
| 7.4.1 | Logout makes the session unusable | Pass | `POST /auth/logout` sets `sessionMinIssuedAt` (`common/session-revocation.service.ts`) |
| 7.4.2 | Disabling an account ends its sessions | Pass | Suspend, role change, password reset and password change all call `revoke()` |

## V8 — Authorization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1.1 | Access rules documented | Pass | [Access rules](#access-rules-asvs-811) below |
| 8.2.1 | Functions limited to roles that need them | Pass | Guards on every non-public route; public feedback route is approved-only; `/api/test-db` deleted |
| 8.2.2 | Data limited to its owner (no IDOR) | Pass | Saved TORs, saved searches and notifications filter on the session's `userId` |
| 8.3.1 | Authorization on the trusted server | Pass | Nest guards; the frontend `proxy.ts` only gates page navigation |

## V9 — Self-contained Tokens

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 9.1.1 | Signature checked before payload is trusted | Pass | `timingSafeEqual` HMAC check in `common/token.ts` |
| 9.1.2 | Only allowlisted algorithms | Pass | HMAC-SHA256 hard-coded; no `alg` field |
| 9.1.3 | Key material from a trusted source | Pass | Production refuses a missing, published or short `SESSION_SECRET`; compose has no fallback |
| 9.2.1 | Token used only within its validity time | Pass | `exp` checked by backend and frontend |

## V10 — OAuth and OIDC

All 5 items (10.4.1–10.4.5) are N/A: they apply to an authorization server. TorFinder only verifies Google ID tokens as a client, checking `audience` and `email_verified` (`auth.service.ts` `verifyGoogleCredential()`).

## V11 — Cryptography

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.3.1 | No insecure block modes | N/A | No encryption |
| 11.3.2 | Only approved ciphers | N/A | No encryption |
| 11.4.1 | Only approved hash functions | Pass | scrypt, HMAC-SHA256, SHA-256. `similar/similar.service.ts` uses SHA-1 only as a cache key, not for security |

## V12 — Secure Communication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.1 | Only TLS 1.2 / 1.3 | Not reviewed | Set by hosting |
| 12.2.1 | TLS for all external traffic | Pass | Compose binds every port to `127.0.0.1`, so nothing is served to the network over plain HTTP; outside traffic goes through the host's HTTPS proxy (`docs/operations/deployment-checklist.md`), and HSTS stops browsers falling back to HTTP |
| 12.2.2 | Publicly trusted certificates | Not reviewed | Set by hosting |

## V13 — Configuration

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.4.1 | No `.git` in the deployed app | Pass | `frontend/.dockerignore` excludes `.git`; backend build context holds none |

## V14 — Data Protection

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.2.1 | No sensitive data in URLs | Pass | Session tokens never in URLs. The signup email travels in a 30-minute httpOnly cookie (`frontend/src/lib/signup-email.ts`). One-time `?token=` reset/verify links are accepted, and `Referrer-Policy` keeps them from leaking |
| 14.3.1 | Client data cleared after logout | Pass | Logout and password change clear the httpOnly cookie; no token in `localStorage` |

## V15 — Secure Coding and Architecture

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.1 | Patch time frames documented | Pass | [Dependency-patch SLA](#dependency-patch-sla-asvs-1511) below |
| 15.2.1 | No component past those time frames | Pass | `npm audit --omit=dev`: 0 in backend and frontend (2026-11-16). CI fails on high/critical; Dependabot weekly |
| 15.3.1 | APIs return only needed fields | Pass | Password hashes projected out (`accounts.service.ts`); `/api/test-db` deleted |

---

## Input validation rules (ASVS 2.1.1)

- **Where**: every backend route that takes a body or query has a class-validator DTO. The global `ValidationPipe({ whitelist: true, transform: true })` drops unknown fields and rejects bad ones with 400 before any handler runs. Frontend checks are for usability only.
- **Email**: `@IsEmail`, stored trimmed and lower-cased.
- **Password**: 8–128 characters, no composition rules, not in the common-password list, never trimmed or case-changed.
- **Thai tax ID**: 13 digits (`@IsThaiTaxId`). The mod-11 check digit is a warning on the form, not a rejection.
- **Thai phone**: `@IsThaiPhone`.
- **Free text**: each field has a `@MaxLength` (e.g. company name 200, address 500, feedback 10–5,000).
- **Ids**: Mongo ids are checked with `ObjectId.isValid` before use; unknown ids answer 404.
- **Enumerations** (roles, statuses, report reasons, feedback status): `@IsIn` against the constants in each module.

## Rate limits and anti-automation (ASVS 6.1.1)

| Control | Limit | Where |
| --- | --- | --- |
| Every route | 100 requests / 60 s per client IP (`THROTTLE_LIMIT`) | `app.module.ts` `ThrottlerGuard` |
| Signup, login, Google sign-in, password forgot/reset/change, email verify/resend, feedback, reports | 5 / 60 s per client IP (`AUTH_THROTTLE_LIMIT`) | `@Throttle` on each route |
| Find similar | 30 / 60 s per client IP | `similar.controller.ts` |
| AI proposal draft | 5 / 60 s per client IP | `ai.controller.ts` |
| LINE webhook | 300 / 60 s per client IP (`LINE_WEBHOOK_THROTTLE_LIMIT`) | `notifications/line-webhook.controller.ts` |
| Failed logins and wrong current passwords | 10 per email address, lock lifts after 15 quiet minutes (`LOGIN_FAILURE_LIMIT`) | `auth/login-attempts.ts` |

The client IP is the right-most `X-Forwarded-For` entry the frontend forwards (`frontend/src/lib/client-ip.ts`). The backend believes it only from loopback and private addresses (`TRUST_PROXY`, default `loopback, uniquelocal`). If browsers reach Next.js directly with no proxy in front, a client can still spoof its IP; the per-email limit is the backstop. All counters are per process.

## Access rules (ASVS 8.1.1)

Roles: `viewer` (public Google sign-in), `org` (company), `admin`, `owner` (project owner), `auditor`. A guard admits exactly the roles it names; an admin is not implicitly an owner or auditor. Every guarded route also checks token revocation.

| Access | Routes |
| --- | --- |
| Public | `POST /auth/*` except logout and password change; `GET /tor`, `GET /tor/:id`, its documents (`/tor/:id/documents/*`) and its e-GP documents (`/tor/:id/egp-documents/*`); `GET /tor/:torId/feedback` (approved only); `GET /feedback/counts`; `POST /tor/:torId/feedback`; `POST /tor/:torId/reports`; `POST /tor/similar`; `GET /insights/market`; `GET /matching/tor/:id/budget`, `/bid-insight`; `POST /matching/tor/:id/score`; `GET /ai/status`; `GET /health` |
| Public, signed by the caller | `POST /line/webhook`: no session, but refused unless `X-Line-Signature` is LINE's HMAC of the raw body with the channel secret; 300/min per client IP |
| Any signed-in account (own data only) | `POST /auth/logout`, `POST /auth/password`, `GET/PATCH /accounts/me`, `GET /matching/opportunities`, `/notifications/*` (including LINE link/unlink and channel settings), `/saved-searches/*`, `/saved-tors/*` |
| `org` (own company's records only) | `POST /ai/proposal-draft/:torId`; `GET /insights/growth`; `/certificates/*` (records and their files); `/library/*` (team, references, past projects, their files, coverage and the starter-pack ZIP) |
| `owner` | `GET /owner/tors` |
| `auditor` | `GET /tor/flagged` |
| `admin` | `/accounts` (list, directory, edit, suspend, reactivate), `GET /audit`, `POST /tor`, `PATCH/DELETE /tor/:id`, `PUT /tor/:id/owner`, `POST /tor/:id/restore`, `GET /tor/deleted`, `/tor/not-software`, `GET /feedback`, `PATCH /feedback/:id`, `GET/PATCH /reports*`, `PATCH /accounts/:id/details`, `GET /matching/tor/:id/companies`, `POST /matching/budget/refresh`, `POST /ai/extract*`, `/egp/*` (sync, near-misses, metrics), `/mea/sync`, `/datagov/sync`, `/gproc/*` |

Data-level rule: a route that serves a caller's own data takes the user id from the session token, never from the request. Certificate and library records and files are looked up inside the signed-in company's own profile, so another company's record id is simply not found.

The frontend also serves `POST /api/csp-report` without a session: browsers post Content-Security-Policy violation reports there (ASVS 3.4.7). It only writes a capped log line.

## Level 2

The Level 2 triage (183 requirements) is in [asvs-l2.md](./asvs-l2.md).

## Logging and error handling (Level 2)

Security events, error handling and the git-history secret scan are described in [logging-and-errors.md](./logging-and-errors.md).

## Dependency-patch SLA (ASVS 15.1.1)

- **Critical/High** (from `npm audit` or Dependabot): fix within **7 days**. CI fails the build on these for production dependencies.
- **Medium**: fix within **30 days**.
- **Low**: fix within **90 days**, normally in the next sprint.
- Dependabot (`.github/dependabot.yml`) opens update PRs weekly for both apps.
