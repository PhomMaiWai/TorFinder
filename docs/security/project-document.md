# TorFinder: Security Project Document

Software Development Security (01219325), group project, semester 1/2026. Submitted 22 Nov 2026.

This document follows the six sections the assignment asks for. Each section is short and links to the detailed report in this folder that holds the evidence. Where a graded criterion (1–18) is covered, its number is shown as **[C*n*]**.

> **Draft (18 Nov 2026).** Still to fill: student IDs (§1), the OWASP Top 10 mapping (§3.3, from #348), and the evidence screenshots (§6, from #349). Each is marked **TODO**.

## Contents

1. [Application and team](#1-application-and-team)
2. [Functional features](#2-functional-features)
3. [Security features mapped to ASVS](#3-security-features-mapped-to-asvs)
4. [Threat model](#4-threat-model)
5. [Security principles](#5-security-principles)
6. [Security test process](#6-security-test-process)

---

## 1. Application and team

**TorFinder** collects Thai government software procurement announcements (TORs) for Bangkok, lets administrators curate them, and matches them to the software companies that could bid on them.

- **Repository:** <https://github.com/PhomMaiWai/TorFinder> (install and run: [README](../../README.md))
- **Stack:**
  - Next.js 16 frontend (React 19)
  - NestJS 11 backend
  - MongoDB 7 (GridFS for company files)
  - Docker Compose
- **Services it talks to:**
  - Google sign-in
  - Resend email, LINE and Slack (notifications)
  - Gemini on Vertex AI (optional)
  - the e-GP, MEA and data.go.th procurement portals

| Member | Student ID | GitHub | Security work |
| --- | --- | --- | --- |
| Sai Khun Main | **TODO** | SKlv1ain | ASVS L1/L2 review and fixes, threat model, SAST/DAST, CI audit, project document |
| Nisara Ploysuttipol | **TODO** | fcxbsyo | CodeQL fixes (#350), OWASP Top 10 mapping (#348), evidence screenshots (#349) |
| Bhumipat Kusalatham | **TODO** | OverCatX | Presentation slides (#352) |

## 2. Functional features

Full list with route and status: [roles-and-features.md](../project/roles-and-features.md).

| Role | Who | Main features |
| --- | --- | --- |
| Public visitor | Anyone | Search and filter TORs; find similar TORs; TOR detail with AI summary, timeline and documents; budget insight; market insights; comment on a draft TOR; report a problem |
| Viewer (`viewer`) | Member of the public, via Google sign-in | Bookmarks and saved searches |
| Organization (`org`) | Software company: signs up, verifies email, then is approved by an admin | Company profile; TORs ranked by fit with reasons; match alerts by app, email, LINE and Slack; certificates and proposal library with file uploads; AI proposal draft; starter-pack ZIP |
| Project owner (`owner`) | The agency publishing a TOR | Dashboard of its TORs, match counts and feedback |
| Auditor (`auditor`) | State Audit Office | TORs flagged for unusual budget or low competition |
| Admin (`admin`) | TorFinder team | Approve companies; manage users and roles; edit, hide and lock TORs; moderate comments; handle reports; run imports; audit log |

Automatic jobs import TORs from four portals on a timer, de-duplicate them, run AI extraction and send match alerts.

## 3. Security features mapped to ASVS

We reviewed TorFinder against **OWASP ASVS 5.0**, all of Level 1 and all of Level 2 **[C1]**, and triaged Level 3.

| Level | Requirements | Pass | Partial | Fail / Not done | N/A | Not reviewed | Report |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Level 1 | 70 | 56 | 0 | 0 | 12 | 2 (TLS, set by hosting) | [asvs-l1.md](./asvs-l1.md) |
| Level 2 | 183 | 105 | 12 | 5 | 58 | 3 (hosting proxy) | [asvs-l2.md](./asvs-l2.md) |
| Level 3 (triage, not claimed) | 92 | 55 | 5 | 7 | 21 | 4 (hosting proxy) | [asvs-l3.md](./asvs-l3.md) |

Level 1 has no Fail and no Partial. At Level 2, 105 of the 125 requirements that apply pass (84%). Level 3 is not a target; the triage on 19 Nov records which of its controls fit TorFinder, and 58 of the 71 that apply pass (82%), including passkeys for staff ([passkeys.md](./passkeys.md)), a second admin's approval to grant or remove the admin role, a lockout email to the account's owner, an admin "send reset link" action, and documented limits, data retention and secret rotation ([limits-and-retention.md](../operations/limits-and-retention.md)). Every Partial and Not done item names its gap in the report.

### 3.1 Graded security features

| # | Criterion | What TorFinder does | Code | ASVS |
| --- | --- | --- | --- | --- |
| C4 | Password authentication | scrypt-hashed passwords; 8–128 characters; refuses the 10,000 most common passwords and passwords built on context words (`torfinder`, `bangkok`, the company name…); email must be verified; change password requires the current one | `backend/src/auth/`, `common/common-passwords.ts` | 6.2.1–6.2.8, 11.4.2 |
| C5 | Social SSO (OAuth/OIDC) | Google sign-in: the ID token's signature, audience and expiry are checked, and an account is linked only when Google marks the email verified | `auth.service.ts` `verifyGoogleCredential()` | 6.8.1, 6.8.2, 10.x (client) |
| C6 | Authorization (roles) | Six roles. Each backend route has one role guard, and a guard admits only the roles it names; the admin is not implicitly owner or auditor | `backend/src/common/*.guard.ts` | 8.2.1, 8.3.1 |
| C7 | Access control (own data only) | Every account-data query filters on the session's user id, never on a request field; company files are re-checked for ownership on every read | `certificates.service.ts`, `library.service.ts`, saved-TOR services | 8.2.2 |
| C8 | Input validation, NoSQL injection | Whitelisting DTOs (`class-validator`, `whitelist: true`) drop unknown fields; typed filters with `$eq`; `$regex` input escaped; uploads typed by their bytes; frontend→backend paths only from ObjectIds | `common/regex.ts`, `common/stored-files.ts`, `frontend/src/lib/backend-path.ts` | 1.2.4, 2.2.1, 2.2.2, 5.2.2 |
| C9 | Environment variables and credentials | All secrets come from the environment. Production refuses a missing, published or short (< 32 characters) `SESSION_SECRET`. `.env` is ignored by git and Docker. A history scan of all 372 commits found no real secret | `backend/src/config/env.ts`, `frontend/src/lib/auth.ts` | 9.1.3, 13.3.1 |
| C10 | CORS | The backend allows exactly one origin, the frontend's (`enableCors({ origin: env.frontendOrigin })`), never `*`. It also accepts only bearer tokens, never cookies | `backend/src/main.ts` | 3.4.2, 3.5.2 |
| C11 | Error handling | A global filter returns a generic message and an `errorId` for unexpected errors; the full error stays in the server log. Frontend error pages never show the message | `common/all-exceptions.filter.ts` | 16.5.1 |
| C12 | Logging | JSON security events for every sign-in outcome, lockout, logout, signup, password change and reset, refused access, 429s and bad LINE signatures. Each event has the time and client IP and never contains passwords or tokens. Admin actions go to the audit log | `common/security-log.ts`, [logging-and-errors.md](./logging-and-errors.md) | 16.2.1, 16.3.x |
| C13 | HTTP security headers | Nonce CSP with `'strict-dynamic'`, plus a strict fallback CSP on every other response; HSTS 1 year; `X-Content-Type-Options: nosniff`; `frame-ancestors 'self'`; `Referrer-Policy: strict-origin-when-cross-origin`; backend uses `helmet()` | `frontend/src/proxy.ts`, `frontend/next.config.ts` | 3.4.1–3.4.6 |

### 3.2 Advanced features (self-studied) [C18]

The assignment asks for four. TorFinder has six:

| Feature | How it works | ASVS |
| --- | --- | --- |
| Login rate limit | 5 attempts per minute per client IP on every auth route. Separately, 10 failures per email in 15 minutes lock that email. The client IP is trusted only from private hops, so one attacker can't lock everyone out | 6.3.1 |
| Backend API rate limit | 100 requests per minute per IP overall; 30 per minute for "find similar"; 5 per minute for AI drafts; 300 per minute per IP on the public LINE webhook | 2.4.1 |
| Login timeout | The session ends after 30 minutes without activity, and 7 days after sign-in whatever the activity | 7.3.1, 7.3.2 |
| Token expiry and revocation | HMAC-signed session token with an expiry, checked on every guarded request. A per-user revocation time ends every session at logout, password change, role change or suspension | 7.4.1, 7.4.2, 9.1.1 |
| Compromised-password check at signup | New passwords are refused if they are among the 10,000 most common breached passwords (SecLists NCSC list). The check runs at signup, reset and change | 6.2.4 |
| Email verification | An organization can't sign in until it opens a single-use, hashed, 24-hour verification link | 6.4.1 |

### 3.3 OWASP Top 10 mapping [C17]

**TODO (#348):** map each OWASP Top 10 (2025) category to the controls above and to the threats in §4.

## 4. Threat model

Full model: [threat-model.md](./threat-model.md) **[C2]**.

- **Method:** STRIDE, applied to a data-flow diagram with three trust boundaries: the internet, the server host, and external services.
- **Scoring:** each threat is scored likelihood × impact, each 1–3.

| Score | Priority |
| --- | --- |
| 9 | Critical |
| 6 | High |
| 3–4 | Medium |
| 1–2 | Low |

**Result: 36 threats. All 36 are mitigated, and none is open.**

| Priority | Threats | Mitigated | Partial |
| --- | --- | --- | --- |
| Critical | 3 | 3 | 0 |
| High | 15 | 15 | 0 |
| Medium | 12 | 12 | 0 |
| Low | 6 | 5 | 1 |

### Implemented by priority

1. **Critical, first:**
   - **S1:** an admin session could be forged with the public dev secret. Production now refuses that secret.
   - **S3:** a seeded admin's password was published in the README. Demo seeding is now opt-in.
   - **E1:** role guards on every route, re-checked.
   - All three are in PR #321.
2. **High:**
   - the public feedback leak (I1)
   - dependency advisories, with the CI audit (D4)
   - per-IP and per-email login limits (S2, D1)
   - ports bound to localhost (E4)
   - the git-history secret scan (I4)
   - LINE webhook signatures (S7)
   - upload type checks and ownership (T6, I8)
3. **Medium:**
   - security logging and error messages (R1, I3)
   - request-forgery path checks found by SAST (T5)
   - upload size limits (D5)
4. **Low:** all are done, including the LINE webhook rate limit (D6, PR #363) and the host allowlist for document fetches (E3, issue #345).

### Mitigation checklist [C16]

The done/not-done checklist for every threat is in [threat-model.md § Mitigation checklist](./threat-model.md#mitigation-checklist). The threats table there names each mitigation's code and ASVS requirement, which maps the implementation back to the threat model.

## 5. Security principles

Each principle is mapped to where the code applies it **[C3]**. The full table is in [threat-model.md § Security design principles](./threat-model.md#security-design-principles).

| Principle | Example in TorFinder |
| --- | --- |
| Least privilege | One role per guard; the database and backend aren't exposed; containers run as `node`, not root |
| Complete mediation | Every guarded request re-checks signature, expiry, idle time, role and revocation; company files are re-checked for ownership on every download |
| Fail securely | A bad secret stops startup; an unknown file type is refused; any token error means "signed out"; the LINE webhook refuses everything without a secret |
| Secure defaults | Demo accounts off by default; `__Host-` Secure httpOnly cookie; CSP and headers on every response |
| Defense in depth | IP throttle plus email lockout; SameSite cookie plus Origin checks; type allowlist plus magic bytes plus `nosniff`; `idPath()` plus a proxy path check |
| Never trust input | Server-side DTOs on every request; files typed by their bytes; LINE events believed only with a valid signature |
| Minimize attack surface | Debug route deleted; ports on `127.0.0.1`; the backend accepts no cookies |
| Separation of duties | Admin approves companies; moderators approve comments before they are shown |
| Economy of mechanism | One token format, one cookie helper, one rate-limit module, one stored-file module |
| Open design | Security rests on secrets and on scrypt/HMAC; the repository is public |
| Psychological acceptability | No composition rules; paste and password managers allowed; clear lockout messages; one-tap LINE linking |
| Keep secrets out of code | Secrets only from the environment; reset tokens and link codes stored only as hashes |

## 6. Security test process

| Step | Tool | When | Result | Report |
| --- | --- | --- | --- | --- |
| Source review against ASVS | Manual, by requirement | 16–18 Nov | L1: 0 Fail; L2: 84% Pass | [asvs-l1.md](./asvs-l1.md), [asvs-l2.md](./asvs-l2.md) |
| Threat modeling | STRIDE | 16 Nov, revised 18 Nov | 36 threats, 36 mitigated | [threat-model.md](./threat-model.md) |
| SAST **[C14]** | CodeQL 2.27.4 (on every PR), Semgrep 1.185.0 | 17 Nov | 44 findings: 34 real and fixed, 10 false positives explained; 0 open after the fixes | [sast-report.md](./sast-report.md) |
| DAST **[C15]** | OWASP ZAP 2.16.1, baseline and signed-in active scan (5,573 requests) | 17 Nov | No working injection, XSS or traversal; 1 real finding (missing script CSP on some 404s), fixed | [dast-report.md](./dast-report.md) |
| Dependency audit | `npm audit` in CI; Dependabot | Every PR | CI fails on high or critical advisories; the one exception is reasoned and expires 2026-12-31 | `.github/scripts/npm-audit.mjs` |
| Secret scan | `git log --all -p` pattern search | 16 Nov | No real secret in 372 commits | [logging-and-errors.md](./logging-and-errors.md#secret-scan-of-the-git-history) |
| Regression tests | Node test runner, end-to-end against a real MongoDB | Every PR (GitHub Actions) | Backend: 718 passed, 0 failed, 3 skipped (721 tests); ASVS regressions in `asvs-l1-regressions` and `asvs-l2-regressions` | `backend/test/`, `frontend/test/` |

**How a fix was verified:**
1. Each finding got a test that failed before the fix and passes after it.
2. The scan was re-run: Semgrep re-scan 0 findings; CodeQL 0 open alerts on `main`; ZAP baseline re-run.
3. Logs were checked for leaks: a full test run produced every security event, and searching that log found no passwords or tokens.

### Evidence screenshots

**TODO (#349):** add these screenshots to `docs/security/evidence/`:

- the security headers in the browser's devtools **[C13]**
- the CodeQL alerts page at 0 open **[C14]**
- the ZAP report summary **[C15]**
- a lockout response (429) and its log line **[C12]**, **[C18]**
- a 403 when an org opens an admin route **[C6]**
- a 404 when one company asks for another company's file **[C7]**
