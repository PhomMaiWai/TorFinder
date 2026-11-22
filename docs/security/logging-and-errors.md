# Security logging and error handling

How TorFinder records security events and answers errors (ASVS 5.0 chapter V16, Level 2). Threat model items R1 (sign-in events not logged) and I3 (error details reaching clients).

## Security events

Every event is one structured record on the `Security` logger. In production (`NODE_ENV=production`) the backend logs JSON, one object per line, so a log collector can filter on `event` and `outcome`:

```json
{"level":"warn","timestamp":1794832778643,"context":"Security","message":{"ts":"2026-11-16T12:39:38.643Z","event":"auth.login","outcome":"failure","email":"nobody@example.com","ip":"::1","reason":"unknown_account"}}
```

Code: `backend/src/common/security-log.ts` (`logSecurityEvent`).

| Event | When | Reasons on failure |
| --- | --- | --- |
| `auth.login` | Password sign-in | `bad_credentials`, `unknown_account`, `email_unverified`, `account_pending`, `account_rejected`, `account_suspended` |
| `auth.login.locked` | The per-email lock refuses a login or password change | `too_many_failures` |
| `auth.google` | Google sign-in or Google sign-up completion | `invalid_google_token`, `email_not_verified_by_google`, plus the account states above |
| `auth.logout` | Logout (all sessions revoked) | — |
| `auth.signup` | Organization sign-up | — |
| `auth.password.change` | Signed-in password change | `wrong_current_password` |
| `auth.password.reset.request` | Forgot-password form (logged for every address; the response never differs) | `unknown_account`, `suspended_no_mail` |
| `auth.password.reset` | Reset link used | `invalid_or_expired_link` |
| `auth.email.verify` | Email verification link used | `invalid_or_expired_link` |
| `access.denied` | A session or role guard refuses a request | `no_token`, `invalid_token`, `revoked_token`, `wrong_role` |
| `line.webhook.bad_signature` | A call to `POST /api/line/webhook` without a valid `X-Line-Signature` (refused with 401) | — |
| `rate.limited` | Any 429 from the rate limiter | `limit_<n>_per_<s>s` |

Every record carries `ts` (UTC ISO time), `event` and `outcome`, and when known `userId`, `email`, `role`, `ip` (the client address, see `trust proxy` in `backend/src/main.ts`), `method` and `path` (without the query string).

**Never logged:** passwords, session tokens, reset or verification links, cookies. Each field passes through `JSON.stringify` and is capped at 254 characters, so input such as an email containing a newline cannot forge or flood a log line.

Admin actions (approve, suspend, edit TOR, role change) are recorded separately in the audit log, readable at `/admin/audit`.

**Checked on 2026-11-16:** a full backend test run produced every event type above with the expected reasons, and a search of that log found none of the test passwords and no session tokens.

## Error handling

`backend/src/common/all-exceptions.filter.ts` handles every error the API returns:

- **Expected errors** (`HttpException`: 400 validation, 401, 403, 404, 429) keep Nest's normal body, because their messages are written for the user.
- **Unexpected errors** (bugs, outages) are logged in full on the server, including the stack, under a fresh `errorId`. The client receives only a generic message and that `errorId`, never the stack, query or connection details:

  ```json
  {"statusCode":500,"message":"เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง","errorId":"6f1c…"}
  ```
- Every 5xx is logged, including upstream portal failures (502).

The frontend's error pages (`app/error.tsx`, `app/admin/error.tsx`, `app/owner/error.tsx`) never display the error message; Next.js production builds pass only a digest to the browser.

Tests: `backend/test/security-logging.test.mjs`.

## Secret scan of the git history

Run on 2026-11-16 over all 372 commits on every branch (`git log --all -p`), threat model item I4.

| Pattern searched | Result |
| --- | --- |
| `.env`, `.pem`, `.key`, credential or service-account files ever added | None |
| MongoDB URIs with credentials | Only the local `torr`/`torr` default and the `.env` template |
| `SESSION_SECRET`, `JWT_SECRET` assignments | Only the public dev placeholder, the CI test value, and `process.env` references |
| Google, AWS, GitHub, Resend, OpenAI/Anthropic, Slack keys; private-key blocks | None |
| Passwords | Test passwords in test files and the demo seed passwords, which the README publishes on purpose and are opt-in |

**Result: no real secret has ever been committed.** The repository is public, so this matters: anything committed stays in history even after deletion.

GitHub secret scanning and push protection are **on** for this repository (since 21 Nov 2026), with 0 open alerts. GitHub scans every commit for known secret formats, and push protection refuses a push that contains one.
