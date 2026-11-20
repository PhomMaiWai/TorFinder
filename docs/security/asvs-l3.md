# ASVS 5.0 Level 3

Triage of TorFinder against the 92 [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/master/5.0/docs_en) requirements that are Level 3 only, plus the six L1/L2 requirements whose wording asks for more at Level 3. Done on 19 Nov 2026 on branch `fix/asvs-l3-quick-wins` (from `66ef677`), on top of [asvs-l1.md](./asvs-l1.md) and [asvs-l2.md](./asvs-l2.md), which were re-checked at the same time. Like those, this is a code read-through backed by tests, not a pentest.

TorFinder does not claim Level 3. This file says which Level 3 controls fit the application, which are done, and what the rest would take.

**Result: 44 Pass, 12 Partial, 11 Not done, 21 N/A, 4 not reviewed** (92 items). Of the 71 that apply, 44 pass (62%). Of the six stricter Level 3 conditions on L1/L2 requirements, 1 passes, 1 is partial, 1 is N/A, 1 is set by hosting and 2 are not done.

**Update 19 Nov 2026 (branch `feat/staff-passkeys`):** staff passkeys and step-up ([passkeys.md](./passkeys.md)). 6.5.6 and 6.7.2 now apply and pass; 7.5.3, 8.4.2 and the Level 3 condition on 6.3.3 move from Not done to Partial.

**Update 19 Nov 2026 (branch `fix/step-up-tor-owner`):** assigning an announcement's owner now needs step-up too, so 7.5.3 moves from Partial to Pass.

**Update 19 Nov 2026 (branch `feat/asvs-l3-lockout-reset`):** the owner is emailed when their account is locked after too many wrong passwords (6.3.5 moves to Partial: sign-ins from a new device are not reported yet), and admins can send an account's owner a password-reset link from Manage Users (6.4.6 passes).

**Update 19 Nov 2026 (branch `docs-asvs-l3-policies`):** [limits-and-retention.md](../operations/limits-and-retention.md) documents connection limits, timeouts and retries, data retention and the secret rotation schedule. The MongoDB pool limits are now set in code, MongoDB deletes expired notifications, import runs, audit entries and abandoned sign-ups through TTL indexes, and container logs are capped. 13.1.2, 13.1.3, 13.1.4, 13.2.6 and 14.2.7 pass.

**Update 20 Nov 2026 (branch `feat/asvs-l3-admin-approval`):** granting or removing the admin role needs a second admin. The first admin's edit files a request; a different admin approves it behind step-up, the requester can only cancel, and an unapproved request lapses after 48 hours. Every step is in the audit log and the security log. 2.3.5 passes; 8.4.2 gains a layer but stays Partial.

## Summary

| Status | Count | Meaning |
| --- | --- | --- |
| Pass | 44 | Control exists, with evidence in code or in this file |
| Partial | 12 | Control exists with a gap; the gap is named |
| Not done | 11 | Not implemented |
| N/A | 21 | The feature doesn't exist in TorFinder (no MFA devices, OAuth server, WebRTC, CSV export…) |
| Not reviewed | 4 | Set by the hosting proxy, outside the repository |

| Chapter | L3 items | Pass | Partial | Not done | N/A | Not reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| V1 Encoding and Sanitization | 3 | 0 | 2 | 0 | 1 | 0 |
| V2 Validation and Business Logic | 2 | 1 | 0 | 1 | 0 | 0 |
| V3 Web Frontend Security | 12 | 9 | 1 | 2 | 0 | 0 |
| V4 API and Web Service | 6 | 2 | 1 | 0 | 1 | 2 |
| V5 File Handling | 4 | 4 | 0 | 0 | 0 | 0 |
| V6 Authentication | 12 | 6 | 1 | 0 | 5 | 0 |
| V7 Session Management | 1 | 1 | 0 | 0 | 0 | 0 |
| V8 Authorization | 6 | 3 | 2 | 1 | 0 | 0 |
| V9 Self-contained Tokens | 0 | — | — | — | — | — |
| V10 OAuth and OIDC | 7 | 1 | 0 | 0 | 6 | 0 |
| V11 Cryptography | 10 | 3 | 1 | 3 | 3 | 0 |
| V12 Secure Communication | 3 | 0 | 0 | 1 | 0 | 2 |
| V13 Configuration | 8 | 5 | 1 | 2 | 0 | 0 |
| V14 Data Protection | 4 | 2 | 2 | 0 | 0 | 0 |
| V15 Secure Coding and Architecture | 8 | 6 | 1 | 1 | 0 | 0 |
| V16 Security Logging and Error Handling | 1 | 1 | 0 | 0 | 0 | 0 |
| V17 WebRTC | 5 | 0 | 0 | 0 | 5 | 0 |
| **Total** | **92** | **44** | **12** | **11** | **21** | **4** |

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
| HTTPS with HSTS | All traffic; `max-age=31536000; includeSubDomains` |
| Content-Security-Policy Level 3 (`nonce`, `'strict-dynamic'`) | Blocking injected scripts |
| `SameSite` and `__Host-` cookies | The session cookie |
| `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` | Window and resource isolation |
| `X-Content-Type-Options: nosniff` | No MIME sniffing of documents |

Every current version of Chrome, Edge, Firefox and Safari supports all of them. **Behaviour without them:** the application does not detect the browser and does not warn or block. A browser without CSP still gets React's output escaping and the server-side checks, which do not depend on the browser. This is the documented decision, so 3.7.5 is Partial rather than Pass: the behaviour is defined, but it is "allow", not "warn".

**External scripts (3.6.1):** the only script from another origin is Google Identity Services (`https://accounts.google.com/gsi/client`). Google does not publish a versioned, fixed file for it, so Subresource Integrity can't be used. The decision is to accept it: it is needed for Google sign-in, it is served by the identity provider itself, and the CSP lets only that one URL load. Fonts and every other asset are self-hosted.

## Contextual attributes in security decisions

(V8.1.3, V8.1.4)

| Attribute | Where | Threshold | Action |
| --- | --- | --- | --- |
| Client IP (right-most `X-Forwarded-For` from a trusted hop) | Every route | 100 requests / 60 s | 429, `rate.limited` logged |
| Client IP | Sign-in, signup, password and email-link routes, feedback, reports | 5 / 60 s | 429 |
| Client IP | LINE webhook | 300 / 60 s | 429 |
| Email address | Failed logins and wrong current passwords | 10 per 15 min | Refused until 15 quiet minutes pass, `auth.login.locked` logged |
| Time since last activity | Every signed-in request | 30 min idle, 7 days absolute | Session refused; sign in again |
| Comment window of a TOR | Feedback | Outside the window | Refused |

No other attribute (location, device, time of day) affects authentication or authorization. Adaptive controls built on them (8.2.4) are not done.

## Risky components and dangerous functionality

(V15.1.4, V15.1.5)

**Risky components.** Production dependencies were reviewed on 19 Nov 2026. Backend: `@google/genai`, `@nestjs/*`, `class-transformer`, `class-validator`, `compression`, `google-auth-library`, `helmet`, `mongodb`, `reflect-metadata`, `rxjs`. Frontend: `jose`, `lucide-react`, `next`, `next-intl`, `react`, `react-dom`, `recharts`. All are maintained by their vendor or a large project, none is end-of-life, and `npm audit --omit=dev` reports 0 in both. **None is classed as risky.** `class-validator` is watched most closely: its validators have had ReDoS advisories in the past (see 1.3.12).

**Dangerous functionality** (parses untrusted bytes or runs costly work on untrusted input):

| Where | What | Existing limits |
| --- | --- | --- |
| `common/zip.ts`, `common/archive-files.ts` | Inflating zip entries from portal archives and uploaded `.docx` files | 40 MB archive cap, declared size checked first, inflation capped at that size, one entry per request, never written to disk |
| `common/image-uploads.ts` | Walking PNG chunks and JPEG segments of uploads | 5 MB upload cap, header-only parse, refuses anything it can't follow |
| `tor/tor-document.service.ts`, `gproc/*` | Relaying files from procurement portals | URLs only from stored TOR records, PDF/JPEG/PNG only, magic bytes checked, 40 MB cap, timeouts |
| `ai/*` | Sending TOR text and company data to Vertex AI | Off unless configured; admin-triggered extraction; drafts 5 per minute per client |
| `notifications/line-webhook.controller.ts` | Parsing LINE webhook bodies | Signature checked over the raw bytes before the body is used |

These run in the same process as the rest of the backend; sandboxing them (15.2.5) is not done.

## Secrets and rotation

(V13.1.4, V13.3.4)

The secrets, where each is held, and when and how each is rotated are in [limits-and-retention.md](../operations/limits-and-retention.md#secrets-and-rotation) (13.1.4 passes). Rotation is by hand: nothing expires by itself, and the app can't hold an old and a new session secret at once, so 13.3.4 is Not done.

---

## All Level 3 requirements

### V1 Encoding and Sanitization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.2.10 | Protection against CSV and formula injection when exporting spreadsheets | N/A | Nothing exports CSV or spreadsheet files |
| 1.3.12 | Regular expressions free from exponential backtracking; ReDoS mitigated | Partial | App patterns that see user input are linear (`escapeRegex` before every `$regex`, the LINE code and Slack URL patterns are anchored without nested quantifiers) and inputs have `@MaxLength`. Not every regex in the codebase and in `class-validator` has been audited |
| 1.5.3 | Different parsers of the same data type parse consistently | Partial | The LINE signature is checked over the same raw bytes Express parses; the sign-in `next` parameter is checked by one function (`safeNextPath`). Not reviewed across every URL and JSON parser |

### V2 Validation and Business Logic

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.3.5 | High-value flows need approval by more than one user | Pass | Granting or removing the admin role files a request (`PATCH /accounts/:id/details` answers 202) that a different admin must approve, behind step-up (`AdminApprovalsService`, `test/admin-approvals.e2e.test.mjs`). The requester can't approve their own request, only cancel it; a request is void if its requester stopped being an admin or the account's role moved; at most one is open per account, and it lapses after 48 h (TTL). The one exception: a lone admin may name the first extra admin directly, since no one else could approve. Admins can't be suspended at all (only companies and public viewers can). Deleting a TOR and suspending a company still take one admin: they are reversible or don't hand out power |
| 2.4.2 | Business flows require realistic human timing | **Not done** | Only rate limits; no minimum time between steps (e.g. signup form filled in under a second) |

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
| 3.7.3 | Notify the user before redirecting outside the application, with a way to cancel | **Not done** | Links to e-GP, MEA and LINE open directly |
| 3.7.4 | Top-level domain on the HSTS preload list | **Not done** | Needs `preload` in the HSTS header and a submission for the production domain, once every subdomain is HTTPS |
| 3.7.5 | Behaves as documented when the browser lacks a security feature | Partial | The documented behaviour is to allow without warning; there is no detection |

### V4 API and Web Service

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.4 | Only supported HTTP methods are accepted | Pass | Nest answers 404 and Next.js route handlers 405 to any method a route doesn't declare; TRACE is not implemented |
| 4.1.5 | Per-message signatures for highly sensitive requests | N/A | No such requests; the one machine-to-machine call in (LINE's webhook) is signed and checked |
| 4.2.2 | Generated `Content-Length` doesn't conflict with the framing | Pass | Lengths are set from buffers or stored sizes; the relayed portal document no longer forwards a compressed length for a decompressed body (this branch) |
| 4.2.3 | No HTTP/2 or HTTP/3 connection-specific header fields | Not reviewed | HTTP/2 ends at the hosting proxy; Node serves HTTP/1.1 |
| 4.2.4 | No CR/LF in HTTP/2 or HTTP/3 header fields | Not reviewed | Same; Node's HTTP/1.1 parser rejects CR/LF in header values |
| 4.2.5 | Outgoing URIs and headers are kept short enough for the receiver | Partial | Path ids are URL-encoded and validated; cookies are small. No explicit length check on the frontend → backend URLs |

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
| 6.3.5 | Users notified of suspicious authentication attempts | Partial | The wrong password that locks an account emails its owner, once per lock (`login-locked` notice, `auth.login.lockout` event; `AuthService.recordPasswordFailure`, `test/lockout-notice.test.mjs`). An unknown address locks the same way but sends nothing, and the mail is not awaited, so neither reveals which addresses exist. Gap: a successful sign-in from a new device or place is logged, not emailed |
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
| 8.2.4 | Adaptive controls on environmental attributes, at sign-in and during a session | **Not done** | Rate limits and lockout only; nothing reacts to location, device or time |
| 8.3.2 | Authorization changes apply immediately | Partial | Role change and suspension revoke every session; each backend process may keep accepting a revoked token for up to 30 s (revocation cache). One process today, so this is the whole delay |
| 8.3.3 | Access is based on the originating user's permissions, not an intermediary's | Pass | The frontend calls the backend with the user's own session token; there is no service account acting for users |
| 8.4.2 | Administrative interfaces have multiple layers of security | Partial | Admin role, a phishing-resistant passkey at sign-in, step-up for sensitive actions, and a second admin's approval to grant or remove the admin role. No device-posture or contextual risk checks |

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
| 11.1.3 | Cryptographic discovery finds every use of cryptography | **Not done** | The inventory in [asvs-l2.md](./asvs-l2.md#cryptography) is kept by hand; no discovery tool |
| 11.1.4 | Migration plan to new standards, including post-quantum | **Not done** | Not written. Exposure is low: HMAC and scrypt are symmetric; only TLS and Google's RS256 rely on public-key cryptography, both owned by others |
| 11.2.4 | Constant-time cryptographic operations | Pass | `timingSafeEqual` for session signatures, password hashes and LINE signatures; login now runs scrypt for unknown addresses too |
| 11.2.5 | Cryptographic modules fail securely | Pass | Any parse or verify error makes a token invalid; there is no decryption to leak padding errors |
| 11.3.4 | Nonces and IVs used once per key | N/A | No encryption |
| 11.3.5 | Encrypt-then-MAC | N/A | No encryption |
| 11.5.2 | Random generation works under heavy demand | Pass | Node's `crypto.randomBytes` / `randomInt` (OpenSSL CSPRNG), which doesn't block or degrade |
| 11.6.2 | Approved key exchange with secure parameters | N/A | No key exchange in the application; TLS is the proxy's |
| 11.7.1 | Full memory encryption for data in use | **Not done** | Depends on the host (e.g. confidential VMs); not in place |
| 11.7.2 | Data minimization during processing | Partial | Password hashes are projected out of every read and secrets are never logged; account documents are otherwise loaded whole |

### V12 Secure Communication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.4 | Certificate revocation (OCSP stapling) enabled | Not reviewed | Set by the hosting proxy |
| 12.1.5 | Encrypted Client Hello enabled | Not reviewed | Set by the hosting proxy and DNS |
| 12.3.5 | Strong mutual authentication between internal services | **Not done** | Frontend → backend is plain HTTP on the Docker network, authenticated only by the user's token; backend → MongoDB by password |

### V13 Configuration

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.1.2 | Documented maximum concurrent connections per service and behaviour at the limit | Pass | [Connections to other systems](../operations/limits-and-retention.md#connections-to-other-systems): MongoDB pool 50 with a 10 s wait, then a generic 500; per-portal concurrency; incoming rate limits |
| 13.1.3 | Documented resource management: timeouts, retries, back-off | Pass | [Timeouts, retries and back-off](../operations/limits-and-retention.md#timeouts-retries-and-back-off): every outbound call's timeout, retry count, back-off and budget |
| 13.1.4 | Critical secrets and their rotation schedule documented | Pass | [Secrets and rotation](../operations/limits-and-retention.md#secrets-and-rotation): each secret, where it is held, when and how it is rotated |
| 13.2.6 | Connections follow the documented configuration | Pass | The MongoDB client is built from the documented settings (`env.database`, `DatabaseService`); portal clients use the documented timeouts, retries and concurrency |
| 13.3.3 | Cryptographic operations in an isolated security module | **Not done** | Keys are in process memory |
| 13.3.4 | Secrets expire and are rotated as documented | **Not done** | No automatic expiry; rotation is manual |
| 13.4.6 | No detailed backend version information exposed | Pass | `poweredByHeader: false` (now also in the Docker image, which had left `next.config.ts` out of its final stage until 19 Nov), helmet removes `X-Powered-By`, `/health` returns status only, errors are generic |
| 13.4.7 | The web tier serves only expected file types | Partial | Next.js serves only its build output and `public/`, which is now empty (sample SVGs deleted on this branch); there is no explicit extension allowlist |

### V14 Data Protection

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.2.5 | Caches store only expected content; no web cache deception | Pass | No shared cache in front of the app; every API and page answer is `no-store` except immutable public documents, and unknown paths get 404 |
| 14.2.6 | Only the minimum sensitive data is returned | Partial | Hashes never leave the server; admin lists return full contact details |
| 14.2.7 | Sensitive data deleted on a retention schedule | Pass | [How long data is kept](../operations/limits-and-retention.md#how-long-data-is-kept): TTL indexes delete notifications (180 days), import runs (90), audit entries (365) and unconfirmed pending sign-ups (30); links expire on their own; container logs are capped at 5 × 10 MB. `DatabaseService.applyRetention`, `test/retention.e2e.test.mjs`. An account's own data is deleted by an admin on request (no self-service) |
| 14.2.8 | Metadata removed from user-submitted files | Partial | PNG and JPEG metadata removed on upload (this branch); PDF and Word metadata (author, software) is kept |

### V15 Secure Coding and Architecture

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.4 | Risky third-party components identified | Pass | [Risky components and dangerous functionality](#risky-components-and-dangerous-functionality) |
| 15.1.5 | Dangerous functionality identified | Pass | Same section |
| 15.2.4 | Dependencies come from the expected repository; no dependency confusion | Pass | Only public npm packages, no private or scoped internal names to impersonate; `npm ci` from lockfiles with integrity hashes; Dependabot with a cooldown |
| 15.2.5 | Extra protection (sandboxing, isolation) around dangerous functionality | **Not done** | Parsing and AI calls run in the main backend process |
| 15.4.1 | Thread-safe access to shared objects | Pass | Node.js runs request code on one thread; in-memory caches are only touched there |
| 15.4.2 | Check and action are atomic (no TOCTOU) | Partial | Certificate and library caps, link-code use and email uniqueness are atomic database operations; the saved-search cap counts first and then inserts, so two parallel requests can pass it by one |
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
| 3.4.3 | Per-response CSP with nonces or hashes | Pass | A fresh nonce per page request in `proxy.ts` |
| 6.3.3 | One factor is hardware-based and phishing-resistant (FIDO, passkey) | Partial | Staff use a passkey (WebAuthn, origin-bound, user presence required) after their password or Google; companies and public viewers have no second factor |
| 6.6.1 | No phone or SMS factor | N/A | None offered |
| 12.1.2 | Only forward-secret cipher suites | Not reviewed | Set by the hosting proxy |
| 13.3.1 | Secrets in a hardware-backed store (HSM) | **Not done** | Environment variables |
| 16.3.2 | Every authorization decision logged, including reads of sensitive data | **Not done** | Refusals are logged; allowed decisions are not |

## Suggested order for the rest

1. ~~**6.3.3 / 7.5.3:** passkeys for staff and step-up before admin actions~~ — done on `feat/staff-passkeys`, and step-up on owner assignment on `fix/step-up-tor-owner`. Left: a second factor for company accounts.
2. ~~**6.3.5, 6.4.6:** email on lockout; an admin "send reset link" action~~ — done on `feat/asvs-l3-lockout-reset`. Left: an email for a sign-in from a new device.
3. ~~**2.3.5, 8.4.2:** a second admin's approval to grant the admin role~~ — done on `feat/asvs-l3-admin-approval`, for removing it too.
4. ~~**14.2.7, 13.1.2–13.1.4, 13.3.4:** write the retention, connection and rotation policies the team agrees on~~ — done on `docs-asvs-l3-policies`. Left: 13.3.4, secrets that expire by themselves (a vault, and a session secret that can be rolled without signing everyone out).
5. **14.2.8 (documents), 15.2.5:** strip PDF/Word metadata and move file parsing into a worker with its own limits.
6. **16.3.2, 11.1.3, 12.3.5, 13.3.x:** need logging, network and hosting infrastructure beyond the repository.
