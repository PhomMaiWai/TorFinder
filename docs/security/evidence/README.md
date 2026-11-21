# Security evidence

Proof for the criteria graded on evidence rather than code (issue #349). Everything
was captured on 19 Nov 2026 against a local stack (`docker compose up -d --build`,
`NODE_ENV=production` images, `SEED_DEMO_DATA=true`), signed in with the public demo
accounts from the README.

No cookie, token or secret value appears in any image. The cookie table hides values,
`set-cookie` and `authorization` headers are masked, and the one authenticated `curl`
shows `<org session token — hidden>` instead of the token. The CSP nonce in 01 is a
one-time value per request, not a secret.

Shots 14–16 were taken on 20 Nov 2026 on a stack with internal TLS (#401). Most shots were taken with [`capture-screenshots.js`](capture-screenshots.js) (Playwright
driving Google Chrome), so they can be re-taken the same way. Headers and cookies are what
Chrome received, shown as a table rather than the DevTools panel.

## Screenshots

| File | Criterion | What it proves |
| --- | --- | --- |
| [01-headers-search-page.png](screenshots/01-headers-search-page.png) | 13 HTTP headers | `/search` is served with a per-request nonce CSP (`'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'self'`), `strict-transport-security`, `x-content-type-options: nosniff`, `referrer-policy`, and `cache-control: private, no-cache, no-store`. |
| [02-headers-api-auth-me.png](screenshots/02-headers-api-auth-me.png) | 13 HTTP headers | An API answer carrying account data is `cache-control: no-store` with `content-type: application/json; charset=utf-8`. |
| [03-session-cookie-flags.png](screenshots/03-session-cookie-flags.png) | 9 Session cookie (ASVS 3.3) | The session cookie is `__Host-torr_session`, with HttpOnly ✓, Secure ✓, SameSite=Lax and Path=/ and no Domain. The `__Host-` prefix makes the browser enforce the last three. |
| [04-cors-allowlist.png](screenshots/04-cors-allowlist.png) | 10 CORS | The backend allows exactly one origin (`enableCors({ origin: env.frontendOrigin })`). A request from `https://evil.example` is still answered with `Access-Control-Allow-Origin: http://localhost:3000`, which doesn't match, so the browser refuses to hand the response to the foreign page. |
| [05-login-lockout.png](screenshots/05-login-lockout.png) | 18 Rate limiting | Repeated wrong passwords for one email lock it for 15 minutes with `ลองเข้าสู่ระบบผิดหลายครั้งเกินไป…`. The lock applies to unknown emails too, so it doesn't reveal which accounts exist (see 08: `unknown_account`). |
| [06-idle-session-timeout.png](screenshots/06-idle-session-timeout.png) | 18 Session timeout | After the idle limit, opening `/matches` lands on `/login?next=%2Fmatches`. **Taken with `SESSION_IDLE_MINUTES=1` and 75 s idle** so it fits a screenshot; the default is 30 minutes. |
| [07a-signup-breached-password.png](screenshots/07a-signup-breached-password.png) | 18 Password policy | Signup refuses `password123` as a common/breached password. |
| [07b-signup-context-password.png](screenshots/07b-signup-context-password.png) | 18 Password policy | Signup refuses `TorFinder2026!` as a context-specific password (the system's name plus padding). |
| [08-security-log-json.png](screenshots/08-security-log-json.png) | 12 Security logging | One JSON object per line on the `Security` logger: `auth.login` failures, `auth.login.locked` (`too_many_failures`), `rate.limited`, `auth.login` success, and `access.denied` for both `no_token` and `wrong_role`. |
| [09-generic-500-with-error-id.png](screenshots/09-generic-500-with-error-id.png) | 11 Error handling | With MongoDB stopped (`docker compose stop db`), `GET /api/tor` returns only a generic Thai message and an `errorId`. The same `errorId` in the server log carries the exception name, message and stack. The database was restarted afterwards. |
| [10-code-scanning.png](screenshots/10-code-scanning.png) | 14 SAST | GitHub → Security and quality → Code scanning on `main`: **0 open, 28 closed** alerts; CodeQL runs on every PR, and the closed alerts are fixed or explained in [sast-report.md](../sast-report.md). Taken 20 Nov 2026 in a signed-in browser. |
| [11a-org-opens-admin-redirected.png](screenshots/11a-org-opens-admin-redirected.png) | 6/7 Authorization | An org account that types `/admin` is redirected to `/dashboard`. |
| [11b-api-accounts-forbidden.png](screenshots/11b-api-accounts-forbidden.png) | 6/7 Authorization | `GET /api/accounts` on the backend answers 403 for an org session and 403 with no session. The admin guard runs on the server, not only in the UI. |
| [12a-google-sign-in-button.png](screenshots/12a-google-sign-in-button.png) | 5 SSO | The public login page offers Google sign-in. |
| [13a-admin-role-needs-approval.png](screenshots/13a-admin-role-needs-approval.png) | ASVS 2.3.5 Two-admin approval | Taken 20 Nov 2026. `admin@bma.go.th` sets `owner@bma.go.th` to Administrator; the form says the change needs another administrator's approval before it takes effect. |
| [13b-requester-can-only-cancel.png](screenshots/13b-requester-can-only-cancel.png) | ASVS 2.3.5 Two-admin approval | After saving, the role is unchanged and a pending request appears. Its requester sees "รอผู้ดูแลระบบคนอื่นอนุมัติ" (waiting for another administrator) and can only cancel; it expires after 48 h. |
| [13c-second-admin-notified.png](screenshots/13c-second-admin-notified.png) | ASVS 2.3.5 Two-admin approval | `admin2@bma.go.th` is notified that a request is waiting. |
| [13d-second-admin-approve-reject.png](screenshots/13d-second-admin-approve-reject.png) | ASVS 2.3.5 Two-admin approval | A different admin sees the same request with Approve and Reject (both behind passkey step-up). |
| [13e-approved-role-changed.png](screenshots/13e-approved-role-changed.png) | ASVS 2.3.5 Two-admin approval | Only after the second admin approves is `owner@bma.go.th` an Administrator. |
| [13f-audit-log-approval-steps.png](screenshots/13f-audit-log-approval-steps.png) | ASVS 2.3.5 Two-admin approval | The audit log has the request (by `admin@`), the approval and the role change (by `admin2@`), each naming who asked and who approved. The account was afterwards returned to Project owner through the same flow. |
| [12b-google-sign-in-success.png](screenshots/12b-google-sign-in-success.png) | 5 SSO | A completed Google sign-in with a real Google account on the local stack, landing on the company dashboard (the account is an approved company registered through Google sign-up). The backend logged `auth.google` success for it, and the token's nonce matched this browser (ASVS 10.1.2). The account's name and email are blanked out because the repository is public. The sidebar header shows "Arun Digital" for every company account; that's a display bug, noted below. |
| [14a-signed-in-devices.png](screenshots/14a-signed-in-devices.png) | ASVS 7.5.2 Session management | Taken 20 Nov 2026. A company signed in on a Mac and an iPhone sees both on `/account` (browser, time, address), with this one marked. The address is the Docker network's, because there is no reverse proxy in front locally. |
| [14b-end-sessions-needs-password.png](screenshots/14b-end-sessions-needs-password.png) | ASVS 7.5.2 Session management | "Sign out all other devices" asks for the current password first. |
| [14c-wrong-password-refused.png](screenshots/14c-wrong-password-refused.png) | ASVS 7.5.2 Session management | A wrong password ends nothing; every session is still listed. |
| [14d-other-sessions-ended.png](screenshots/14d-other-sessions-ended.png) | ASVS 7.5.2 Session management | With the right password, only this device is left. |
| [14e-phone-sent-to-sign-in.png](screenshots/14e-phone-sent-to-sign-in.png) | ASVS 7.5.2 Session management | The phone's next page load (`/matches`) goes to sign-in: the frontend asks the backend on each full page load whether the session is still open, and drops the cookie when it isn't. |
| [14f-ended-session-refused.png](screenshots/14f-ended-session-refused.png) | ASVS 7.5.2 Session management | A copy of the phone's old cookie, sent again by hand, gets 401 for its notifications, saved TORs and saved searches. The cookie's value is not shown. |
| [15a-admin-sign-out-buttons.png](screenshots/15a-admin-sign-out-buttons.png) | ASVS 7.4.5 Session management | Manage Users, filtered to the demo company: "Sign out" on the account, and "Sign out everyone" above the list. |
| [15b-admin-sign-out-everyone-confirm.png](screenshots/15b-admin-sign-out-everyone-confirm.png) | ASVS 7.4.5 Session management | "Sign out everyone" asks to confirm first; it was cancelled here. |
| [15c-admin-signed-account-out.png](screenshots/15c-admin-signed-account-out.png) | ASVS 7.4.5 Session management | The admin signs Arun Digital out on every device. |
| [15d-admin-sign-out-logged.png](screenshots/15d-admin-sign-out-logged.png) | 12 Security logging | The sign-out is logged as `admin.sessions.revoke` with the account and the admin's id. |
| [16-mutual-tls.png](screenshots/16-mutual-tls.png) | ASVS 12.3.3, 12.3.5 Secure communication | The backend starts with HTTPS and client certificates required, and the backend's database login is its certificate. Without a client certificate, the backend's TLS handshake fails ("certificate required"). With a certificate from our CA that isn't the frontend's, it answers 403, with no `X-Powered-By` header. MongoDB closes connections without TLS, and over TLS without a client certificate. |
| [17-https-edge.png](screenshots/17-https-edge.png) | ASVS 4.1.2, 4.2.1, 12.1.2 Secure communication | The Caddy edge, run locally on ports 18080/18443: a page over plain HTTP gets 308 to HTTPS while an API call gets 403. Requests with ambiguous framing are refused (400, 400, 501). TLS 1.1 and non-forward-secret suites are refused; only ECDHE AEAD and TLS 1.3 connect. The framing probes are [`edge-framing.py`](edge-framing.py). |
| [18-hardening-services.png](screenshots/18-hardening-services.png) | ASVS 5.4.3, 13.2.5, 13.3.1, 16.4.2, 16.4.3 | With `docker-compose.hardening.yml`: the backend reaches a portal only through the allowlist proxy, which refuses `example.com`, and nothing at all without it. ClamAV passes an ordinary PDF and refuses the EICAR test file (422). The backend's and frontend's logs are in a separate store whose volume only it mounts. The apps' secrets come from the vault, one file per service, with the compose variable empty. The probe is [`virus-probe.js`](virus-probe.js). |
| [19-zap-summary.png](screenshots/19-zap-summary.png) | 15 DAST | The summary of the signed-in ZAP active scan ([zap-full.html](zap-full.html)): 1 High, 1 Medium, 1 Low, 4 Informational. The High ("PII Disclosure") is a false positive, a 12-digit contract number that passes the card checksum; every alert's decision is in [dast-report.md](../dast-report.md). |
| [20-cross-company-file-refused.png](screenshots/20-cross-company-file-refused.png) | 7 Authorization (ASVS 8.2.2) | Taken 21 Nov 2026. Arun Digital uploads a test certificate; the same file URL gives the owner 200 (the PDF), a second company 404 and no session 401. The second company is a throwaway account ([`temp-company.js`](temp-company.js)), and both it and the test certificate are deleted afterwards. |

## Observed while collecting

- The company sidebar header always says "Arun Digital" (`frontend/src/components/layout/app-sidebar.tsx`), whichever company is signed in; visible in 12b. It's a display bug only: the data on the page is the signed-in company's own.

- `/search` still sends `x-powered-by: Next.js` (visible in 01), even though `next.config.ts`
  sets `poweredByHeader: false`. **Fixed afterwards:** the Docker image didn't copy
  `next.config.ts` into its final stage, so `next start` ran on Next's defaults. The header
  rules are compiled into `.next`, so only this setting was lost. Retake 01 from a rebuilt
  image to show the header gone.
- `hello@datacraft.co.th` (README, "Demo accounts") is not in a freshly seeded database. Shot 05
  locked that address anyway, which shows the lock works for unknown emails.
