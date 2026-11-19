# Security evidence

Proof for the criteria graded on evidence rather than code (issue #349). Everything
was captured on 19 Nov 2026 against a local stack (`docker compose up -d --build`,
`NODE_ENV=production` images, `SEED_DEMO_DATA=true`), signed in with the public demo
accounts from the README.

No cookie, token or secret value appears in any image. The cookie table hides values,
`set-cookie` and `authorization` headers are masked, and the one authenticated `curl`
shows `<org session token — hidden>` instead of the token. The CSP nonce in 01 is a
one-time value per request, not a secret.

Most shots were taken with [`capture-screenshots.js`](capture-screenshots.js) (Playwright
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
| 10-code-scanning.png *(to add)* | 14 SAST | GitHub → Security → Code scanning: 0 open alerts, plus the closed list. |
| [11a-org-opens-admin-redirected.png](screenshots/11a-org-opens-admin-redirected.png) | 6/7 Authorization | An org account that types `/admin` is redirected to `/dashboard`. |
| [11b-api-accounts-forbidden.png](screenshots/11b-api-accounts-forbidden.png) | 6/7 Authorization | `GET /api/accounts` on the backend answers 403 for an org session and 403 with no session. The admin guard runs on the server, not only in the UI. |
| [12a-google-sign-in-button.png](screenshots/12a-google-sign-in-button.png) | 5 SSO | The public login page offers Google sign-in. |
| 12b-google-sign-in-success.png *(to add)* | 5 SSO | A completed Google sign-in landing on the signed-in public view. |

## Observed while collecting

- `/search` still sends `x-powered-by: Next.js` (visible in 01), even though `next.config.ts`
  sets `poweredByHeader: false`. **Fixed afterwards:** the Docker image didn't copy
  `next.config.ts` into its final stage, so `next start` ran on Next's defaults. The header
  rules are compiled into `.next`, so only this setting was lost. Retake 01 from a rebuilt
  image to show the header gone.
- `hello@datacraft.co.th` (README, "Demo accounts") is not in a freshly seeded database. Shot 05
  locked that address anyway, which shows the lock works for unknown emails.
