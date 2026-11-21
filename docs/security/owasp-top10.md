# OWASP Top 10 (2025) mapping

How TorFinder handles each category of the [OWASP Top 10:2025](https://owasp.org/Top10/2025/), with the controls, the ASVS 5.0 requirements they meet, the test evidence and what is still missing. Course criterion 17, issue #348. Written on 20 Nov 2026 against `main` at `db07c75`.

This file adds no new review. It maps work that is already done and documented:

- ASVS 5.0: [Level 1](./asvs-l1.md) (0 Fail), [Level 2](./asvs-l2.md) (125 of 125 applicable items pass), [Level 3](./asvs-l3.md) (68 of 72 applicable items pass, 94%; the 4 left need a production domain or hardware)
- [Threat model](./threat-model.md): STRIDE, 36 threats, all mitigated. Threat IDs such as S1 or E3 below come from there.
- [SAST](./sast-report.md) (CodeQL, Semgrep), [DAST](./dast-report.md) (OWASP ZAP), [logging and errors](./logging-and-errors.md), [evidence screenshots](./evidence/README.md)

ASVS IDs are written without the `V` prefix (`8.2.2` = ASVS 5.0 requirement V8.2.2). File paths are relative to the repository root. Every path below was checked to exist.

## Summary

| ID | Category | Status | Main controls |
| --- | --- | --- | --- |
| A01:2025 | Broken Access Control | Covered | A role guard on every route; every query is scoped to the session's own account; portal host allowlist against SSRF |
| A02:2025 | Security Misconfiguration | Covered | Production refuses weak secrets; strict CSP and security headers; ports on 127.0.0.1; containers run as non-root |
| A03:2025 | Software Supply Chain Failures | Partly covered | CI blocks high/critical advisories; Dependabot with a 7-day cooldown; actions pinned by SHA; SBOMs |
| A04:2025 | Cryptographic Failures | Covered | scrypt for passwords; HMAC-SHA256 sessions; TLS 1.3 + mutual TLS inside; hashed one-time links |
| A05:2025 | Injection | Covered | DTO whitelist on every input; escaped `$regex`; React escaping; nonce CSP; no injection found by ZAP |
| A06:2025 | Insecure Design | Covered | STRIDE threat model; written business rules; two-admin approval; step-up; atomic limits |
| A07:2025 | Authentication Failures | Covered | Breached-password check; per-IP and per-email lockout; passkeys for staff and companies; 30-min idle timeout |
| A08:2025 | Software or Data Integrity Failures | Covered | Signed session tokens and LINE webhooks; no object deserialization; files typed by their bytes; audit log |
| A09:2025 | Security Logging and Alerting Failures | Partly covered | JSON security events and an audit log; owner emails on lockout and new devices; no alert rules on the log yet |
| A10:2025 | Mishandling of Exceptional Conditions | Covered | Generic 500 with an `errorId`; guards fail closed; transactions; timeouts and caps on every outside call |

**Covered** means every applicable ASVS Level 2 item for the category passes, with evidence. **Partly covered** means a real gap is left; it is named in the section. No category is Not applicable.

### Changes from the 2021 list

| 2025 | 2021 equivalent |
| --- | --- |
| A01 Broken Access Control | A01 Broken Access Control, plus A10:2021 Server-Side Request Forgery, which 2025 folds in here |
| A02 Security Misconfiguration | A05 Security Misconfiguration |
| A03 Software Supply Chain Failures | A06 Vulnerable and Outdated Components, widened to the whole build and delivery chain |
| A04 Cryptographic Failures | A02 Cryptographic Failures |
| A05 Injection | A03 Injection |
| A06 Insecure Design | A04 Insecure Design |
| A07 Authentication Failures | A07 Identification and Authentication Failures |
| A08 Software or Data Integrity Failures | A08 Software and Data Integrity Failures |
| A09 Security Logging and Alerting Failures | A09 Security Logging and Monitoring Failures |
| A10 Mishandling of Exceptional Conditions | New in 2025 |

---

## A01:2025 Broken Access Control

**Risk for TorFinder.** A company reads or deletes another company's certificates, proposal library or saved TORs. An org account reaches admin routes and approves itself. The backend is made to fetch an internal address through a document URL (SSRF).

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| One guard per route; a guard admits only the roles it names. The frontend page gate is never the only check | `backend/src/common/session.guard.ts`, `role.guard.ts`, `admin.guard.ts`, `org.guard.ts`, `owner.guard.ts`, `auditor.guard.ts` | 8.1.1, 8.2.1, 8.3.1 |
| Saved TORs, searches, notifications, certificates and library records are always filtered on the session's user id, never a request field | `backend/src/certificates/certificates.service.ts`, `backend/src/library/library.service.ts` | 8.2.2, 8.4.1 |
| Field-level rules: `role`, `status` and `email` can't be set through `/accounts/me`; company name and tax id are write-once | `backend/src/accounts/accounts.service.ts` | 8.1.2, 8.2.3 |
| Revocation is read from the database on every request, so a role change or suspension applies to the next request | `backend/src/common/session-revocation.service.ts` | 7.4.2, 8.3.2 |
| Frontend→backend paths take only a 24-hex ObjectId, so `..` can't reach another backend route | `frontend/src/lib/backend-path.ts` | 8.2.2 (threat T5) |
| The sign-in `next` parameter allows only a same-site path | `frontend/src/lib/safe-redirect.ts` | 3.7.2, 1.5.3 |
| SSRF: documents are fetched only from the allowlisted portal hosts over HTTPS, and every redirect hop is checked. The only user-supplied URL, a Slack webhook, must match `hooks.slack.com` | `backend/src/common/portal-fetch.ts`, `backend/src/notifications/notification-delivery.ts` | 1.3.6, 13.2.4, 15.3.2, 13.1.1 |
| CORS allows the frontend origin only | `backend/src/main.ts` | 3.4.2 |
| Granting or removing the admin role needs a second admin | `backend/src/accounts/role-changes.service.ts`, `admin-approvals.service.ts` | 2.3.5 |

**Evidence**

- Tests: `backend/test/role-guards.test.mjs`, `roles.e2e.test.mjs`, `certificates.e2e.test.mjs`, `library.e2e.test.mjs`, `saved-tors.e2e.test.mjs`, `revocation-immediate.e2e.test.mjs`, `portal-fetch.test.mjs`, `admin-approvals.e2e.test.mjs`; `frontend/test/backend-path.test.mts`, `safe-redirect.test.mts`, `workspace-separation.e2e.test.mjs`
- Screenshots: [11a](./evidence/screenshots/11a-org-opens-admin-redirected.png) (org opening `/admin` is redirected), [11b](./evidence/screenshots/11b-api-accounts-forbidden.png) (backend answers 403), [04](./evidence/screenshots/04-cors-allowlist.png) (CORS), [13a–13f](./evidence/screenshots/13a-admin-role-needs-approval.png) (two-admin approval)
- SAST: CodeQL `js/request-forgery`, 11 alerts, fixed with `idPath()`. DAST: no path traversal found by the active scan.
- Threats: E1, I1, I7, I8, T3, T5, E3

**Status: Covered.** No gap left in the ASVS items for this category.

## A02:2025 Security Misconfiguration

**Risk for TorFinder.** The app ships with the public dev `SESSION_SECRET` or the README's demo admin. MongoDB or the backend is reachable from the network. Pages are served without a CSP. A debug route lists the database.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| Production stops at startup on a missing, published or short `SESSION_SECRET` | `backend/src/config/env.ts`, `frontend/src/lib/auth.ts` | 9.1.3, 16.5.3 |
| Demo accounts only when `.env` sets `SEED_DEMO_DATA=true`; off by default | `docker-compose.yml` | 6.3.2 |
| MongoDB root password generated on first start; backend logs in with an X.509 certificate as a least-privilege user | `docker/db-secrets/init.sh`, `docker/mongo-users/` | 13.2.2, 13.2.3 |
| Every port bound to `127.0.0.1`; only the frontend faces users | `docker-compose.yml` | 12.2.1, 13.2.1 |
| Strict per-request nonce CSP with `'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`; strict fallback CSP on every other response | `frontend/src/proxy.ts`, `frontend/src/lib/csp.ts`, `frontend/next.config.ts` | 3.4.3, 3.4.6 |
| HSTS, `nosniff`, `Referrer-Policy`, `Cross-Origin-Resource-Policy`, `no-store` on API answers | `frontend/next.config.ts`, helmet in `backend/src/main.ts` | 3.4.1, 3.4.4, 3.4.5, 3.5.8, 14.3.2 |
| `__Host-` cookies: `Secure`, `HttpOnly`, `SameSite=Lax` | `frontend/src/lib/auth.ts` | 3.3.1, 3.3.3, 3.3.4 |
| `NODE_ENV=production` in both images; containers run as `node`, not root; debug route deleted; only `/health` exposed | `backend/Dockerfile`, `frontend/Dockerfile` | 13.4.2, 13.4.5, 15.2.3 |
| HTTPS edge: TLS 1.2/1.3 only, HTTP→HTTPS for pages, API over plain HTTP refused | `docker/caddy/Caddyfile`, `docker-compose.edge.yml` | 4.1.2, 12.1.2, 12.3.1 |
| Opt-in hardened stack: egress allowlist proxy, secrets vault | `docker-compose.hardening.yml`, `docker/hardening/` | 13.2.5, 13.3.1 |

**Evidence**

- Tests: `backend/test/asvs-l1-regressions.e2e.test.mjs`, `asvs-l2-regressions.e2e.test.mjs`; `frontend/test/csp.test.mts`
- Screenshots: [01](./evidence/screenshots/01-headers-search-page.png) (headers and CSP), [02](./evidence/screenshots/02-headers-api-auth-me.png) (`no-store`), [03](./evidence/screenshots/03-session-cookie-flags.png) (cookie flags), [17](./evidence/screenshots/17-https-edge.png) (HTTPS edge), [18](./evidence/screenshots/18-hardening-services.png) (egress proxy, vault)
- DAST: the one real ZAP finding was a page with no script CSP (404 for file-like paths); fixed with the fallback CSP. `style-src 'unsafe-inline'` is an accepted risk, explained in the DAST report.
- SAST: Semgrep `dockerfile.missing-user` fixed (containers no longer run as root).
- Threats: S1, S3, E4, I2

**Status: Covered.** Gaps outside the code, listed as accepted risks in [asvs-l3.md](./asvs-l3.md#accepted-risks): the domain is not on the HSTS preload list (3.7.4), and Encrypted Client Hello is off (12.1.5). Both wait only on a production domain. Branch `feat-asvs-l3-domain-ready` makes them switch-on items:

- **ECH:** one more compose file. It builds Caddy with a pinned DNS provider module and reads the DNS token at run time.
- **HSTS preload:** a readiness check to run against the domain before submitting, plus a CI test that keeps the HSTS header preload-eligible.

The egress proxy and vault run only in the opt-in hardened stack, not in the default `docker compose up`.

## A03:2025 Software Supply Chain Failures

**Risk for TorFinder.** A dependency with a known flaw crashes the backend (threat D4). A just-published, compromised package version is merged straight away. A moved GitHub Action tag changes what CI runs.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| CI runs `npm audit --omit=dev` on backend and frontend and fails on high or critical | `.github/scripts/npm-audit.mjs`, `.github/workflows/auth.yml` | 15.2.1 |
| An advisory can be skipped only with a written reason and an expiry date (one today: `picomatch`, unreachable) | `.github/audit-exceptions.json` | 15.2.1 |
| Dependabot weekly, grouped, with a 7-day cooldown before a new version is proposed | `.github/dependabot.yml` | 15.1.1 |
| Every GitHub Action pinned to a full commit SHA; the CI token is read-only | `.github/workflows/auth.yml` | 15.1.1 |
| Reproducible installs with `npm ci` from the lockfiles | `backend/Dockerfile`, `frontend/Dockerfile` | 15.1.1 |
| CycloneDX SBOM for backend and frontend | `docs/security/evidence/sbom-backend.cdx.json`, `sbom-frontend.cdx.json` | 15.1.2 |
| Risky components reviewed by name; none classed as risky | [asvs-l3.md](./asvs-l3.md#risky-components-and-dangerous-functionality) | 15.1.4 |
| Dependency patch SLA written down | [asvs-l1.md](./asvs-l1.md#dependency-patch-sla-asvs-1511) | 15.1.1 |
| CodeQL on every push and pull request | GitHub code scanning (default setup) | 15.2.1 |

**Evidence**

- `npm audit --omit=dev`: 0 in backend and frontend (asvs-l1.md, 15.2.1)
- SAST: CodeQL `actions/missing-workflow-permissions` and unpinned-action alerts, and Semgrep `dependabot-missing-cooldown`, all fixed ([sast-report.md](./sast-report.md))
- Screenshot: [10](./evidence/screenshots/10-code-scanning.png) (0 open code-scanning alerts)
- Threat: D4

**Status: Partly covered.** What is missing:

- GitHub secret scanning and push protection are off for the repository ([logging-and-errors.md](./logging-and-errors.md#secret-scan-of-the-git-history)). A one-time scan of all commits found no secret, but nothing blocks a new one at push time.
- Docker images are built in CI but not signed, and no build provenance (SLSA) is published.
- The SBOMs are files checked in by hand, not regenerated on each build.

## A04:2025 Cryptographic Failures

**Risk for TorFinder.** Stolen password hashes are cracked offline. A session token is forged or read off the network. A password-reset link is guessed.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| scrypt (N = 2^14, r = 8, p = 5), random salt; settings stored per hash and upgraded at sign-in | `backend/src/common/password.ts` | 11.4.2, 11.2.2 |
| HMAC-SHA256 session tokens, compared with `timingSafeEqual`; no `alg` field to tamper with | `backend/src/common/token.ts` | 9.1.1, 9.1.2, 11.2.3, 11.6.1 |
| Reset and verify links: 32 random bytes, stored as SHA-256, single use, 1 h / 24 h | `backend/src/auth/account-links.service.ts` | 6.4.1, 11.5.1 |
| `SESSION_SECRET` rotates without signing everyone out; the old key expires by itself | `backend/src/common/session-keys.ts` | 13.3.4 |
| Internal links are TLS 1.3 with mutual TLS: frontend→backend and backend→MongoDB, from a private CA | `backend/src/common/internal-tls.ts`, `frontend/src/lib/internal-tls.ts`, `docker/certs/generate.sh` | 12.3.3, 12.3.5, 11.6.2 |
| Outbound HTTPS validates certificates; no `rejectUnauthorized: false` anywhere | Node `fetch` | 12.3.2 |
| Key management policy and a crypto inventory checked in CI | `docs/operations/key-management.md`, [crypto-inventory.md](./crypto-inventory.md), `scripts/crypto-inventory.mjs` | 11.1.1, 11.1.2, 11.1.3 |
| No sensitive data in URLs; tokens only in httpOnly cookies | `frontend/src/lib/signup-email.ts` | 14.2.1, 14.3.3 |

**Evidence**

- Tests: `backend/test/password-rehash.e2e.test.mjs`, `session-rotation.test.mjs`, `internal-tls.test.mjs` (a TLS 1.2 handshake is refused), `crypto-inventory.test.mjs`, `account-links.e2e.test.mjs`
- Screenshot: [16](./evidence/screenshots/16-mutual-tls.png) (mutual TLS)
- Threats: S1, S6

**Status: Covered.** Level 3 items still open, all needing hardware or hosting: keys in an HSM (13.3.3) and memory encryption (11.7.1). See [asvs-l3.md](./asvs-l3.md#accepted-risks). Branch `feat-asvs-l3-domain-ready` adds a step-by-step plan for each. Memory encryption needs only a confidential VM; the stack runs on one unchanged. A KMS for `SESSION_SECRET` and the CA key would bring 13.3.3 to Partial, not Pass: TLS private keys and scrypt still run in process, and the requirement covers *all* cryptographic operations.

## A05:2025 Injection

**Risk for TorFinder.** A search term or JSON body turns into a MongoDB operator (`{"$ne": null}`). A TOR title or comment runs script in another user's browser. A crafted regex slows the server (ReDoS).

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| A class-validator DTO on every body and query; global `ValidationPipe` with `whitelist: true` drops unknown fields | `backend/src/main.ts` | 2.2.1, 2.2.2, 15.3.3 |
| Typed Mongo filters; text is escaped before every `$regex` | `backend/src/common/regex.ts` | 1.2.4, 1.2.9 |
| React escapes all output; no `dangerouslySetInnerHTML` | frontend | 1.2.1, 3.2.2 |
| Nonce CSP so injected script can't run | `frontend/src/proxy.ts` | 3.4.3 |
| Emails sent through Resend's HTTP API with fixed subjects and an HTML-escaped body | `backend/src/common/email.ts` | 1.3.11 |
| Every regex in the code checked for exponential backtracking in CI | `scripts/regex-audit.mjs` | 1.3.12 |
| Log fields JSON-encoded and capped at 254 characters, so input can't forge a log line | `backend/src/common/security-log.ts` | 16.4.1 |

**Evidence**

- Tests: `backend/test/regex-audit.test.mjs`, `input-rejected.test.mjs`, `asvs-l1-regressions.e2e.test.mjs`
- DAST: the signed-in active scan (5,573 requests) found no working SQL/NoSQL injection, XSS or path traversal ([dast-report.md](./dast-report.md))
- SAST: CodeQL `js/sql-injection` alerts were false positives (the filter is checked with `@IsIn`); `js/incomplete-sanitization` fixed with `escapeRegex()`
- Threats: T1, S5

**Status: Covered.** `style-src 'unsafe-inline'` is kept for React `style` attributes and Google's button; it can't run script (accepted in the DAST report).

## A06:2025 Insecure Design

**Risk for TorFinder.** The rules themselves are weak: an admin promotes a friend to admin alone, a bot fills sign-ups or comments, a company runs past its upload cap by sending requests in parallel.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| STRIDE threat model with a data-flow diagram, 36 threats scored, and secure-design principles mapped | [threat-model.md](./threat-model.md) | 15.1.3 |
| Business rules and per-user limits written down | [asvs-l2.md](./asvs-l2.md#business-rules-and-limits) | 2.1.2, 2.1.3 |
| Signup → verify email → admin approval before an org can sign in | `backend/src/auth/auth.service.ts` (`issueSession`) | 2.3.1 |
| Admin role changes need a second admin; sensitive admin actions need a fresh passkey (step-up) | `backend/src/accounts/role-changes.service.ts`, `backend/src/common/step-up.guard.ts` | 2.3.5, 7.5.3 |
| Forms sent back faster than a person could fill them are refused | `backend/src/common/form-timing.guard.ts`, `frontend/src/lib/form-timing.ts` | 2.4.2 |
| Caps claimed atomically (no check-then-act race) | `backend/src/database/database.service.ts` | 15.4.2, 2.3.3 |
| Costly functions listed with their limits (imports, AI, find similar, document relay) | [asvs-l2.md](./asvs-l2.md#resource-heavy-functions) | 15.1.3, 15.2.2 |

**Evidence**

- Tests: `backend/test/admin-approvals.e2e.test.mjs`, `form-timing.e2e.test.mjs`, `saved-searches.e2e.test.mjs`, `feedback-window.e2e.test.mjs`
- Screenshots: [13a–13f](./evidence/screenshots/13a-admin-role-needs-approval.png)
- Threat model: all 36 threats mitigated

**Status: Covered.**

## A07:2025 Authentication Failures

**Risk for TorFinder.** Credential stuffing against company logins. A weak or breached password. A stolen session cookie stays valid forever. A Google identity is linked to an account through an unverified email.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| Passwords 8–128 characters; refused if among the 10,000 most common breached passwords or built on context words (TorFinder, กรุงเทพ, the company name…) | `backend/src/common/password.ts`, `backend/src/common/common-passwords.ts` | 6.2.1, 6.2.4, 6.2.9, 6.2.11, 6.2.12 |
| 5 logins per minute per IP, plus 10 failures per email per 15 minutes; the owner is emailed when locked | `backend/src/auth/login-attempts.ts` | 6.3.1, 6.3.5 |
| Same answer and the same scrypt work for unknown emails, so timing doesn't reveal which accounts exist (measured 25 ms either way) | `backend/src/auth/auth.service.ts` | 6.3.8 |
| Passkeys required for staff and companies in production; staff can't skip them by choosing Google | `backend/src/auth/passkeys.service.ts`, `backend/src/common/passkey-policy.ts` | 6.3.3, 6.4.3, 6.4.4 |
| Sign-in from a new device emails the owner and gets a 12-hour session | `backend/src/auth/known-devices.ts` | 6.3.5, 8.2.4 |
| 30-minute idle timeout, 7-day absolute lifetime; logout and password change end every session | `backend/src/common/token.ts`, `frontend/src/proxy.ts`, `backend/src/common/session-revocation.service.ts` | 7.1.1, 7.3.1, 7.3.2, 7.4.1, 7.4.3 |
| Users see and end their own sessions; admins can sign any account out, behind step-up | `backend/src/auth/auth.controller.ts`, `backend/src/accounts/accounts.controller.ts` | 7.4.5, 7.5.2 |
| Google sign-in: signature, audience, expiry and nonce checked; linked only when Google marks the email verified | `backend/src/auth/google-claims.ts` | 6.8.1, 6.8.2, 10.1.2, 10.5.1 |

**Evidence**

- Tests: `backend/test/auth.e2e.test.mjs`, `sessions.e2e.test.mjs`, `passkeys.e2e.test.mjs`, `company-passkeys.test.mjs`, `lockout-notice.test.mjs`, `new-device-notice.test.mjs`, `google-claims.test.mjs`, `oauth.e2e.test.mjs`
- Screenshots: [05](./evidence/screenshots/05-login-lockout.png) (lockout), [06](./evidence/screenshots/06-idle-session-timeout.png) (idle timeout), [07a](./evidence/screenshots/07a-signup-breached-password.png) and [07b](./evidence/screenshots/07b-signup-context-password.png) (password policy), [12b](./evidence/screenshots/12b-google-sign-in-success.png) (Google sign-in), [14a–14f](./evidence/screenshots/14a-signed-in-devices.png) (sessions)
- Threats: S2, S4, D1, E2, I6

**Status: Covered** at ASVS Level 2. The Level 3 gap: public viewers sign in with Google only, so not every account has a phishing-resistant factor of TorFinder's own (6.3.3, Level 3 condition). Viewers can save TORs and searches, but they can't reach company or staff data.

## A08:2025 Software or Data Integrity Failures

**Risk for TorFinder.** A forged LINE webhook links an attacker's LINE to a company's alerts. An edited session token raises its role. An HTML file renamed `.pdf` runs in our origin. Someone changes a TOR's budget and nobody can tell who.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| Session tokens are HMAC-signed and checked before use | `backend/src/common/token.ts` | 9.1.1, 9.2.2 |
| LINE webhooks are checked with HMAC-SHA256 over the raw body; all are refused while no secret is set | `backend/src/notifications/line-link.ts` | 1.5.3 (threat S7) |
| Only plain `JSON.parse`; no typed object deserialization; prototype keys can't be set from a request | `backend/src/tor/tor.service.ts` | 1.5.2, 15.3.6 |
| Uploads and relayed portal files are typed by their bytes, not their name; PDF, PNG, JPEG (and real `.docx`) only | `backend/src/common/stored-files.ts`, `backend/src/common/archive-files.ts` | 5.2.2, 1.3.4, 3.2.1 |
| Upload metadata stripped; untrusted bytes parsed in a worker with a memory limit and deadline | `backend/src/common/parse-worker.ts` | 14.2.8, 15.2.5 |
| Opt-in ClamAV scan of every upload and relayed file | `backend/src/common/virus-scan.ts`, `docker-compose.hardening.yml` | 5.4.3 |
| Admin actions (approve, suspend, edit TOR, role change) recorded with actor and time | `backend/src/audit/audit.service.ts` | 16.3.x (threat R2) |
| Multi-step writes in one MongoDB transaction | `backend/src/database/database.service.ts` | 2.3.3 |
| The only third-party script (Google sign-in) can't use SRI; the decision is written down, and `'strict-dynamic'` limits what it can load | [asvs-l3.md](./asvs-l3.md#required-browser-features) | 3.6.1 |

**Evidence**

- Tests: `backend/test/line-link.e2e.test.mjs`, `virus-scan.test.mjs`, `document-metadata.test.mjs`, `image-uploads.test.mjs`, `audit-hooks.e2e.test.mjs`, `certificates.test.mjs`
- Screenshots: [13f](./evidence/screenshots/13f-audit-log-approval-steps.png) (audit log), [18](./evidence/screenshots/18-hardening-services.png) (ClamAV refuses EICAR)
- SAST: CodeQL `js/remote-property-injection` fixed (#350)
- Threats: S7, T3, T4, T6, T8, R2

**Status: Covered.** The virus scan runs only in the opt-in hardened stack. CI pipeline integrity (pinned actions, signed images) is under A03.

## A09:2025 Security Logging and Alerting Failures

**Risk for TorFinder.** A password-guessing run or an admin abusing their role goes unnoticed. A log line carries a password or token. Someone on the server edits the logs to hide what they did.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| JSON security events: sign-in success and failure, lockout, Google sign-in, logout, password change and reset, refused and granted access, rate limits, refused input, bad webhook signatures | `backend/src/common/security-log.ts`, `backend/src/common/logging-validation.pipe.ts`, `backend/src/common/logging-throttler.guard.ts` | 16.2.1, 16.3.1, 16.3.2, 16.3.3 |
| UTC ISO time, client IP, user, method and path on every event | `backend/src/common/security-log.ts` | 16.2.1, 16.2.2 |
| Passwords, tokens, links and cookies never logged | `backend/src/common/security-log.ts` | 16.2.5 |
| Audit log of admin actions at `/admin/audit` | `backend/src/audit/audit.service.ts` | 16.3.x |
| Owners emailed on lockout and new-device sign-in; other admins emailed on a staff new-device sign-in; admins alerted when an import job fails | `backend/src/auth/known-devices.ts`, `backend/src/notifications/admin-alerts.service.ts` | 6.3.5, 8.4.2 |
| Opt-in: logs shipped to a separate append-only store no app container can reach | `docker-compose.hardening.yml`, `docker/hardening/log-store.conf` | 16.4.2, 16.4.3 |
| Retention written down; container logs capped | `docs/operations/limits-and-retention.md` | 14.2.4 |

**Evidence**

- Tests: `backend/test/security-logging.test.mjs`, `authorization-log.test.mjs`, `input-rejected.test.mjs`, `google-signup-log.test.mjs`, `admin-alerts.test.mjs`
- Screenshots: [08](./evidence/screenshots/08-security-log-json.png) (security log), [15d](./evidence/screenshots/15d-admin-sign-out-logged.png) (admin sign-out logged)
- A test run produced every event type, and its log held no test password or token ([logging-and-errors.md](./logging-and-errors.md))
- Threats: R1, R2

**Status: Partly covered.** Logging meets every ASVS Level 2 item, but alerting is thin:

- No rule raises an alert from the security log itself, for example on a burst of `auth.login` failures or `access.denied` from one IP. Today someone has to read the log. Alerts exist only for per-account events (lockout, new device) and failed import jobs.
- In the default stack, logs stay in the container log on the host. The separate log store runs only with `docker-compose.hardening.yml`.

## A10:2025 Mishandling of Exceptional Conditions

**Risk for TorFinder.** A database error returns a stack trace or connection string. A portal outage leaves half-written records. A token check that throws lets the request through. A huge file or zip bomb takes the server down.

**Controls**

| Control | Where | ASVS |
| --- | --- | --- |
| Unexpected errors: generic message and an `errorId` to the client; full details only in the server log | `backend/src/common/all-exceptions.filter.ts` | 16.5.1, 16.3.4 |
| Frontend error pages never show the error message | `frontend/src/app/error.tsx` | 16.5.1 |
| Guards fail closed: any token error means "not signed in"; an unknown file type is refused; a weak secret stops startup | `backend/src/common/session.guard.ts`, `backend/src/config/env.ts` | 16.5.3 |
| Multi-step writes in one transaction, so a failure leaves nothing half-done | `backend/src/database/database.service.ts` | 2.3.3 |
| Every outside call has a timeout; imports retry with backoff and finish partially | `backend/src/common/sync-scheduler.ts`, `backend/src/common/portal-fetch.ts` | 16.5.2 |
| Size caps: 40 MB per portal file or zip, inflation capped at the declared size, 5 MB per upload | `backend/src/common/zip.ts`, `backend/src/common/archive-files.ts`, `backend/src/common/stored-files.ts` | 5.2.1, 5.2.3 |
| Parsers of untrusted bytes run in a worker with a 256 MB heap and a deadline | `backend/src/common/parse-worker.ts` | 15.2.5 |
| Connection limits, timeouts and retries written down | `docs/operations/limits-and-retention.md` | 13.1.2, 13.1.3 |

**Evidence**

- Tests: `backend/test/security-logging.test.mjs`, `tor-integration.e2e.test.mjs`, `asvs-l1-regressions.e2e.test.mjs`
- Screenshot: [09](./evidence/screenshots/09-generic-500-with-error-id.png) (MongoDB stopped: client gets a generic message and an `errorId`; the stack is only in the server log)
- Threats: I3, D3, D5

**Status: Covered.**

---

## Remaining gaps in one place

| Gap | Category | Why it is still open | What would close it |
| --- | --- | --- | --- |
| No alert rules on security events | A09 | Logs are collected, but no one is paged on a burst of failures | Alert rules in the log store (Fluent Bit output to email or LINE) on `auth.login` failures and `access.denied` per IP |
| GitHub secret scanning and push protection off | A03 | Repository setting, not code | Turn on in Settings → Code security |
| Images not signed, no build provenance | A03 | Not needed for the course deployment | `cosign` signing and SLSA provenance in the image job |
| Hardened services are opt-in (egress proxy, vault, ClamAV, separate log store) | A02, A08, A09 | They need extra containers; the demo stays light | Run `docker-compose.hardening.yml` on the production host |
| Public viewers have no factor beyond Google | A07 | Viewers reach only public data and their own saved items | Offer passkeys to viewers too |
| HSTS preload, Encrypted Client Hello | A02 | Need a production domain. Ready to switch on (branch `feat-asvs-l3-domain-ready`) | Pass the preload readiness check, then submit the domain; add the ECH compose file with a DNS API token |
| HSM for keys, memory encryption | A04 | Need hardware or confidential VMs | Deploy on a confidential VM; cloud KMS for `SESSION_SECRET` and the CA key (13.3.3 then reaches Partial) |
