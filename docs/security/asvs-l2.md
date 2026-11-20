# ASVS 5.0 Level 2

Triage of TorFinder against all 183 [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/master/5.0/docs_en) Level 2 requirements, on top of Level 1 (see [asvs-l1.md](./asvs-l1.md), 0 Fail). Done on 17 Nov 2026 against `main` at `4d75e48`, plus PR #341 (SAST fixes) and PR #343 (the Level 2 fixes below), both in review. Like Level 1 this is a code read-through, not a pentest.

**Result: 112 Pass, 5 Partial, 5 Not done, 58 N/A, 3 not reviewed.** Of the 125 items that apply to TorFinder (excluding N/A), 112 pass (90%). The triage first found 82 Pass and 9 Planned; PR #343 fixed all 9 and closed the gap in V14.2.2.

**Update 19 Nov 2026 (branch `feat/asvs-l2-batch`):** nine items move to Pass. Announcement files are fetched only from the allowlisted portal hosts, and redirects are checked hop by hop (1.3.6, 13.2.4, 15.3.2; threat E3). Google sign-in is bound to the browser with a nonce (10.1.2, 10.5.1). Password hashes use stronger scrypt settings and store them, and old hashes are upgraded at sign-in (11.4.2, 11.2.2). The backend connects to MongoDB as a least-privilege account (13.2.2). Input refused by validation is logged (16.3.3).

**Update 19 Nov 2026 (staff passkeys, branch `feat/staff-passkeys`):** admin, owner and auditor accounts now finish every sign-in with a passkey ([passkeys.md](./passkeys.md)). 6.3.3 moves from Not done to Partial (companies and public viewers still have no second factor), and 6.4.3 and 6.4.4 now apply and pass.

**Update 18 Nov 2026:** company file uploads (certificates in #354, the proposal library in #355) made V1.3.4 apply. It passes, since SVG is not an accepted type. The File handling rules and V5.4.1 and V5.4.3 now cover uploads too. The threats these features add are in [threat-model.md](./threat-model.md).

**Re-check 19 Nov 2026** (branch `fix/asvs-l3-quick-wins`): the counts below still hold, but only after two corrections on this branch. **3.4.3** had been marked Pass with `base-uri 'self'`, while ASVS 5.0 sets the minimum at `base-uri 'none'`; both policies now send `'none'`. **13.1.1** said a user can never give the backend a URL to call, but a company can save a Slack incoming-webhook URL that the backend posts its alerts to; the [External communication](#external-communication) table now lists it, with the host pin that keeps it from being used for SSRF. The Level 3 review is in [asvs-l3.md](./asvs-l3.md).

## Summary

| Status | Count | Meaning |
| --- | --- | --- |
| Pass | 112 | Control exists, with evidence in code or in this file |
| Partial | 5 | Control exists with a gap; the gap is named |
| Not done | 5 | Not implemented; out of scope for this deadline (below) |
| N/A | 58 | The feature doesn't exist in TorFinder (no WebRTC, GraphQL, WebSockets, MFA codes, OAuth server…) |
| Not reviewed | 3 | Set by the hosting proxy, outside the repository |

| Chapter | L2 items | Pass | Partial | Not done | N/A | Not reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| V1 Encoding and Sanitization | 19 | 8 | 0 | 0 | 11 | 0 |
| V2 Validation and Business Logic | 7 | 5 | 1 | 0 | 1 | 0 |
| V3 Web Frontend Security | 11 | 10 | 0 | 0 | 1 | 0 |
| V4 API and Web Service | 8 | 1 | 0 | 0 | 5 | 2 |
| V5 File Handling | 5 | 4 | 0 | 1 | 0 | 0 |
| V6 Authentication | 22 | 11 | 1 | 0 | 10 | 0 |
| V7 Session Management | 12 | 12 | 0 | 0 | 0 | 0 |
| V8 Authorization | 3 | 3 | 0 | 0 | 0 | 0 |
| V9 Self-contained Tokens | 3 | 2 | 0 | 0 | 1 | 0 |
| V10 OAuth and OIDC | 24 | 6 | 0 | 0 | 18 | 0 |
| V11 Cryptography | 11 | 9 | 0 | 0 | 2 | 0 |
| V12 Secure Communication | 6 | 1 | 2 | 0 | 2 | 1 |
| V13 Configuration | 12 | 9 | 1 | 2 | 0 | 0 |
| V14 Data Protection | 7 | 7 | 0 | 0 | 0 | 0 |
| V15 Secure Coding and Architecture | 10 | 10 | 0 | 0 | 0 | 0 |
| V16 Security Logging and Error Handling | 16 | 14 | 0 | 2 | 0 | 0 |
| V17 WebRTC | 7 | 0 | 0 | 0 | 7 | 0 |
| **Total** | **183** | **112** | **5** | **5** | **58** | **3** |

## Fixed after the triage (PR #343)

The triage marked these as Planned; all are now implemented and tested:

| # | Fix | Closes |
| --- | --- | --- |
| 1 | Content-Security-Policy header on every response | V3.4.3 |
| 2 | 30-minute session inactivity timeout, with the 7-day absolute lifetime | V7.1.1, V7.3.1 |
| 3 | `Cache-Control: no-store` on API responses | V14.3.2, V14.2.2 |
| 4 | Context-specific password words (TorFinder, BMA, กรุงเทพ, role names…), used at signup, reset and change | V6.1.2, V6.2.11 |
| 5 | Reject `/\host` in the sign-in `next` parameter | V3.7.2 |
| 6 | Company profile: preferred budget minimum must not exceed the maximum | V2.2.3 |
| 7 | SBOM (CycloneDX via `npm sbom`) for backend and frontend | V15.1.2 |

## Not done (out of scope for this deadline)

| ID | Gap | Why not now |
| --- | --- | --- |
| V5.4.3 | Relayed portal files are not virus-scanned | Needs a scanning service; files are limited to PDF/JPEG/PNG with magic-byte checks |
| V13.2.5 | No network-level egress allowlist | Set at the host or firewall, not in the app |
| V13.3.1 | No secrets vault | Environment variables are the accepted setup for the course deployment |
| V16.4.2 | Logs are not write-once | Needs log storage outside the host |
| V16.4.3 | Logs are not shipped to a separate system | Same |

---

## Authentication pathways

(V6.1.3, V6.3.4)

| Pathway | Who | Proof | Then |
| --- | --- | --- | --- |
| Email + password (`POST /auth/login`) | Organizations, staff | scrypt-hashed password; email must be verified | Per-IP and per-email rate limits; account must be approved and not suspended. Staff with a passkey then get a challenge instead of a session |
| Google sign-in (`POST /auth/google`, `/auth/google/complete`) | Public viewers, organizations | Google ID token: signature, audience, expiry, `email_verified` | Same approval and suspension checks |

Both end in `AuthService.issueSession`, which applies the same status checks and issues the same session token. For a staff account with a passkey, both stop there with a passkey challenge, and the session is issued only by `POST /auth/passkey/login` once the passkey signs it (status checks run again). So a staff member can't skip the passkey by choosing Google; see [passkeys.md](./passkeys.md).

**New passwords** (signup, reset, change) must be 8–128 characters and must not be one of the 10,000 most common breached passwords, or be built mostly on a **context-specific word**: `torfinder`, `torr`, `bma`, `bangkok`, `krungthep`, `กรุงเทพ`, `กรุงเทพมหานคร`, `กทม`, `egp`, `procurement`, `จัดซื้อจัดจ้าง`, `admin`, `administrator`, `auditor`, `owner`, `viewer`, `organization`, or the account's own email name, email domain or company-name words. "Built mostly on" means fewer than 8 other letters or digits remain once the word is removed, so `TorFinder2026!` is refused but a long passphrase containing `bangkok` is not. Password reset and email verification use single-use, hashed, expiring links; they never create a session by themselves. There are no other ways in.

## Sessions

(V7.1.1, V7.1.2, V7.1.3, V7.6.1)

- **Lifetime:** a session ends after **30 minutes without activity** (`SESSION_IDLE_MINUTES`) and **7 days after sign-in** whatever the activity. NIST SP 800-63B suggests 30 minutes of inactivity for AAL2; we follow it.
- **How:** each token carries `act`, its last activity. While the user keeps using the site, `proxy.ts` re-signs the token with a fresh `act` at most every 5 minutes, keeping `iat` (for revocation) and `exp` (the absolute limit). Backend and frontend both refuse an idle token.
- **Concurrency:** any number of sessions per account (several devices are normal). Logout, password change or reset, suspension and role change end **all** of them at once.
- **Seeing and ending sessions:** each sign-in is a row in `sessions`, named by the token's `sid`. An account sees its sessions on `/account` and ends one or all others after giving its password again (7.5.2). An admin ends one account's sessions, or every account's, from Manage Users (7.4.5).
- **Google:** Google is used only to prove identity at sign-in. The TorFinder session is independent of the Google session: signing out of Google doesn't end it, and logging out of TorFinder doesn't sign you out of Google.

## Business rules and limits

(V2.1.2, V2.1.3)

| Rule | Scope | Enforced by |
| --- | --- | --- |
| Company name and tax id can be set once, then are locked | Per account | `accounts.service.ts` |
| Preferred budget minimum ≤ maximum | Per account | `accounts.service.ts` and the profile page |
| Organizations must be approved by an admin before signing in | Per account | `issueSession` |
| Feedback only during a TOR's comment window | Per TOR | `feedback.service.ts` |
| Saved searches per account are capped | Per account | `saved-searches.service.ts` |
| Rate limits, per-email lockout, AI call limits | Per client / per email | See [asvs-l1.md, Rate limits](./asvs-l1.md) |
| The last admin can't be demoted | Global | `accounts.service.ts` |

## File handling

(V5.1.1)

TorFinder handles files from two sources: documents that procurement portals publish, which it relays, and files a company uploads with its own records (certificate scans in #354; CVs, reference letters and past-project files in the proposal library, #355).

**Relayed portal documents:**

| | Rule |
| --- | --- |
| Types | PDF, JPEG, PNG only; the extension and the first bytes must both match |
| Size | 40 MB per file and per zip archive; each zip entry's declared size is checked before it is inflated |
| Serving | `Content-Disposition` with an RFC 6266 file name, `X-Content-Type-Options: nosniff`; other types are refused |
| Source | Only URLs stored on a TOR record, fetched server-side |

**Company uploads** (`backend/src/common/stored-files.ts`):

| | Rule |
| --- | --- |
| Types | Certificates: PDF, PNG, JPEG. Library: the same plus Word `.docx`. The type comes from the file's bytes, never from its name or the browser's `Content-Type`; a `.docx` must be a ZIP that contains `[Content_Types].xml` and `word/document.xml` |
| Size | 5 MB per file; 1 file and no other fields per request (multer limits); 100 certificates and 200 library records per company |
| Name | Reduced to a display name with the extension of its real type (`safeFileName`); never used as a path |
| Storage | MongoDB GridFS, never the file system or a public folder |
| Serving | Owner's company only (`OrgGuard`, ownership checked per record); always `Content-Disposition: attachment`, `nosniff`, `Cache-Control: no-store` |
| Generated | The proposal starter pack is a ZIP built by the server from the company's own files; it stops adding files past 60 MB and says which it left out |

## Field-level access

(V8.1.2)

| Data | Read | Write |
| --- | --- | --- |
| Password hash and salt | Never returned by any API | Only signup, reset, change |
| Role, status, suspended | Admins | Admins only (`PATCH /accounts/:id`); never through `/accounts/me` |
| Email | The account itself, admins | Nobody (fixed at signup) |
| Company name, tax id | The account, admins | The account once, then locked; admins |
| Other company profile fields | The account, admins | The account |
| Feedback | Approved: everyone; pending or rejected: admins | Anyone creates; admins moderate |

## External communication

(V13.1.1)

| Direction | Service | Why |
| --- | --- | --- |
| Browser → frontend | Next.js (HTTPS via the host proxy) | The only public entry point |
| Frontend → backend | NestJS, Docker network | Every API call |
| Backend → MongoDB | Docker network (or Atlas over TLS) | Storage |
| Backend → e-GP, MEA, data.go.th, national e-GP | HTTPS | Scheduled imports and document relay |
| Backend → Google | HTTPS | ID-token verification keys; Vertex AI when enabled |
| Backend → Resend, LINE | HTTPS | Email and LINE notifications, when keys are set |
| Backend → a company's Slack webhook | HTTPS | Match alerts, when the company saved a webhook URL **(user-supplied)** |
| LINE → frontend → backend | HTTPS | `POST /api/line/webhook`, signed by LINE, links a LINE account to a TorFinder account |
| Browser → Google | HTTPS | The Google sign-in button script |

The one destination a user supplies is a Slack incoming-webhook URL in their notification settings. It must match `^https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+$` (`notifications/notification-delivery.ts` `SLACK_WEBHOOK`, checked by the DTO before it is saved), so the backend can only ever post to Slack's own host over HTTPS, with an 8-second timeout. Document URLs come only from imported or admin-entered TOR records; no other user input becomes a URL the backend calls.

## Cryptography

(V11.1.1, V11.1.2)

| What | Algorithm | Key or parameter |
| --- | --- | --- |
| Password storage | scrypt, 16-byte random salt | Node defaults (N = 16384); raising it is a Partial item |
| Session tokens | HMAC-SHA256 | `SESSION_SECRET`, ≥ 32 random characters, production refuses weak or default values |
| Email-link tokens | 32 random bytes, stored as SHA-256 | Single use, 1 h (reset) or 24 h (verify) |
| Google ID tokens | RS256, verified by `google-auth-library` | Google's published keys |
| Transport | TLS | Set by the hosting proxy |

**Key handling:** `SESSION_SECRET` is generated with `openssl rand -base64 32`, stored only in the server's environment or `.env` (never committed; the git history was scanned), and rotated by changing it and restarting both services, which signs everyone out. It must be rotated if it is ever exposed. The full policy, for every key and credential, is [key-management.md](../operations/key-management.md).

## Data protection

(V14.1.1, V14.1.2)

| Class | Examples | Requirements |
| --- | --- | --- |
| Secret | Password hashes, `SESSION_SECRET`, session tokens, reset links | Never logged or returned; tokens only in httpOnly cookies; hashes projected out of every API |
| Personal | Email, contact name, phone, company profile | Only the account and admins can read it; emails may appear in security logs |
| Moderation | Pending or rejected feedback, problem reports, audit log | Admins only |
| Public | TOR records and their documents | Anyone can read; integrity matters more than secrecy |

## Resource-heavy functions

(V15.1.3)

| Function | Cost | Defence |
| --- | --- | --- |
| Portal imports | Many requests to external portals | Admin-only trigger, scheduled runs, page caps, wall-clock budget, retries with backoff |
| AI extraction and proposal drafts | Paid Vertex AI calls | Off unless configured, not on startup by default, 5 drafts/min per client |
| "Find similar" | Embedding call per query | 30/min per client, text capped at 5,000 characters |
| Document relay | Large downloads | 40 MB cap, streamed, timeouts, cancelled when the reader leaves |

## Logging

(V16.1.1)

Security events and errors are described in [logging-and-errors.md](./logging-and-errors.md). They are written to stdout as JSON lines, kept by the container runtime on the host (`docker compose logs backend`), readable by whoever administers the host, and kept as long as the container log is. Admin actions are also stored in the `auditLogEntries` collection and shown at `/admin/audit`.

---

## All Level 2 requirements

### V1 Encoding and Sanitization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.1.1 | Input is decoded or unescaped into a canonical form only once, it is only decoded when encoded data in that form is… | Pass | Nest and Express decode the body, query and path once, before the ValidationPipe checks them |
| 1.1.2 | The application performs output encoding and escaping either as a final step before being used by the interpreter… | Pass | React escapes at render time; Nest serializes JSON as the response is sent |
| 1.2.6 | The application protects against LDAP injection vulnerabilities, or that specific security controls to prevent LDAP… | N/A | No LDAP |
| 1.2.7 | The application is protected against XPath injection attacks by using query parameterization or precompiled queries | N/A | No XPath |
| 1.2.8 | LaTeX processors are configured securely (such as not using the "--shell-escape" flag) and an allowlist of commands… | N/A | No LaTeX |
| 1.2.9 | The application escapes special characters in regular expressions (typically using a backslash) to prevent them from… | Pass | `common/regex.ts` `escapeRegex` before every `$regex`; `work-types.ts` uses it too (PR #341) |
| 1.3.3 | Data being passed to a potentially dangerous context is sanitized beforehand to enforce safety measures, such as… | Pass | `@MaxLength` on every text field; "find similar" text is cut to 5,000 characters before it is sent for embedding |
| 1.3.4 | User-supplied Scalable Vector Graphics (SVG) scriptable content is validated or sanitized to contain only tags and… | Pass | SVG is never accepted: uploads are typed by their bytes and limited to PDF, PNG, JPEG and Word (`common/stored-files.ts` `sniffFileType`); relayed portal files to PDF, JPEG and PNG (#354, #355) |
| 1.3.5 | The application sanitizes or disables user-supplied scriptable or expression template language content, such as… | N/A | No user-supplied Markdown, templates or stylesheets; feedback is shown as plain text |
| 1.3.6 | The application protects against Server-side Request Forgery (SSRF) attacks, by validating untrusted data against an… | Pass | Announcement files are fetched only from an allowlist of portal hosts (`egp2.bangkok.go.th`, `procurement.mea.or.th`), over HTTPS, on the default port, with no credentials in the URL (`common/portal-fetch.ts`); every other stored link is shown to the reader as a plain link but never fetched. The one user-supplied URL, a Slack webhook, is pinned to `hooks.slack.com`. Threat E3 closed; `test/portal-fetch.test.mjs` |
| 1.3.7 | The application protects against template injection attacks by not allowing templates to be built based on untrusted… | N/A | No server-side templates built from input |
| 1.3.8 | The application appropriately sanitizes untrusted input before use in Java Naming and Directory Interface (JNDI)… | N/A | No JNDI |
| 1.3.9 | The application sanitizes content before it is sent to memcache to prevent injection attacks | N/A | No memcache |
| 1.3.10 | Format strings which might resolve in an unexpected or malicious way when used are sanitized before being processed | N/A | No printf-style format strings take user input |
| 1.3.11 | The application sanitizes user input before passing to mail systems to protect against SMTP or IMAP injection | Pass | Email goes through Resend's HTTP API, not SMTP; the recipient is validated with `@IsEmail`, subjects are fixed and the body is HTML-escaped |
| 1.4.1 | The application uses memory-safe string, safer memory copy and pointer arithmetic to detect or prevent stack,… | N/A | Memory-safe runtime (Node.js), no native code |
| 1.4.2 | Sign, range, and input validation techniques are used to prevent integer overflows | N/A | Memory-safe runtime; numeric inputs have `@Min`/`@Max` bounds |
| 1.4.3 | Dynamically allocated memory and resources are released, and that references or pointers to freed memory are removed… | N/A | Memory-safe runtime (garbage collected) |
| 1.5.2 | Deserialization of untrusted data enforces safe input handling, such as using an allowlist of object types or… | Pass | Only `JSON.parse` of plain data; no typed object deserialization |

### V2 Validation and Business Logic

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.1.2 | The application's documentation defines how to validate the logical and contextual consistency of combined data… | Pass | Combined-data rules are written in [Business rules and limits](#business-rules-and-limits) |
| 2.1.3 | Expectations for business logic limits and validations are documented, including both per-user and globally across… | Pass | Per-user and global limits are written in [Business rules and limits](#business-rules-and-limits) |
| 2.2.3 | The application ensures that combinations of related data items are reasonable according to the pre-defined rules | Pass | The preferred budget minimum can't exceed the maximum: checked in `accounts.service.ts` (against the stored value too) and on the profile page (PR #343) |
| 2.3.2 | Business logic limits are implemented per the application's documentation to avoid business logic flaws being exploited | Pass | Limits are enforced as documented: rate limits, per-email lockout, saved-search cap, page-size caps |
| 2.3.3 | Transactions are being used at the business logic level such that either a business logic operation succeeds in its… | Partial | Multi-step writes (e.g. role change, then session revocation, then audit entry) don't use MongoDB transactions; the last-admin guard compensates for its own case |
| 2.3.4 | Business logic level locking mechanisms are used to ensure that limited quantity resources (such as theater seats or… | N/A | No limited-quantity resources to double-book |
| 2.4.1 | Anti-automation controls are in place to protect against excessive calls to application functions that could lead to… | Pass | Global, per-route and per-email rate limits; costly AI calls 5/min; the public LINE webhook 300/min per client IP; see `asvs-l1.md` |

### V3 Web Frontend Security

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.3.2 | Each cookie's 'SameSite' attribute value is set according to the purpose of the cookie, to limit exposure to user… | Pass | `SameSite=Lax` on the session cookie: blocks cross-site POSTs, still allows arriving from an email link |
| 3.3.3 | Cookies have the '__Host-' prefix for the cookie name unless they are explicitly designed to be shared with other hosts | Pass | Every cookie has the prefix in production: `__Host-torr_session`, `__Host-torr_locale` (`frontend/src/i18n/config.ts`) and `__Host-torr_signup_email` (`frontend/src/lib/signup-email.ts`, now `Path=/` as the prefix requires). Dev keeps plain names, because some browsers refuse Secure cookies over http://localhost |
| 3.3.4 | If the value of a cookie is not meant to be accessible to client-side scripts (such as a session token), the cookie… | Pass | The session cookie is `HttpOnly` and only ever sent in `Set-Cookie`; the frontend never returns the token in a body |
| 3.4.3 | HTTP responses include a Content-Security-Policy response header field which defines directives to ensure the… | Pass | Strict CSP on every page from `proxy.ts`: per-request nonce, `'strict-dynamic'`, only Google sign-in added to `'self'`, `object-src 'none'`, `base-uri 'none'` (PR #343; `base-uri` tightened from `'self'` on 19 Nov). Static files get the same minimum from `next.config.ts` |
| 3.4.4 | All HTTP responses contain an 'X-Content-Type-Options: nosniff' header field | Pass | `nosniff` on every frontend response (`next.config.ts`) and backend response (helmet) |
| 3.4.5 | The application sets a referrer policy to prevent leakage of technically sensitive data to third-party services via… | Pass | `Referrer-Policy: strict-origin-when-cross-origin` |
| 3.4.6 | The web application uses the frame-ancestors directive of the Content-Security-Policy header field for every HTTP… | Pass | `Content-Security-Policy: frame-ancestors 'self'` on every response |
| 3.5.4 | Separate applications are hosted on different hostnames to leverage the restrictions provided by same-origin policy,… | Pass | One application on one origin; the backend is not exposed |
| 3.5.5 | Messages received by the postMessage interface are discarded if the origin of the message is not trusted, or if the… | N/A | Our code doesn't use `postMessage` |
| 3.7.1 | The application only uses client-side technologies which are still supported and considered secure | Pass | Only current web technology (React 19, Next.js 16); no plugins |
| 3.7.2 | The application will only automatically redirect the user to a different hostname or domain (which is not controlled… | Pass | `safeNextPath()` allows only a same-site path for `next`; `//host`, `/\host` and control characters fall back (PR #343) |

### V4 API and Web Service

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.2 | Only user-facing endpoints (intended for manual web-browser access) automatically redirect from HTTP to HTTPS, while… | Not reviewed | HTTP→HTTPS redirect is done by the hosting proxy, outside the repo |
| 4.1.3 | Any HTTP header field used by the application and set by an intermediary layer, such as a load balancer, a web… | Pass | Next.js keeps a client-sent `X-Forwarded-For` when reached directly (`??=` in `next/dist/server/base-server.js`), so it never is: compose binds it to 127.0.0.1, and the deployment checklist requires the reverse proxy to append the address it saw. The frontend forwards only that right-most entry (`frontend/src/lib/client-ip.ts`), and the backend trusts it only from loopback or private hops (`TRUST_PROXY`) |
| 4.2.1 | All application components (including load balancers, firewalls, and application servers) determine boundaries of… | Not reviewed | Message framing is up to the hosting proxy; Node's own parser rejects conflicting `Content-Length`/`Transfer-Encoding` |
| 4.3.1 | A query allowlist, depth limiting, amount limiting, or query cost analysis is used to prevent GraphQL or data layer… | N/A | No GraphQL |
| 4.3.2 | GraphQL introspection queries are disabled in the production environment unless the GraphQL API is meant to be used… | N/A | No GraphQL |
| 4.4.2 | Verify that, during the initial HTTP WebSocket handshake, the Origin header field is checked against a list of… | N/A | No WebSockets |
| 4.4.3 | Verify that, if the application's standard session management cannot be used, dedicated tokens are being used for… | N/A | No WebSockets |
| 4.4.4 | Dedicated WebSocket session management tokens are initially obtained or validated through the previously… | N/A | No WebSockets |

### V5 File Handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 5.1.1 | The documentation defines the permitted file types, expected file extensions, and maximum size (including unpacked… | Pass | File handling is written in [File handling](#file-handling) |
| 5.2.3 | The application checks compressed files (e.g., zip, gz, docx, odt) against maximum allowed uncompressed size and… | Pass | Each zip entry's declared size is checked before inflating, inflation is capped at that size, archives are ≤ 40 MB and only one entry is inflated per request |
| 5.4.1 | The application validates or ignores user-submitted filenames, including in a JSON, JSONP, or URL parameter and… | Pass | An uploaded file's name is reduced to a display name: no path, no control characters or quotes, at most 120 characters, and the extension of its real type (`safeFileName`). It is never used as a storage path (GridFS ids are), and every file response sets `Content-Disposition` |
| 5.4.2 | File names served (e.g., in HTTP response header fields or email attachments) are encoded or sanitized (e.g.,… | Pass | `filename*=UTF-8''` + `encodeURIComponent` (RFC 6266 / 5987) |
| 5.4.3 | Files obtained from untrusted sources are scanned by antivirus scanners to prevent serving of known malicious content | **Not done** | Neither portal files nor company uploads are virus-scanned. Both are limited by type with magic-byte checks and served with `nosniff`; uploads are always attachments, and only their owner's company can download them (accepted risk) |

### V6 Authentication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 6.1.2 | A list of context-specific words is documented in order to prevent their use in passwords | Pass | The context-specific word list is in [Authentication pathways](#authentication-pathways) and `common/password.ts` `CONTEXT_WORDS` (PR #343) |
| 6.1.3 | Verify that, if the application includes multiple authentication pathways, these are all documented together with… | Pass | Both sign-in pathways are written in [Authentication pathways](#authentication-pathways) |
| 6.2.9 | Passwords of at least 64 characters are permitted | Pass | Passwords up to 128 characters |
| 6.2.10 | A user's password stays valid until it is discovered to be compromised or the user rotates it | Pass | No forced periodic password change |
| 6.2.11 | The documented list of context specific words is used to prevent easy to guess passwords being created | Pass | `passwordProblem()` refuses passwords built on those words or the account's own email or company name, at signup, reset and change (PR #343) |
| 6.2.12 | Passwords submitted during account registration or password changes are checked against a set of breached passwords | Pass | Checked against the 10,000 most common breached passwords (NCSC / Have I Been Pwned list) on signup, reset and change |
| 6.3.3 | Either a multi-factor authentication mechanism or a combination of single-factor authentication mechanisms, must be… | Partial | Staff (admin, owner, auditor) must add a passkey and use it after their password or Google sign-in ([passkeys.md](./passkeys.md)). Companies and public viewers have no second factor of their own; Google accounts carry Google's. Email verification is not a second factor |
| 6.3.4 | Verify that, if the application includes multiple authentication pathways, there are no undocumented pathways and… | Pass | Only the two documented pathways exist, and both end in the same `issueSession` checks |
| 6.4.3 | A secure process for resetting a forgotten password is implemented, that does not bypass any enabled multi-factor… | Pass | A reset sets the password only: a staff account still needs its passkey at the next sign-in. The reset link needs the inbox, is single use, and ends every session |
| 6.4.4 | If a multi-factor authentication factor is lost, evidence of identity proofing is performed at the same level as… | Pass | A lost passkey is cleared by another admin, who must pass a passkey check first; the owner is emailed, every session ends, and they add a new passkey after signing in with their password, the same proof as the first time |
| 6.5.1 | Lookup secrets, out-of-band authentication requests or codes, and time-based one-time passwords (TOTPs) are only… | N/A | No OTP, lookup secrets or out-of-band authentication codes (the emailed reset links are still single-use, hashed and random) |
| 6.5.2 | Verify that, when being stored in the application's backend, lookup secrets with less than 112 bits of entropy (19… | N/A | No lookup secrets |
| 6.5.3 | Lookup secrets, out-of-band authentication code, and time-based one-time password seeds, are generated using a… | N/A | No OTP or lookup secrets |
| 6.5.4 | Lookup secrets and out-of-band authentication codes have a minimum of 20 bits of entropy (typically 4 random… | N/A | No OTP or lookup secrets |
| 6.5.5 | Out-of-band authentication requests, codes, or tokens, as well as time-based one-time passwords (TOTPs) have a… | N/A | No out-of-band authentication or TOTP |
| 6.6.1 | Authentication mechanisms using the Public Switched Telephone Network (PSTN) to deliver One-time Passwords (OTPs)… | N/A | No SMS or phone OTP |
| 6.6.2 | Out-of-band authentication requests, codes, or tokens are bound to the original authentication request for which… | N/A | No out-of-band authentication |
| 6.6.3 | A code based out-of-band authentication mechanism is protected against brute force attacks by using rate limiting | N/A | No out-of-band authentication codes |
| 6.8.1 | Verify that, if the application supports multiple identity providers (IdPs), the user's identity cannot be spoofed… | Pass | A Google identity is keyed by its `sub` (`googleId`); it links to an existing account only when Google says the email is verified |
| 6.8.2 | The presence and integrity of digital signatures on authentication assertions (for example on JWTs or SAML… | Pass | `google-auth-library` `verifyIdToken` checks the signature, issuer, audience and expiry |
| 6.8.3 | SAML assertions are uniquely processed and used only once within the validity period to prevent replay attacks | N/A | No SAML |
| 6.8.4 | Verify that, if an application uses a separate Identity Provider (IdP) and expects specific authentication strength,… | N/A | No function requires a particular Google authentication strength |

### V7 Session Management

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.1.1 | The user's session inactivity timeout and absolute maximum session lifetime are documented, are appropriate in… | Pass | 30-minute inactivity timeout and 7-day absolute lifetime, written in [Sessions](#sessions) (PR #343) |
| 7.1.2 | The documentation defines how many concurrent (parallel) sessions are allowed for one account as well as the… | Pass | Concurrent sessions are written in [Sessions](#sessions) |
| 7.1.3 | All systems that create and manage user sessions as part of a federated identity management ecosystem (such as SSO… | Pass | Written in [Sessions](#sessions): Google is used only at sign-in, the TorFinder session is independent |
| 7.3.1 | There is an inactivity timeout such that re-authentication is enforced according to risk analysis and documented… | Pass | Tokens carry `act`; backend and frontend refuse a token idle more than 30 minutes; `proxy.ts` keeps an active session alive (PR #343) |
| 7.3.2 | There is an absolute maximum session lifetime such that re-authentication is enforced according to risk analysis and… | Pass | Tokens expire 7 days after sign-in (`exp`), checked by backend and frontend |
| 7.4.3 | The application gives the option to terminate all other active sessions after a successful change or removal of any… | Pass | A password change or reset ends every session automatically |
| 7.4.4 | All pages that require authentication have easy and visible access to logout functionality | Pass | Sign out is in the sidebar and the navbar on every signed-in page |
| 7.4.5 | Application administrators are able to terminate active sessions for an individual user or for all users | Pass | Manage Users has "Sign out" on every account and "Sign out everyone" (`POST /accounts/:id/sessions/end`, `POST /accounts/sessions/end-all`), each behind a passkey step-up, written to the audit log and logged as `admin.sessions.revoke`. Tested in `backend/test/sessions.e2e.test.mjs` |
| 7.5.1 | The application requires full re-authentication before allowing modifications to sensitive account attributes which… | Pass | The email address can't be changed; a password change needs the current password; adding a second passkey or removing one needs a passkey check from the last 10 minutes |
| 7.5.2 | Users are able to view and (having authenticated again with at least one factor) terminate any or all currently… | Pass | Each sign-in is recorded in a `sessions` collection, and its id (`sid`) is in the token. `/account` lists the account's sessions (browser, address, time; this one marked) and ends one or all others after the current password, or for a Google-only account a sign-in in the last 10 minutes. Every request checks the session is still open. Tested in `backend/test/sessions.e2e.test.mjs` |
| 7.6.1 | Session lifetime and termination between Relying Parties (RPs) and Identity Providers (IdPs) behave as documented,… | Pass | Written in [Sessions](#sessions) |
| 7.6.2 | Creation of a session requires either the user's consent or an explicit action, preventing the creation of new… | Pass | Google sign-in starts only from a click on the button (no One Tap, no auto-select) |

### V8 Authorization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1.2 | Authorization documentation defines rules for field-level access restrictions (both read and write) based on… | Pass | Field-level rules are written in [Field-level access](#field-level-access) |
| 8.2.3 | The application ensures that field-level access is restricted to consumers with explicit permissions to specific… | Pass | A DTO whitelist per route; `PATCH /accounts/me` can't set role, status or email; company name and tax id are write-once; hashes are projected out |
| 8.4.1 | Multi-tenant applications use cross-tenant controls to ensure consumer operations will never affect tenants with… | Pass | Each organization only reaches data filtered on its own account id |

### V9 Self-contained Tokens

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 9.2.2 | The service receiving a token validates the token to be the correct type and is meant for the intended purpose… | Pass | Session tokens, email-link tokens and Google ID tokens have different formats and uses; none is accepted in another's place |
| 9.2.3 | The service only accepts tokens which are intended for use with that service (audience) | Pass | One service; the HMAC key exists only in this deployment's frontend and backend; Google tokens are checked for our audience |
| 9.2.4 | Verify that, if a token issuer uses the same private key for issuing tokens to different audiences, the issued… | N/A | We issue tokens for one audience only |

### V10 OAuth and OIDC

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 10.1.1 | Tokens are only sent to components that strictly need them | Pass | The session token lives in an httpOnly cookie and goes only to the backend; the Google ID token is used once at sign-in |
| 10.1.2 | The client only accepts values from the authorization server (such as the authorization code or ID Token) if these… | Pass | Google sign-in carries a nonce: the frontend issues 32 random bytes per sign-in page, keeps them in an HttpOnly `__Host-` cookie and passes them to Google; the backend refuses a token whose `nonce` claim differs (`auth/google-claims.ts`, `test/google-claims.test.mjs`) |
| 10.2.1 | Verify that, if the code flow is used, the OAuth client has protection against browser-based request forgery… | N/A | No authorization-code flow (Google Identity Services ID-token flow) |
| 10.2.2 | Verify that, if the OAuth client can interact with more than one authorization server, it has a defense against… | N/A | One identity provider |
| 10.3.1 | The resource server only accepts access tokens that are intended for use with that service (audience) | N/A | Not an OAuth resource server |
| 10.3.2 | The resource server enforces authorization decisions based on claims from the access token that define delegated… | N/A | Not an OAuth resource server |
| 10.3.3 | If an access control decision requires identifying a unique user from an access token (JWT or related token… | N/A | Not an OAuth resource server |
| 10.3.4 | Verify that, if the resource server requires specific authentication strength, methods, or recentness, it verifies… | N/A | Not an OAuth resource server |
| 10.4.6 | Verify that, if the code grant is used, the authorization server mitigates authorization code interception attacks… | N/A | Not an authorization server |
| 10.4.7 | If the authorization server supports unauthenticated dynamic client registration, it mitigates the risk of malicious… | N/A | Not an authorization server |
| 10.4.8 | Refresh tokens have an absolute expiration, including if sliding refresh token expiration is applied | N/A | Not an authorization server |
| 10.4.9 | Refresh tokens and reference access tokens can be revoked by an authorized user using the authorization server user… | N/A | Not an authorization server |
| 10.4.10 | Confidential client is authenticated for client-to-authorized server backchannel requests such as token requests,… | N/A | Not an authorization server |
| 10.4.11 | The authorization server configuration only assigns the required scopes to the OAuth client | N/A | Not an authorization server |
| 10.5.1 | The client (as the relying party) mitigates ID Token replay attacks | Pass | The ID token's `nonce` must match this browser's cookie (as V10.1.2), so a token captured elsewhere can't be replayed here; the token's 1-hour expiry still applies |
| 10.5.2 | The client uniquely identifies the user from ID Token claims, usually the 'sub' claim, which cannot be reassigned to… | Pass | Users are identified by the ID token's `sub` |
| 10.5.3 | The client rejects attempts by a malicious authorization server to impersonate another authorization server through… | Pass | `google-auth-library` uses Google's fixed endpoints and checks the issuer |
| 10.5.4 | The client validates that the ID Token is intended to be used for that client (audience) by checking that the 'aud'… | Pass | `aud` must equal our `GOOGLE_CLIENT_ID` |
| 10.5.5 | Verify that, when using OIDC back-channel logout, the relying party mitigates denial of service through forced… | N/A | No OIDC back-channel logout |
| 10.6.1 | The OpenID Provider only allows values 'code', 'ciba', 'id_token', or 'id_token code' for response mode | N/A | Not an OpenID Provider |
| 10.6.2 | The OpenID Provider mitigates denial of service through forced logout | N/A | Not an OpenID Provider |
| 10.7.1 | The authorization server ensures that the user consents to each authorization request | N/A | Not an authorization server |
| 10.7.2 | When the authorization server prompts for user consent, it presents sufficient and clear information about what is… | N/A | Not an authorization server |
| 10.7.3 | The user can review, modify, and revoke consents which the user has granted through the authorization server | N/A | Not an authorization server |

### V11 Cryptography

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.1.1 | There is a documented policy for management of cryptographic keys and a cryptographic key lifecycle that follows a… | Pass | [key-management.md](../operations/key-management.md): roles, every key with its purpose, source, storage and cryptoperiod, and the SP 800-57 lifecycle from generation to destruction, including compromise |
| 11.1.2 | A cryptographic inventory is performed, maintained, regularly updated, and includes all cryptographic keys,… | Pass | Crypto inventory in [Cryptography](#cryptography) |
| 11.2.1 | Industry-validated implementations (including libraries and hardware-accelerated implementations) are used for… | Pass | Node.js `crypto` (OpenSSL) and `google-auth-library` only; no home-made crypto |
| 11.2.2 | The application is designed with crypto agility such that random number, authenticated encryption, MAC, or hashing… | Pass | Each password hash stores the algorithm and settings it was made with (`passwordParams`); a hash is checked with its own settings and redone with the current ones at the owner's next sign-in, so settings change without a migration (`common/password.ts`) |
| 11.2.3 | All cryptographic primitives utilize a minimum of 128-bits of security based on the algorithm, key size, and… | Pass | HMAC-SHA256 with a ≥ 32-character random key; 32-byte random link tokens |
| 11.3.3 | Encrypted data is protected against unauthorized modification preferably by using an approved authenticated… | N/A | No encryption in the application |
| 11.4.2 | Passwords are stored using an approved, computationally intensive, key derivation function (also known as a… | Pass | scrypt with N = 2^14, r = 8, p = 5, one of OWASP's listed equivalents of the N = 2^17 minimum at 16 MiB per hash; older hashes (p = 1) are upgraded at the next correct sign-in (`test/password-rehash.e2e.test.mjs`) |
| 11.4.3 | Hash functions used in digital signatures, as part of data authentication or data integrity are collision resistant… | Pass | SHA-256 for link-token hashes, HMAC-SHA256 for sessions; SHA-1 only as a non-security cache key |
| 11.4.4 | The application uses approved key derivation functions with key stretching parameters when deriving secret keys from… | N/A | No keys derived from passwords |
| 11.5.1 | All random numbers and strings which are intended to be non-guessable must be generated using a cryptographically… | Pass | `randomBytes(32)` for link tokens and salts; the errorId UUID is not a secret |
| 11.6.1 | Only approved cryptographic algorithms and modes of operation are used for key generation and seeding, and digital… | Pass | HMAC-SHA256 signing; Google's RS256 signatures verified by the library |

### V12 Secure Communication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.2 | Only recommended cipher suites are enabled, with the strongest cipher suites set as preferred | Not reviewed | Cipher suites are set by the hosting proxy |
| 12.1.3 | The application validates that mTLS client certificates are trusted before using the certificate identity for… | N/A | No mTLS |
| 12.3.1 | An encrypted protocol such as TLS is used for all inbound and outbound connections to and from the application,… | Partial | Outbound calls (portals, Google, Resend, Vertex) use HTTPS; MongoDB in the Docker network has no TLS (Atlas would) |
| 12.3.2 | TLS clients validate certificates received before communicating with a TLS server | Pass | Node's `fetch` validates certificates; no `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED` anywhere |
| 12.3.3 | TLS or another appropriate transport encryption mechanism used for all connectivity between internal, HTTP-based… | Partial | Frontend→backend and backend→MongoDB are plain HTTP inside one host's Docker network, with ports bound to 127.0.0.1 (accepted for a single host) |
| 12.3.4 | TLS connections between internal services use trusted certificates | N/A | No internal TLS |

### V13 Configuration

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.1.1 | All communication needs for the application are documented | Pass | Communication needs are written in [External communication](#external-communication), including the user-supplied Slack webhook and the inbound LINE webhook (added on re-check, 19 Nov) |
| 13.2.1 | Communications between backend application components that don't support the application's standard user session… | Pass | MongoDB requires credentials; every frontend→backend call carries the user's own session token; no unauthenticated internal API |
| 13.2.2 | Communications between backend application components, including local or operating system services, APIs,… | Pass | The backend connects as `torr_app`, which has `readWrite` and `collMod` on its own database only; root is used only by the one-shot `db-users` service that creates or updates that account on every `docker compose up` (`docker/mongo-users/app-user.js`). Checked: the account can't read `admin`, write another database or drop its own |
| 13.2.3 | If a credential has to be used for service authentication, the credential being used by the consumer is not a… | Pass | No default: the first `docker compose up` generates the MongoDB root and app passwords (32 random bytes, `docker/db-secrets/init.sh`) into a private volume; the backend reads its password from a file (`MONGODB_PASSWORD_FILE`). An older volume still on the old root password works, with a warning and the steps to change it ([key-management.md](../operations/key-management.md#database-passwords)) |
| 13.2.4 | An allowlist is used to define the external resources or systems with which the application is permitted to… | Pass | Import and notification hosts are fixed in code; announcement files are fetched only from the allowlisted portal hosts (as V1.3.6) |
| 13.2.5 | The web or application server is configured with an allowlist of resources or systems to which the server can send… | **Not done** | No network-level egress allowlist |
| 13.3.1 | A secrets management solution, such as a key vault, is used to securely create, store, control access to, and… | **Not done** | Secrets come from environment variables and `.env`, not a vault (accepted for the course deployment) |
| 13.3.2 | Access to secret assets adheres to the principle of least privilege | Partial | Secrets exist only in server environments, but anyone with access to the host can read them |
| 13.4.2 | Debug modes are disabled for all components in production environments to prevent exposure of debugging features and… | Pass | `NODE_ENV=production` in both images: no debug output, no source maps served, demo data off |
| 13.4.3 | Web servers do not expose directory listings to clients unless explicitly intended | Pass | No directory listing (no static file server) |
| 13.4.4 | Using the HTTP TRACE method is not supported in production environments, to avoid potential information leakage | Pass | Neither Express nor Next.js implements TRACE; it gets 404 |
| 13.4.5 | Documentation (such as for internal APIs) and monitoring endpoints are not exposed unless explicitly intended | Pass | Only `/health` is exposed and it returns status only; no API docs or metrics endpoints |

### V14 Data Protection

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.1.1 | All sensitive data created and processed by the application has been identified and classified into protection levels | Pass | Data classification in [Data protection](#data-protection) |
| 14.1.2 | All sensitive data protection levels have a documented set of protection requirements | Pass | Protection requirements per class in [Data protection](#data-protection) |
| 14.2.2 | The application prevents sensitive data from being cached in server components, such as load balancers and… | Pass | Public documents are cached on purpose; every other backend and frontend API answer is `no-store` (PR #343) |
| 14.2.3 | Defined sensitive data is not sent to untrusted parties (e.g., user trackers) to prevent unwanted collection of data… | Pass | No analytics or trackers; fonts are self-hosted; the only third-party script is Google sign-in |
| 14.2.4 | Controls around sensitive data related to encryption, integrity verification, retention, how the data is to be… | Pass | Controls follow the classification; retention periods for each kind of data, enforced by TTL indexes and capped container logs, are in [limits-and-retention.md](../operations/limits-and-retention.md#how-long-data-is-kept) (updated 19 Nov 2026; was Partial) |
| 14.3.2 | The application sets sufficient anti-caching HTTP response header fields (i.e., Cache-Control: no-store) so that… | Pass | `Cache-Control: no-store` on every API answer; pages already send `private, no-cache, no-store` (PR #343) |
| 14.3.3 | Data stored in browser storage (such as localStorage, sessionStorage, IndexedDB, or cookies) does not contain… | Pass | Browser storage holds only the theme and a guest's saved TOR ids |

### V15 Secure Coding and Architecture

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.2 | An inventory catalog, such as software bill of materials (SBOM), is maintained of all third-party libraries in use,… | Pass | CycloneDX SBOMs for backend and frontend in `docs/security/evidence/` (PR #343) |
| 15.1.3 | The application documentation identifies functionality which is time-consuming or resource-demanding | Pass | Costly functions are written in [Resource-heavy functions](#resource-heavy-functions) |
| 15.2.2 | The application has implemented defenses against loss of availability due to functionality which is time-consuming… | Pass | Rate limits, timeouts, size caps, batch limits and off-by-default AI runs, as documented |
| 15.2.3 | The production environment only includes functionality that is required for the application to function, and does… | Pass | Debug route removed; demo data opt-in; no test code in the images |
| 15.3.2 | Where the application backend makes calls to external URLs, it is configured to not follow redirects unless it is… | Pass | Portal file fetches follow redirects by hand (`redirect: "manual"`), at most 3, and every hop must be an allowlisted host (`fetchPortalFile`); the portals' own files don't redirect today |
| 15.3.3 | The application has countermeasures to protect against mass assignment attacks by limiting allowed fields per… | Pass | ValidationPipe `whitelist: true` drops fields a route doesn't declare |
| 15.3.4 | All proxying and middleware components transfer the user's original IP address correctly using trusted data fields… | Pass | Same as V4.1.3 |
| 15.3.5 | The application explicitly ensures that variables are of the correct type and performs strict equality and… | Pass | TypeScript, `===` throughout, DTO `transform` gives each field its declared type |
| 15.3.6 | JavaScript code is written in a way that prevents prototype pollution, for example, by using Set() or Map() instead… | Pass | DTO whitelist; prototype keys skipped in `changedFields` (PR #341) |
| 15.3.7 | The application has defenses against HTTP parameter pollution attacks, particularly if the application framework… | Pass | A repeated parameter becomes an array, which the DTO validators reject |

### V16 Security Logging and Error Handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 16.1.1 | An inventory exists documenting the logging performed at each layer of the application's technology stack, what… | Pass | Log inventory in `logging-and-errors.md` and [Logging](#logging) |
| 16.2.1 | Each log entry includes necessary metadata (such as when, where, who, what) that would allow for a detailed… | Pass | Each event has time, event, outcome, account, client IP, method and path |
| 16.2.2 | Time sources for all logging components are synchronized, and that timestamps in security event metadata use UTC or… | Pass | UTC ISO-8601 timestamps |
| 16.2.3 | The application only stores or broadcasts logs to the files and services that are documented in the log inventory | Pass | Logs go only to stdout (the container log), as documented |
| 16.2.4 | Logs can be read and correlated by the log processor that is in use, preferably by using a common logging format | Pass | Production logs are JSON lines |
| 16.2.5 | When logging sensitive data, the application enforces logging based on the data's protection level | Pass | Passwords, tokens and links are never logged; emails are logged for investigation |
| 16.3.1 | All authentication operations are logged, including successful and unsuccessful attempts | Pass | Every sign-in success and failure, Google sign-in, lockout, logout and password change is logged |
| 16.3.2 | Failed authorization attempts are logged | Pass | `access.denied` for every refused guard check |
| 16.3.3 | The application logs the security events that are defined in the documentation and also logs attempts to bypass the… | Pass | Rate limits and lockouts are logged, and so is input refused by validation: `input.rejected` with the path, client address, user and the names of the refused fields, never their values (`LoggingValidationPipe`, `test/input-rejected.test.mjs`) |
| 16.3.4 | The application logs unexpected errors and security control failures such as backend TLS failures | Pass | Every 5xx is logged with an errorId by `AllExceptionsFilter` |
| 16.4.1 | All logging components appropriately encode data to prevent log injection | Pass | JSON encoding and a 254-character cap per field |
| 16.4.2 | Logs are protected from unauthorized access and cannot be modified | **Not done** | Logs sit in the host's container log; no write-once storage |
| 16.4.3 | Logs are securely transmitted to a logically separate system for analysis, detection, alerting, and escalation | **Not done** | Logs are not shipped to a separate system |
| 16.5.1 | A generic message is returned to the consumer when an unexpected or security-sensitive error occurs, ensuring no… | Pass | Unexpected errors return a generic message and an errorId only |
| 16.5.2 | The application continues to operate securely when external resource access fails, for example, by using patterns… | Pass | Imports retry with backoff and finish partially; optional panels fall back; every outbound call has a timeout |
| 16.5.3 | The application fails gracefully and securely, including when an exception occurs, preventing fail-open conditions… | Pass | Guards fail closed; invalid input is refused before any write; a missing or weak secret stops startup |

### V17 WebRTC

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 17.1.1 | The Traversal Using Relays around NAT (TURN) service only allows access to IP addresses that are not reserved for… | N/A | No WebRTC |
| 17.2.1 | The key for the Datagram Transport Layer Security (DTLS) certificate is managed and protected based on the… | N/A | No WebRTC |
| 17.2.2 | The media server is configured to use and support approved Datagram Transport Layer Security (DTLS) cipher suites… | N/A | No WebRTC |
| 17.2.3 | Secure Real-time Transport Protocol (SRTP) authentication is checked at the media server to prevent Real-time… | N/A | No WebRTC |
| 17.2.4 | The media server is able to continue processing incoming media traffic when encountering malformed Secure Real-time… | N/A | No WebRTC |
| 17.3.1 | The signaling server is able to continue processing legitimate incoming signaling messages during a flood attack | N/A | No WebRTC |
| 17.3.2 | The signaling server is able to continue processing legitimate signaling messages when encountering malformed… | N/A | No WebRTC |
