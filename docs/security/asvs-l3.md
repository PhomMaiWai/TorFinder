# ASVS 5.0 Level 3

Triage of TorFinder against the 92 [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/master/5.0/docs_en) requirements that are Level 3 only, plus the six L1/L2 requirements whose wording asks for more at Level 3. Done on 19 Nov 2026 on branch `fix/asvs-l3-quick-wins` (from `66ef677`), on top of [asvs-l1.md](./asvs-l1.md) and [asvs-l2.md](./asvs-l2.md), which were re-checked at the same time. Like those, this is a code read-through backed by tests, not a pentest.

TorFinder does not claim Level 3. This file says which Level 3 controls fit the application, which are done, and what the rest would take.

**Result: 68 Pass, 0 Partial, 4 Not done, 20 N/A, 0 not reviewed** (92 items). Of the 72 that apply, 68 pass (94%). Of the six stricter Level 3 conditions on L1/L2 requirements, 3 pass, 1 is partial, 1 is N/A and 1 is not done.

**Update 19 Nov 2026 (branch `feat/staff-passkeys`):** staff passkeys and step-up ([passkeys.md](./passkeys.md)). 6.5.6 and 6.7.2 now apply and pass; 7.5.3, 8.4.2 and the Level 3 condition on 6.3.3 move from Not done to Partial.

**Update 19 Nov 2026 (branch `fix/step-up-tor-owner`):** assigning an announcement's owner now needs step-up too, so 7.5.3 moves from Partial to Pass.

**Update 19 Nov 2026 (branch `feat/asvs-l3-lockout-reset`):** the owner is emailed when their account is locked after too many wrong passwords (6.3.5 moves to Partial: sign-ins from a new device are not reported yet), and admins can send an account's owner a password-reset link from Manage Users (6.4.6 passes).

**Update 19 Nov 2026 (branch `docs-asvs-l3-policies`):** [limits-and-retention.md](../operations/limits-and-retention.md) documents connection limits, timeouts and retries, data retention and the secret rotation schedule. The MongoDB pool limits are now set in code, MongoDB deletes expired notifications, import runs, audit entries and abandoned sign-ups through TTL indexes, and container logs are capped. 13.1.2, 13.1.3, 13.1.4, 13.2.6 and 14.2.7 pass.

**Update 20 Nov 2026 (branch `feat/asvs-l3-admin-approval`):** granting or removing the admin role needs a second admin. The first admin's edit files a request; a different admin approves it behind step-up, the requester can only cancel, and an unapproved request lapses after 48 hours. Every step is in the audit log and the security log. 2.3.5 passes; 8.4.2 gains a layer but stays Partial.

**Update 20 Nov 2026 (branch `feat/asvs-l3-quick-wins`):** four items move to Pass. The saved-search cap is claimed atomically (15.4.2); a sign-in from a browser the account hasn't used before emails its owner (6.3.5); links out of TorFinder go through a "you're leaving" page with a way back (3.7.3); and sign-up and comment forms are refused when sent back sooner than a person could fill them in (2.4.2).

**Update 20 Nov 2026 (branch `feat/asvs-l3-revocation-url`):** session revocation is read from the database on every request, and taking back a company's approval revokes its sessions (8.3.2); the frontend caps backend URLs and the forwarded client address (4.2.5). Then: a ReDoS audit of every regex in CI (1.3.12), the sign-in redirect checked with the browser's own URL parser (1.5.3), a warning banner for browsers missing the security features listed below (3.7.5), crypto discovery in CI with an inventory and post-quantum migration plan (11.1.3, 11.1.4, [crypto-inventory.md](./crypto-inventory.md)), and every allowed authorization decision logged (the 16.3.2 condition). L3 is 55/71 (77%).

**Update 20 Nov 2026 (branch `feat/asvs-l3-data-minimization`):** three items move to Pass. Admin lists return only what each screen shows; the user directory had been sending every company's whole profile, team members' CVs included (14.2.6). Sign-in and passkey code read only the account fields they use (11.7.2). Paths that look like files are refused before routing (13.4.7).

**Update 20 Nov 2026 (branch `feat/asvs-l3-files-secrets-adaptive`):** five items move to Pass, leaving no Partial. PDF and Word uploads lose their author, software and dates before storage (14.2.8); every parser of untrusted bytes runs in a worker thread with its own memory limit and deadline (15.2.5); `SESSION_SECRET` can be rotated without signing anyone out, the old key expiring by itself (13.3.4); and a sign-in from a device the account hasn't used before gets a 12-hour session, with every other admin emailed when it is a staff account (8.2.4, 8.4.2). What is left needs hosting or hardware: memory encryption, mutual TLS between services, an HSM, and the HSTS preload submission.

**Update 20 Nov 2026 (branch `feat/asvs-l3-mtls-edge`):** the services authenticate each other with TLS certificates from a private CA: frontend to backend, and backend to MongoDB with an x509 login instead of a password (12.3.5). A Caddy edge for deployment (`docker-compose.edge.yml`) serves TLS 1.2 and 1.3 with forward-secret ciphers only, staples OCSP and terminates HTTP/2 and HTTP/3 (12.1.2, 12.1.4, 4.2.3, 4.2.4). Companies can add a passkey (6.3.3, still Partial: optional). What is left is listed under [Accepted risks](#accepted-risks): each needs a domain, DNS or hardware the project doesn't have yet.

**Re-check 20 Nov 2026 (branch `fix/asvs-l3-recheck`):** counts and evidence re-checked against the code; every cited file, function and test exists. Since the services now set up TLS themselves, 11.6.2 applies: the internal links (frontend → backend, backend → MongoDB) are TLS 1.3 only, as Node's default TLS 1.2 list still included RSA key exchange and MongoDB accepted TLS 1.1 (`internal-tls.ts` on both sides, `--tlsDisabledProtocols` on `db`; `test/internal-tls.test.mjs` proves a 1.2 handshake is refused). Also corrected: the risky-components review now covers the four production dependencies added since 19 Nov, the contextual-attributes note no longer says 8.2.4 is not done, and the 3.4.3 condition points at `frontend/src/lib/csp.ts`. L3 is 68/72.

## Summary

| Status | Count | Meaning |
| --- | --- | --- |
| Pass | 68 | Control exists, with evidence in code or in this file |
| Partial | 0 | Control exists with a gap; the gap is named |
| Not done | 4 | Not implemented |
| N/A | 20 | The feature doesn't exist in TorFinder (no MFA devices, OAuth server, WebRTC, CSV export…) |
| Not reviewed | 0 | Set by the hosting proxy, outside the repository (now configured in `docker/caddy/Caddyfile`) |

| Chapter | L3 items | Pass | Partial | Not done | N/A | Not reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| V1 Encoding and Sanitization | 3 | 2 | 0 | 0 | 1 | 0 |
| V2 Validation and Business Logic | 2 | 2 | 0 | 0 | 0 | 0 |
| V3 Web Frontend Security | 12 | 11 | 0 | 1 | 0 | 0 |
| V4 API and Web Service | 6 | 5 | 0 | 0 | 1 | 0 |
| V5 File Handling | 4 | 4 | 0 | 0 | 0 | 0 |
| V6 Authentication | 12 | 7 | 0 | 0 | 5 | 0 |
| V7 Session Management | 1 | 1 | 0 | 0 | 0 | 0 |
| V8 Authorization | 6 | 6 | 0 | 0 | 0 | 0 |
| V9 Self-contained Tokens | 0 | — | — | — | — | — |
| V10 OAuth and OIDC | 7 | 1 | 0 | 0 | 6 | 0 |
| V11 Cryptography | 10 | 7 | 0 | 1 | 2 | 0 |
| V12 Secure Communication | 3 | 2 | 0 | 1 | 0 | 0 |
| V13 Configuration | 8 | 7 | 0 | 1 | 0 | 0 |
| V14 Data Protection | 4 | 4 | 0 | 0 | 0 | 0 |
| V15 Secure Coding and Architecture | 8 | 8 | 0 | 0 | 0 | 0 |
| V16 Security Logging and Error Handling | 1 | 1 | 0 | 0 | 0 | 0 |
| V17 WebRTC | 5 | 0 | 0 | 0 | 5 | 0 |
| **Total** | **92** | **68** | **0** | **4** | **20** | **0** |

## Done on this branch

| Change | Closes |
| --- | --- |
| Signup answers a registered address exactly like a new one and emails the address's owner instead; login spends the same scrypt work on unknown addresses, so its timing doesn't tell (measured: 25 ms either way) | 6.3.8 |
| Email to the owner after a password change, a password reset, and the first Google sign-in linked to an existing account | 6.3.7 |
| CSP violations reported to `POST /api/csp-report` (`report-uri` and `report-to` with `Reporting-Endpoints`), logged as `csp.violation` lines with query strings dropped | 3.4.7 |
| `Cross-Origin-Opener-Policy: same-origin-allow-popups` on every frontend response | 3.4.8 |
| `Cross-Origin-Resource-Policy: same-origin` on every frontend response (the backend's helmet already sent it) | 3.5.8 |
| Uploaded PNG and JPEG files: refused above 20,000 px a side or 50 megapixels, read from the header without decoding; EXIF, XMP, IPTC, text chunks and comments removed before storage (`backend/src/common/image-uploads.ts`) | 5.2.6, 14.2.8 (images) |
| Last-resort process handlers in `main.ts`; `restart: unless-stopped` on every compose service | 16.5.4 |
| Relayed portal documents no longer forward the portal's `Content-Length` when its body was compressed, since `fetch` hands over the decompressed bytes | 4.2.2 |
| `base-uri 'none'` in both CSPs (an L2 correction, see [asvs-l2.md](./asvs-l2.md)) | 3.4.3 |
| Unused create-next-app SVGs deleted from `frontend/public`; unused `bcryptjs` removed and test-only `mongodb` moved to devDependencies | 13.4.7, 15.2.3 |

---

## Required browser features

(V3.1.1, V3.7.5, V3.6.1)

TorFinder expects a browser that supports and honours:

| Feature | Used for |
| --- | --- |
| HTTPS with HSTS | All traffic; `max-age=31536000; includeSubDomains; preload` |
| Content-Security-Policy Level 3 (`nonce`, `'strict-dynamic'`) | Blocking injected scripts |
| `SameSite` and `__Host-` cookies | The session cookie |
| `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` | Window and resource isolation |
| `X-Content-Type-Options: nosniff` | No MIME sniffing of documents |

Every current version of Chrome, Edge, Firefox and Safari supports all of them. **Behaviour without them: warn, don't block.** Every page checks for CSP Level 3 (violation events), Web Crypto (which exists only in a secure, HTTPS context) and cross-origin isolation support (browsers that honour COOP). If any is missing, a banner asks the reader to update to a current browser and use HTTPS (`BrowserSupportNotice`). The site keeps working: React's output escaping and every server-side check still apply, since they don't depend on the browser. `SameSite`/`__Host-` cookies and `nosniff` can't be detected from a page; every browser that passes these checks supports them.

**External scripts (3.6.1):** the only script from another origin is Google Identity Services (`https://accounts.google.com/gsi/client`). Google does not publish a versioned, fixed file for it, so Subresource Integrity can't be used. The decision is to accept it: it is needed for Google sign-in, it is served by the identity provider itself, and the CSP lets only that one URL load. Fonts and every other asset are self-hosted.

## Contextual attributes in security decisions

(V8.1.3, V8.1.4)

| Attribute | Where | Threshold | Action |
| --- | --- | --- | --- |
| Client IP (right-most `X-Forwarded-For` from a trusted hop) | Every route | 100 requests / 60 s | 429, `rate.limited` logged |
| Client IP | Sign-in, signup, password and email-link routes, feedback, reports | 5 / 60 s | 429 |
| Client IP | LINE webhook | 300 / 60 s | 429 |
| Email address | Failed logins and wrong current passwords | 10 per 15 min | Refused until 15 quiet minutes pass, `auth.login.locked` logged |
| Device cookie (random, HttpOnly, hashed on the server) | Every successful sign-in | Not among the account's last 20 browsers | Owner emailed (`new-device`), and for a staff account every other admin (`staff-new-device`); session lasts 12 hours instead of 7 days; `auth.login.new_device` logged |
| Time since the form was served | Sign-up and comment submissions | Under 2 s, or over 24 h | 400, `input.rejected` logged (`form_too_fast` / `form_token_invalid`) |
| Time since last activity | Every signed-in request | 30 min idle, 7 days absolute | Session refused; sign in again |
| Comment window of a TOR | Feedback | Outside the window | Refused |

No other attribute (location, time of day) affects authentication or authorization. The device cookie is the adaptive control (8.2.4): a sign-in from a new device gets a shorter session and is reported, but is never refused.

## Risky components and dangerous functionality

(V15.1.4, V15.1.5)

**Risky components.** Production dependencies were reviewed on 19 Nov 2026 and re-checked on 20 Nov 2026. Backend: `@google/genai`, `@nestjs/*` (including `@nestjs/throttler`), `@simplewebauthn/server`, `class-transformer`, `class-validator`, `compression`, `google-auth-library`, `helmet`, `mongodb`, `reflect-metadata`, `rxjs`. Frontend: `@simplewebauthn/browser`, `jose`, `lucide-react`, `next`, `next-intl`, `react`, `react-dom`, `recharts`, `undici`. All are maintained by their vendor or a large project, none is end-of-life, and `npm audit --omit=dev` reports 0 in both. **None is classed as risky.** `class-validator` is watched most closely: its validators have had ReDoS advisories in the past (see 1.3.12). `@simplewebauthn/*` verifies passkeys, so its releases are read before updating; `undici` is Node's own HTTP client, used only to give server-side `fetch` the internal TLS certificate.

**Dangerous functionality** (parses untrusted bytes or runs costly work on untrusted input):

| Where | What | Existing limits |
| --- | --- | --- |
| `common/zip.ts`, `common/archive-files.ts` | Inflating zip entries from portal archives and uploaded `.docx` files | 40 MB archive cap, declared size checked first, inflation capped at that size, one entry per request, never written to disk |
| `common/image-uploads.ts` | Walking PNG chunks and JPEG segments of uploads | 5 MB upload cap, header-only parse, refuses anything it can't follow |
| `tor/tor-document.service.ts`, `gproc/*` | Relaying files from procurement portals | URLs only from stored TOR records, PDF/JPEG/PNG only, magic bytes checked, 40 MB cap, timeouts |
| `ai/*` | Sending TOR text and company data to Vertex AI | Off unless configured; admin-triggered extraction; drafts 5 per minute per client |
| `notifications/line-webhook.controller.ts` | Parsing LINE webhook bodies | Signature checked over the raw bytes before the body is used |

Parsing of untrusted bytes runs in a worker thread with its own memory limit and deadline (15.2.5, `common/parse-worker.ts`): upload cleaning and zip-entry inflation. Reading a zip's directory stays in the main thread; it is bounded by the archive cap and never inflates anything.

## Secrets and rotation

(V13.1.4, V13.3.4)

The secrets, where each is held, and when and how each is rotated are in [limits-and-retention.md](../operations/limits-and-retention.md#secrets-and-rotation) (13.1.4 passes). `SESSION_SECRET` rotates with a grace period in which the old key still verifies, then expires by itself; the other secrets are rotated by hand on the same schedule (13.3.4 passes).

---

## All Level 3 requirements

### V1 Encoding and Sanitization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.2.10 | Protection against CSV and formula injection when exporting spreadsheets | N/A | Nothing exports CSV or spreadsheet files |
| 1.3.12 | Regular expressions free from exponential backtracking; ReDoS mitigated | Pass | `scripts/regex-audit.mjs` finds every regex in the backend and frontend with the TypeScript parser (218 today), rejects nested-quantifier shapes and times each against adversarial 5,000-character inputs with a hard stop; CI fails on a finding (`test/regex-audit.test.mjs`, which also proves it catches `(a+)+$` and `^\s*\s*\s*$`). Patterns built at run time wrap only `escapeRegex(...)` input in fixed linear shapes, and inputs carry `@MaxLength` |
| 1.5.3 | Different parsers of the same data type parse consistently | Pass | One parser per data type, used for both the check and the use. JSON: Express's parser everywhere, and the LINE signature is checked over the same raw bytes it parses; the frontend re-serialises what it validated. URLs: the WHATWG `URL` parser decides the portal-host allowlist and is what `fetch` uses (`portal-fetch.ts`), and the sign-in `next` check now resolves with the same parser the browser uses (`safeNextPath`, `frontend/test/safe-redirect.test.mts`). UTF-8 throughout; no XML |

### V2 Validation and Business Logic

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.3.5 | High-value flows need approval by more than one user | Pass | Granting or removing the admin role files a request (`PATCH /accounts/:id/details` answers 202) that a different admin must approve, behind step-up (`AdminApprovalsService`, `test/admin-approvals.e2e.test.mjs`). The requester can't approve their own request, only cancel it; a request is void if its requester stopped being an admin or the account's role moved; at most one is open per account, and it lapses after 48 h (TTL). The one exception: a lone admin may name the first extra admin directly, since no one else could approve. Admins can't be suspended at all (only companies and public viewers can). Deleting a TOR and suspending a company still take one admin: they are reversible or don't hand out power |
| 2.4.2 | Business flows require realistic human timing | Pass | Sign-up and comment forms carry a token, signed with the session secret, saying when the page was served (`frontend/src/lib/form-timing.ts`). `FormTimingGuard` refuses a submission sent back sooner than 2 s (`FORM_MIN_SECONDS`), or with no genuine token for that form, or one over a day old (`test/form-timing.e2e.test.mjs`). The token can be resent, so a form refused for a typo can be fixed; how often is bounded by the 5-a-minute limit on both routes. Google sign-up completion is not timed: it needs a fresh Google credential first |

### V3 Web Frontend Security

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.1.1 | Documentation states required browser security features and behaviour without them | Pass | [Required browser features](#required-browser-features) |
| 3.2.3 | No DOM clobbering | Pass | React components and ES modules only; no globals read from `document` or `window` by name; TypeScript strict |
| 3.3.5 | Cookie name and value under 4096 bytes | Pass | The session token holds id, email, name, role and three times: well under 1 KB; the other cookies are a locale and an email address |
| 3.4.7 | CSP names a location to report violations | Pass | `report-uri /api/csp-report; report-to csp` plus `Reporting-Endpoints` (this branch) |
| 3.4.8 | `Cross-Origin-Opener-Policy` on document responses | Pass | `same-origin-allow-popups` from `next.config.ts` (this branch); `allow-popups` keeps the Google sign-in pop-up working |
| 3.5.6 | No JSONP | Pass | None anywhere |
| 3.5.7 | No authorized data in script resources | Pass | Scripts are the static Next.js bundle; per-user data comes only in HTML and JSON responses |
| 3.5.8 | Authenticated resources can't be embedded cross-origin | Pass | `Cross-Origin-Resource-Policy: same-origin` on every frontend response (this branch) and backend response (helmet); company files are also `attachment` |
| 3.6.1 | External assets use SRI, or a documented decision | Pass | Google Identity Services can't use SRI; decision recorded in [Required browser features](#required-browser-features) |
| 3.7.3 | Notify the user before redirecting outside the application, with a way to cancel | Pass | Every link out (e-GP and MEA source pages and documents, LINE, a certificate's verification page, the admin e-GP search) goes through `/leaving`, which names the destination host and offers **Continue** or **Stay on TorFinder** (`OffsiteLink`, `frontend/src/app/leaving`). Nothing redirects by itself, and only http(s) destinations are offered (`test/leaving-link.test.mts`) |
| 3.7.4 | Top-level domain on the HSTS preload list | **Not done** | The header is ready: `max-age=31536000; includeSubDomains; preload` (`frontend/next.config.ts`). What is left is submitting the production domain at hstspreload.org once every subdomain serves HTTPS; there is no production domain yet. See [Accepted risks](#accepted-risks) |
| 3.7.5 | Behaves as documented when the browser lacks a security feature | Pass | As documented in [Required browser features](#required-browser-features): a page loaded in a browser without CSP Level 3, Web Crypto (no secure context) or cross-origin isolation support shows a warning banner asking for a current browser over HTTPS (`BrowserSupportNotice`, `frontend/test/browser-features.test.mts`); it warns rather than blocks |

### V4 API and Web Service

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.4 | Only supported HTTP methods are accepted | Pass | Nest answers 404 and Next.js route handlers 405 to any method a route doesn't declare; TRACE is not implemented |
| 4.1.5 | Per-message signatures for highly sensitive requests | N/A | No such requests; the one machine-to-machine call in (LINE's webhook) is signed and checked |
| 4.2.2 | Generated `Content-Length` doesn't conflict with the framing | Pass | Lengths are set from buffers or stored sizes; the relayed portal document no longer forwards a compressed length for a decompressed body (this branch) |
| 4.2.3 | No HTTP/2 or HTTP/3 connection-specific header fields | Pass | HTTP/2 and HTTP/3 end at the Caddy edge (`docker/caddy/Caddyfile`), whose Go implementation drops connection-specific fields; Next.js behind it speaks HTTP/1.1. Checked: Next.js sends `Connection: close` on its own port, and the same response over HTTP/2 from the edge has no `Connection` or `Keep-Alive` field |
| 4.2.4 | No CR/LF in HTTP/2 or HTTP/3 header fields | Pass | Caddy's HTTP/2 and HTTP/3 servers refuse a field value containing CR, LF or NUL (Go `httpguts.ValidHeaderFieldValue`), and Node's HTTP/1.1 parser behind it refuses CR/LF in header values |
| 4.2.5 | Outgoing URIs and headers are kept short enough for the receiver | Pass | The frontend never sends the backend a URL longer than 2,048 characters (`isBackendPathTooLong` in `fetchJson` and the shared proxy answer 414 instead), well under the backend's 16 KB header limit; the forwarded client address is sent only if it is IP-shaped and at most 45 characters (`client-ip.ts`); ids are validated ObjectIds and cookies are small (`frontend/test/backend-path.test.mts`) |

### V5 File Handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 5.2.4 | Per-user file size quota and file count | Pass | 5 MB per file, at most 100 certificates and 200 library records per company, one file each; the record caps are atomic |
| 5.2.5 | Compressed uploads with symlinks refused | Pass | No archive is ever extracted to a file system; one entry is inflated into memory, so a symlink entry has nothing to point at |
| 5.2.6 | Images above a maximum pixel size refused | Pass | 20,000 px a side and 50 megapixels, read from the PNG IHDR or JPEG SOF header (this branch) |
| 5.3.3 | Decompression ignores user-provided paths (zip slip) | Pass | Entry names are reduced to a base name and used only as a download name |

### V6 Authentication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 6.3.5 | Users notified of suspicious authentication attempts | Pass | The wrong password that locks an account emails its owner, once per lock (`login-locked` notice). A successful sign-in from a browser the account hasn't used before emails the owner with the time, browser and IP (`new-device` notice, `auth.login.new_device` event; `AuthService.noteDevice`, `test/new-device-notice.test.mjs`). A browser is known by a random HttpOnly device cookie, stored only as a hash, the last 20 per account. The account's first recorded browser is not reported (sign-up, or the first sign-in after this shipped); a sign-in with no device id counts as new |
| 6.3.6 | Email not used as an authentication factor | Pass | Email links verify an address or reset a password; neither creates a session, and there is no email OTP sign-in |
| 6.3.7 | Users notified after changes to authentication details | Pass | Email after a password change, a password reset and a new Google link (this branch); the email address itself can't be changed |
| 6.3.8 | Valid users can't be deduced from failed authentication, registration or forgot-password | Pass | Login: same message and the same scrypt cost for unknown addresses; "unverified" and "pending" are only told after the right password. Signup: the same answer for a registered address (this branch). Forgot-password and resend-verification: always the same answer. Google sign-up still says an address is taken, but only after Google proved the caller owns it |
| 6.4.5 | Renewal reminders before an authentication mechanism expires | N/A | Nothing expires (no certificates or tokens issued to users) |
| 6.4.6 | Admins can start a reset without choosing the user's password | Pass | **Send reset link** in Manage Users (`POST /accounts/:id/password-reset`, admin + step-up) emails the owner the same single-use, one-hour link as "forgot password". The admin never sees or sets the password, the current one keeps working until the link is used, and the action is in the audit log (`test/admin-password-reset.e2e.test.mjs`). Viewers (Google only) and suspended accounts are refused |
| 6.5.6 | Any authentication factor can be revoked | Pass | A staff member removes their own passkeys (after a passkey check); another admin can clear them all, which ends every session; a password is replaced by reset |
| 6.5.7 | Biometrics only as a secondary factor | N/A | No biometrics |
| 6.5.8 | TOTPs checked against a trusted time source | N/A | No TOTP |
| 6.6.4 | Push-notification MFA rate limited | N/A | No push MFA |
| 6.7.1 | Certificates for cryptographic authentication protected from modification | N/A | Passkeys are registered with attestation `none`; no certificate is relied on to verify them |
| 6.7.2 | Challenge nonce at least 64 bits | Pass | Passkey challenges are 32 random bytes (256 bits), single use, tied to one account and purpose, 5-minute lifetime |

### V7 Session Management

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.5.3 | Further authentication before highly sensitive operations | Pass | Approving or rejecting a company, editing a role, suspending, deleting an announcement, assigning an announcement's owner and clearing passkeys need a passkey check from the last 10 minutes (`StepUpGuard`; list in [passkeys.md](./passkeys.md)) |

### V8 Authorization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1.3 | Environmental and contextual attributes used in security decisions are documented | Pass | [Contextual attributes](#contextual-attributes-in-security-decisions) |
| 8.1.4 | How those attributes are used (thresholds, actions) is documented | Pass | Same table |
| 8.2.4 | Adaptive controls on environmental attributes, at sign-in and during a session | Pass | The device a sign-in comes from changes what happens: from a device the account hasn't used before (device cookie, see [Contextual attributes](#contextual-attributes-in-security-decisions)) the owner is emailed, a staff account's sign-in is also emailed to every other admin, and the session lasts 12 hours instead of 7 days, so it ends the same day (`NEW_DEVICE_SESSION_SECONDS`, `test/new-device-notice.test.mjs`). Rate limits and the per-address lockout react to failed attempts |
| 8.3.2 | Authorization changes apply immediately | Pass | Every authenticated request reads the account's revocation floor from the database (no cache), so a revocation from any backend process applies to the next request. Role changes, suspension, passkey resets, password changes and taking back a company's approval all revoke the account's sessions (`test/revocation-immediate.e2e.test.mjs`) |
| 8.3.3 | Access is based on the originating user's permissions, not an intermediary's | Pass | The frontend calls the backend with the user's own session token; there is no service account acting for users |
| 8.4.2 | Administrative interfaces have multiple layers of security | Pass | Admin role; a phishing-resistant passkey at sign-in; step-up for sensitive actions; a second admin's approval to grant or remove the admin role; and contextual checks: a staff sign-in from a new device gets a 12-hour session and is reported to every other admin (8.2.4) |

### V10 OAuth and OIDC

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 10.2.3 | The client requests only the scopes it needs | Pass | Google Identity Services ID token only (`openid email profile`); no access token is requested |
| 10.3.5 | Resource server requires sender-constrained access tokens | N/A | Not an OAuth resource server |
| 10.4.12 | Authorization server allows only the needed `response_mode` | N/A | Not an authorization server |
| 10.4.13 | Code grant always with PAR | N/A | Not an authorization server |
| 10.4.14 | Only sender-constrained access tokens issued | N/A | Not an authorization server |
| 10.4.15 | `authorization_details` protected from tampering | N/A | Not an authorization server |
| 10.4.16 | Strong client authentication required | N/A | Not an authorization server |

### V11 Cryptography

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.1.3 | Cryptographic discovery finds every use of cryptography | Pass | `scripts/crypto-inventory.mjs` scans the backend and frontend for every cryptographic API (hashing, MACs, KDFs, random, signatures, WebAuthn, ID-token verification); the result is recorded in [crypto-inventory.json](./crypto-inventory.json) and CI fails when the code uses cryptography the inventory doesn't list (`test/crypto-inventory.test.mjs`) |
| 11.1.4 | Migration plan to new standards, including post-quantum | Pass | [crypto-inventory.md](./crypto-inventory.md): every use with its algorithm, key and purpose, plus a migration plan per primitive, including post-quantum (WebAuthn algorithms, hybrid TLS key exchange at the proxy, HMAC/scrypt changes through the stored settings) |
| 11.2.4 | Constant-time cryptographic operations | Pass | `timingSafeEqual` for session signatures, password hashes and LINE signatures; login now runs scrypt for unknown addresses too |
| 11.2.5 | Cryptographic modules fail securely | Pass | Any parse or verify error makes a token invalid; there is no decryption to leak padding errors |
| 11.3.4 | Nonces and IVs used once per key | N/A | No encryption |
| 11.3.5 | Encrypt-then-MAC | N/A | No encryption |
| 11.5.2 | Random generation works under heavy demand | Pass | Node's `crypto.randomBytes` / `randomInt` (OpenSSL CSPRNG), which doesn't block or degrade |
| 11.6.2 | Approved key exchange with secure parameters | Pass | The application's own TLS (frontend → backend, backend → MongoDB) is TLS 1.3 only, so the key exchange is always ephemeral ECDHE (X25519 or P-256) with AEAD suites: `minVersion: "TLSv1.3"` in `backend/src/common/internal-tls.ts` and `frontend/src/lib/internal-tls.ts`, `--tlsDisabledProtocols=TLS1_0,TLS1_1,TLS1_2` on `db` (`test/internal-tls.test.mjs` refuses a 1.2 handshake; checked against `mongo:7`: 1.2 refused, 1.3 accepted). The public edge is 12.1.2 |
| 11.7.1 | Full memory encryption for data in use | **Not done** | Depends on the host (e.g. confidential VMs); not in place |
| 11.7.2 | Data minimization during processing | Pass | Sign-in, password change and passkey code read an account through `SIGN_IN_FIELDS` (credentials and status, not the company profile); account endpoints use one projection per audience (`DIRECTORY_FIELDS`, `REVIEW_FIELDS`, `OWN_ACCOUNT_FIELDS`). Password hashes are never returned and secrets never logged. Code that reads a whole company profile (matching, proposal drafts) uses it |

### V12 Secure Communication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.4 | Certificate revocation (OCSP stapling) enabled | Pass | Caddy staples an OCSP response whenever the certificate names a responder and refreshes it in the background; it is on by default and not turned off (`docker/caddy/Caddyfile`). Let's Encrypt now publishes revocation by CRL instead of OCSP, which browsers check themselves |
| 12.1.5 | Encrypted Client Hello enabled | **Not done** | Caddy supports ECH, but it must publish its key in a DNS HTTPS record, which needs Caddy built with the DNS provider's module and an API token for the production domain. The two lines are in the Caddyfile, commented; steps in the deployment checklist. See [Accepted risks](#accepted-risks) |
| 12.3.5 | Strong mutual authentication between internal services | Pass | A private CA (`docker/certs/generate.sh`, run by the `certs` service on every `up`) issues one certificate per service, each in its own volume. Frontend → backend: HTTPS where the backend requires a client certificate from that CA and then only the frontend's (`common/internal-tls.ts`), and the frontend trusts only that CA for the backend (`frontend/src/lib/internal-tls.ts`). Backend → MongoDB: TLS required, with an x509 login (`MONGODB-X509`) instead of a password; the old password account is removed. Edge → frontend: Caddy shares the frontend's network namespace and Next.js listens on loopback only. Checked on a running stack: no client certificate, or another service's certificate, is refused; MongoDB refuses a password without a certificate, and plain TCP |

### V13 Configuration

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.1.2 | Documented maximum concurrent connections per service and behaviour at the limit | Pass | [Connections to other systems](../operations/limits-and-retention.md#connections-to-other-systems): MongoDB pool 50 with a 10 s wait, then a generic 500; per-portal concurrency; incoming rate limits |
| 13.1.3 | Documented resource management: timeouts, retries, back-off | Pass | [Timeouts, retries and back-off](../operations/limits-and-retention.md#timeouts-retries-and-back-off): every outbound call's timeout, retry count, back-off and budget |
| 13.1.4 | Critical secrets and their rotation schedule documented | Pass | [Secrets and rotation](../operations/limits-and-retention.md#secrets-and-rotation): each secret, where it is held, when and how it is rotated |
| 13.2.6 | Connections follow the documented configuration | Pass | The MongoDB client is built from the documented settings (`env.database`, `DatabaseService`); portal clients use the documented timeouts, retries and concurrency |
| 13.3.3 | Cryptographic operations in an isolated security module | **Not done** | Keys are in process memory |
| 13.3.4 | Secrets expire and are rotated as documented | Pass | `SESSION_SECRET` rotates without signing anyone out: the old key goes in `SESSION_SECRET_PREVIOUS`, accepted for checking only, until `SESSION_SECRET_PREVIOUS_UNTIL`, after which it stops working by itself; production refuses an end date more than 8 days ahead. `SESSION_SECRET_CREATED` dates the current key, and the backend logs `config.secret_rotation_due` daily once it is older than the 365-day schedule (`test/session-rotation.test.mjs`). Procedure and the other secrets' schedule: [limits-and-retention.md](../operations/limits-and-retention.md#secrets-and-rotation) |
| 13.4.6 | No detailed backend version information exposed | Pass | `poweredByHeader: false` (now also in the Docker image, which had left `next.config.ts` out of its final stage until 19 Nov), helmet removes `X-Powered-By`, `/health` returns status only, errors are generic |
| 13.4.7 | The web tier serves only expected file types | Pass | Next.js serves only its build output and `public/` (empty). The proxy's matcher lets only image, font, `.txt` and `.xml` requests bypass it; any other path with a dot in a segment, outside `/api/`, gets 404 before routing (`isUnexpectedFile`, `frontend/test/served-files.test.mts`), so `/.env`, `/.git/config` or `/backup.zip` never reach a handler |

### V14 Data Protection

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.2.5 | Caches store only expected content; no web cache deception | Pass | No shared cache in front of the app; every API and page answer is `no-store` except immutable public documents, and unknown paths get 404 |
| 14.2.6 | Only the minimum sensitive data is returned | Pass | Hashes never leave the server. The user directory returns a company's name only; the sign-up review queue returns the contact and business details an admin checks, not team members (CVs), past projects or certificates; full profiles go only to their owner (`test/admin-dashboard.e2e.test.mjs`). The queue's status filter queries only a constant status, so a query operator can't reach MongoDB (`test/accounts.e2e.test.mjs`) |
| 14.2.7 | Sensitive data deleted on a retention schedule | Pass | [How long data is kept](../operations/limits-and-retention.md#how-long-data-is-kept): TTL indexes delete notifications (180 days), import runs (90), audit entries (365) and unconfirmed pending sign-ups (30); links expire on their own; container logs are capped at 5 × 10 MB. `DatabaseService.applyRetention`, `test/retention.e2e.test.mjs`. An account's own data is deleted by an admin on request (no self-service) |
| 14.2.8 | Metadata removed from user-submitted files | Pass | Every upload is cleaned before storage (`cleanUpload`): PNG and JPEG lose EXIF, XMP, IPTC and text chunks; PDFs lose their document-information values and XMP, overwritten in place at the same length, including inside compressed object streams and old revisions; Word files lose `docProps` (author, last modified by, company, software, dates) (`common/document-metadata.ts`, `test/document-metadata.test.mjs`). Encrypted PDFs are refused. Names inside the content (comment and tracked-change authors) are part of what was written and are kept |

### V15 Secure Coding and Architecture

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.4 | Risky third-party components identified | Pass | [Risky components and dangerous functionality](#risky-components-and-dangerous-functionality) |
| 15.1.5 | Dangerous functionality identified | Pass | Same section |
| 15.2.4 | Dependencies come from the expected repository; no dependency confusion | Pass | Only public npm packages, no private or scoped internal names to impersonate; `npm ci` from lockfiles with integrity hashes; Dependabot with a cooldown |
| 15.2.5 | Extra protection (sandboxing, isolation) around dangerous functionality | Pass | Cleaning uploads (images, PDF, Word) and inflating entries of portal zip bundles run in a worker thread per task, with a 256 MB heap limit and a 15-second deadline, after which the worker is terminated; the request gets a 4xx and the server carries on (`common/parse-worker.ts`). AI calls are network requests to Vertex AI, not local parsing, and stay in the main process |
| 15.4.1 | Thread-safe access to shared objects | Pass | Node.js runs request code on one thread; in-memory caches are only touched there |
| 15.4.2 | Check and action are atomic (no TOCTOU) | Pass | Certificate and library caps, link-code use and email uniqueness are atomic database operations. The saved-search cap reserves a slot with a conditional `$inc` on a per-account counter (`savedSearchCounts`) before inserting, recounted from the real documents at startup (`test/saved-searches.e2e.test.mjs`: five parallel saves for the last slot, one succeeds) |
| 15.4.3 | Locks used consistently, no deadlocks | Pass | No locks; MongoDB single-document updates only |
| 15.4.4 | No thread starvation | Pass | Long work is async with timeouts and concurrency caps; CPU-heavy scrypt runs on libuv's pool |

### V16 Security Logging and Error Handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 16.5.4 | A last-resort handler catches unhandled exceptions | Pass | `AllExceptionsFilter` for requests; `unhandledRejection` (logged, keeps serving) and `uncaughtException` (logged, exits for restart) in `main.ts`, with `restart: unless-stopped` in compose (this branch) |

### V17 WebRTC

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 17.1.2 | TURN server resists port exhaustion | N/A | No WebRTC |
| 17.2.5 | Media server survives an SRTP flood | N/A | No WebRTC |
| 17.2.6 | Media server not vulnerable to the DTLS ClientHello race | N/A | No WebRTC |
| 17.2.7 | Recording survives an SRTP flood | N/A | No WebRTC |
| 17.2.8 | DTLS certificate checked against the SDP fingerprint | N/A | No WebRTC |

## Stricter Level 3 conditions on L1/L2 requirements

| ID | Level 3 condition | Status | Evidence |
| --- | --- | --- | --- |
| 3.4.3 | Per-response CSP with nonces or hashes | Pass | A fresh nonce per page request: `frontend/src/lib/csp.ts`, set by `proxy.ts` (`frontend/test/csp.test.mts`) |
| 6.3.3 | One factor is hardware-based and phishing-resistant (FIDO, passkey) | Partial | Staff use a passkey (WebAuthn, origin-bound, user presence required) after their password or Google, required in production. Company accounts can add one, and from then on their sign-in needs it (`test/passkeys.e2e.test.mjs`); it is optional, by the team's decision. Public viewers sign in with Google only |
| 6.6.1 | No phone or SMS factor | N/A | None offered |
| 12.1.2 | Only forward-secret cipher suites | Pass | The Caddy edge allows TLS 1.2 and 1.3 only; for 1.2, ECDHE key exchange with AES-GCM or ChaCha20 only, and every 1.3 suite is forward secret. Checked: TLS 1.0 and 1.1, `AES128-SHA`, `AES256-GCM-SHA384` (RSA key exchange) and `ECDHE-RSA-AES128-SHA` (CBC) are refused; `ECDHE-ECDSA-AES128-GCM-SHA256` and TLS 1.3 are accepted. The internal links are TLS 1.3 only (11.6.2) |
| 13.3.1 | Secrets in a hardware-backed store (HSM) | **Not done** | Environment variables |
| 16.3.2 | Every authorization decision logged, including reads of sensitive data | Pass | Refusals are logged as `access.denied`, and every request a guard admits as `access.granted` (user, role, method, path; never the query or the data), so reads of protected data are on record (`logGranted` in `session.guard.ts`, `test/authorization-log.test.mjs`) |

## Accepted risks

What is still Not done, why, and what would close it. None of these can be done in the repository alone; each is reviewed when the project gets a production host.

| ID | What is missing | Why it is accepted for now | What closes it |
| --- | --- | --- | --- |
| 3.7.4 | The domain on the HSTS preload list | There is no production domain yet. The header already asks for preload | Submit the domain at hstspreload.org after the first deploy, once every subdomain serves HTTPS |
| 12.1.5 | Encrypted Client Hello | Needs a DNS provider and API token for the production domain | Build Caddy with the provider's DNS module and enable the two commented lines in `docker/caddy/Caddyfile` |
| 11.7.1 | Memory encrypted while in use | A host feature (AMD SEV, Intel TDX) of the machine, not of the application | Deploy on confidential VMs (e.g. Google Cloud Confidential VM, Azure DCasv5) |
| 13.3.3 / 13.3.1 (condition) | Keys in a hardware security module | `SESSION_SECRET` signs every request in the frontend's proxy and backend; a remote HSM call per request is out of scope for this project. The impact is limited: the key rotates with an expiring grace period (13.3.4), and every internal private key is readable only by its own service | Move `SESSION_SECRET` and the internal CA key into a cloud KMS or HSM, with signing done there |

## Suggested order for the rest

1. ~~**6.3.3 / 7.5.3:** passkeys for staff and step-up before admin actions~~ — done on `feat/staff-passkeys`, and step-up on owner assignment on `fix/step-up-tor-owner`. Left: a second factor for company accounts.
2. ~~**6.3.5, 6.4.6:** email on lockout; an admin "send reset link" action~~ — done on `feat/asvs-l3-lockout-reset`, and the new-device email on `feat/asvs-l3-quick-wins`.
3. ~~**2.3.5, 8.4.2:** a second admin's approval to grant the admin role~~ — done on `feat/asvs-l3-admin-approval`, for removing it too.
4. ~~**14.2.7, 13.1.2–13.1.4, 13.3.4:** write the retention, connection and rotation policies the team agrees on~~ — done on `docs-asvs-l3-policies`. The session-secret rotation and expiry were added on `feat/asvs-l3-files-secrets-adaptive`.
5. ~~**15.4.2, 3.7.3, 2.4.2:** atomic saved-search cap, leaving-site notice, human timing on forms~~ — done on `feat/asvs-l3-quick-wins`.
6. ~~**14.2.8 (documents), 15.2.5, 13.3.4, 8.2.4, 8.4.2:** strip PDF/Word metadata, parse files in a worker, rotate the session secret with a grace period, shorter sessions and admin alerts on new devices~~ — done on `feat/asvs-l3-files-secrets-adaptive`. Originally: strip PDF/Word metadata and move file parsing into a worker with its own limits.
7. ~~**16.3.2, 11.1.3**~~ — done on `feat/asvs-l3-revocation-url` (every authorization decision logged; crypto discovery in CI). Left: **12.3.5, 13.3.x**, which need network and hosting infrastructure beyond the repository.
8. ~~**14.2.6, 11.7.2, 13.4.7:** minimal projections per audience and for sign-in; file-type gate~~ — done on `feat/asvs-l3-data-minimization`.
9. ~~**12.3.5, 12.1.2, 12.1.4, 4.2.3, 4.2.4, 6.3.3 (companies):** internal mutual TLS, the Caddy edge, optional company passkeys~~ — done on `feat/asvs-l3-mtls-edge`. The rest is in [Accepted risks](#accepted-risks).
