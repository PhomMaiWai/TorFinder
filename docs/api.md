# API reference

Every HTTP route the TorFinder backend serves, checked against the
controllers in `backend/src/**/*.controller.ts` and the DTOs next to them.
When this page and the code disagree, the code wins; please fix this page
in the same PR.

- [How to call the API](#how-to-call-the-api)
- [Authentication and roles](#authentication-and-roles)
- [Errors, status codes and rate limits](#errors-status-codes-and-rate-limits)
- [Endpoints](#endpoints): [Health](#health) · [Auth](#auth) ·
  [Accounts](#accounts) · [TORs](#tors) · [TOR documents](#tor-documents) ·
  [Matching](#matching) · [AI](#ai) · [Feedback](#feedback) ·
  [Reports](#reports) · [Owner](#owner) · [Saved TORs](#saved-tors) ·
  [Saved searches](#saved-searches) · [Notifications](#notifications) ·
  [Imports](#imports) · [Audit](#audit)
- [Frontend route handlers](#frontend-route-handlers)
- [Known issues](#known-issues)

## How to call the API

| | Value |
| --- | --- |
| Base URL (local) | `http://localhost:4000/api` |
| Base URL (inside Docker) | `http://backend:4000/api` |
| Health check | `GET http://localhost:4000/health` (no `/api` prefix) |
| Format | JSON in and out, except file routes, which return the file |
| Validation | Unknown body fields are dropped (`whitelist: true`); query strings are converted to numbers where the DTO says so |

**Only the Next.js server calls this API.** The browser does not know
`BACKEND_URL`. Pages and Server Actions call the backend directly from the
server, and client components go through the thin proxies listed under
[Frontend route handlers](#frontend-route-handlers). If you add a feature
that the browser needs, add a route handler or a Server Action; do not
expose the backend.

```ts
// frontend, server side (a Server Action, route handler or Server Component)
import { authHeaders } from "@/lib/session-headers";

const res = await fetch(`${process.env.BACKEND_URL}/api/matching/opportunities`, {
  headers: await authHeaders(), // { Authorization: "Bearer <torr_session cookie>" }
  cache: "no-store",
});
if (!res.ok) {
  const body = await res.json().catch(() => null);
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  throw new Error(message ?? "Request failed");
}
const opportunities = await res.json();
```

Trying a route from the terminal:

```bash
# Sign in as the seeded admin and keep the token
TOKEN=$(curl -s localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bma.go.th","password":"Admin1234!"}' | jq -r .token)

curl -s localhost:4000/api/accounts?status=pending -H "Authorization: Bearer $TOKEN" | jq
```

## Authentication and roles

Sign-in (`POST /api/auth/login`, `/auth/google`) returns
`{ user, token }`. The token is an HMAC-signed session
(`backend/src/common/token.ts`) carrying `sub` (user id), `email`, `name`,
`role`, `iat` and `exp` (7 days). Send it as
`Authorization: Bearer <token>`. The frontend keeps it in the httpOnly
`torr_session` cookie.

Each protected route has one guard:

| Guard | Who passes | When refused |
| --- | --- | --- |
| none | Anyone | — |
| `Session` | Any signed-in account | 401 `กรุณาเข้าสู่ระบบ` |
| `Admin` | `role: admin` only | 403 |
| `Org` | `role: org` only | 403 |
| `Owner` | `role: owner` only | 403 |
| `Auditor` | `role: auditor` only | 403 |

A role guard admits exactly one role: an admin cannot call an `Owner` or
`Auditor` route. Every guard also refuses a token issued before the
account's last logout, password reset, role change or suspension
(`SessionRevocationService`, cached for 30 seconds).

Roles: `admin`, `org` (software company), `owner` (agency), `auditor`
(สตง.), `viewer` (public user signed in with Google).

## Errors, status codes and rate limits

Errors use NestJS's default shape. `message` is a string, or an array of
strings when body validation fails. All user-facing messages are in Thai.

```json
{ "statusCode": 400, "message": ["อีเมลไม่ถูกต้อง"], "error": "Bad Request" }
```

| Status | Meaning here |
| --- | --- |
| 200 | OK |
| 201 | Created. Every `POST` returns 201 unless the table says otherwise |
| 202 | Accepted, still running (`POST /gproc/capture`) |
| 204 | Done, no body |
| 400 | Body or query failed validation, or a business rule refused it |
| 401 | No valid session (`Session` guard, wrong password) |
| 403 | Wrong role, revoked token, or account not allowed to sign in |
| 404 | Record not found, or an id that is not a valid ObjectId |
| 409 | Duplicate (email, saved search name, similar TOR) or the record changed under you |
| 429 | Rate limit hit |
| 503 | Vertex AI is not configured |

Rate limits (`@nestjs/throttler`, in memory, per IP):

| Applies to | Default | Env vars |
| --- | --- | --- |
| Every route | 100 requests per 60 s | `THROTTLE_LIMIT`, `THROTTLE_TTL_MS` |
| Sign-in, sign-up, password and email routes, public feedback, public reports | 5 per 60 s | `AUTH_THROTTLE_LIMIT`, `AUTH_THROTTLE_TTL_MS` |
| `POST /ai/proposal-draft/:torId` | 5 per 60 s | fixed |

## Endpoints

Paths below are relative to `/api`. "Guard" is from the table above.

### Health

| Method | Path | Guard | Response |
| --- | --- | --- | --- |
| GET | `/health` (no `/api`) | none | `{ ok: true }` |

### Auth

`backend/src/auth/auth.controller.ts`. Every route here except `logout`
has the 5-per-minute limit.

| Method | Path | Guard | Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/signup` | none | `SignupDto` | 201 `{ status: "pending", companyName }`; sends a verification email |
| POST | `/auth/login` | none | `{ email, password }` | 200 `{ user: { id, email, name, role }, token }` |
| POST | `/auth/logout` | Session | — | 200; revokes every token of this account |
| POST | `/auth/google` | none | `{ credential, as?: "viewer" }` | 200 `{ user, token }`, or `{ status: "needs-company-info", email, name }`, or `{ status: "pending", companyName }` |
| POST | `/auth/google/complete` | none | `GoogleCompleteSignupDto` | 200 `{ status: "pending", companyName }` |
| POST | `/auth/password/forgot` | none | `{ email }` | 200 `{ ok: true }` whether or not the email exists |
| POST | `/auth/password/reset` | none | `{ token, password }` | 200 `{ ok: true }` |
| POST | `/auth/email/verify` | none | `{ token }` | 200 `{ ok: true, status }` |
| POST | `/auth/email/resend` | none | `{ email }` | 200 `{ ok: true }` |

`SignupDto`: `email`, `password` (8-128, not a common password),
`companyName` (1-200), `taxId` (valid Thai 13-digit tax id), `contactName`
(1-200), `phone` (Thai phone), and optional `address` (≤500), `specialty`
(≤200), `size` (≤50). `GoogleCompleteSignupDto` is the same without email
and password, plus `credential` (the Google ID token).

Login refusals, in the order they are checked: 401 wrong email or
password; 403 with `code: "email-unverified"`; 403 pending; 403 rejected;
403 suspended.

### Accounts

`backend/src/accounts/accounts.controller.ts`. Account objects never
include password fields. Their shape is
`{ id, email, name, role, status, suspended?, createdAt, reviewedAt?, lastLoginAt?, company? }`.

| Method | Path | Guard | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/accounts` | Admin | `?status=pending\|approved\|rejected` | Company accounts |
| GET | `/accounts/directory` | Admin | — | Every account, newest first |
| GET | `/accounts/me` | Session | — | Own account |
| PATCH | `/accounts/me` | Session | `UpdateCompanyProfileDto` | Own account, updated |
| PATCH | `/accounts/:id` | Admin | `{ status: "approved" \| "rejected" }` | The company account; notifies it and writes the audit log |
| PATCH | `/accounts/:id/details` | Admin | `{ name?, role?: "admin"\|"owner"\|"auditor"\|"viewer" }` | The account. A company's role can't be changed (400); the last admin can't be demoted (409) |
| PATCH | `/accounts/:id/suspend` | Admin | — | The account; its sessions are revoked |
| PATCH | `/accounts/:id/reactivate` | Admin | — | The account |

`UpdateCompanyProfileDto` (all optional): `companyName`, `taxId` (both can
only be filled once, when still blank), `contactName`, `phone`, `address`,
`specialty`, `size`, `techStack[]`, `pastExperience`, `workTypes[]`,
`certifications[]`, `largestPastContract`, `registeredCapital`,
`preferredBudgetMin`, `preferredBudgetMax` (integers 0 to 100,000,000,000),
`matchAlerts` (bool), `matchThreshold` (40-95).

- `workTypes`: `development`, `web`, `mobile`, `erp`, `eservice`,
  `maintenance`, `helpdesk`, `license`, `consulting`, `hardware`,
  `peripherals`, `network`, `datacenter`, `security`, `data`, `ai`, `gis`,
  `health`, `education` (`backend/src/matching/work-types.ts`).
- `certifications`: `iso29110`, `cmmi3`, `cmmi5`, `iso12207`, `iso25010`,
  `iso27001`, `iso27701`, `iso27017`, `iso27018`, `pcidss`, `csastar`, …
  (full list in `backend/src/matching/requirements.ts`).

### TORs

`backend/src/tor/tor.controller.ts`. Listings leave out soft-deleted
records and records marked `not-software`.

| Method | Path | Guard | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/tor` | none | `?source=manual\|egp\|gproc\|mea\|datagov&page=1&pageSize=20` (max 100) | Array of TORs, interleaved across stages so each page has every stage. Adds `bidding`, `currentStage`, `timeline`; leaves out `extraction` |
| GET | `/tor/:id` | none | — | One TOR with `extraction` (plus `assessment` of its confidence), `documents[]` (with `viewable`, `archive`), `bidding`, `timeline` |
| POST | `/tor` | Admin | `CreateTorDto` | 201 the new TOR. 409 if a similar title from the same agency exists. Sends match alerts |
| PATCH | `/tor/:id` | Admin | `UpdateTorDto` | The TOR. Changed fields are added to `lockedFields`, so imports stop overwriting them |
| PUT | `/tor/:id/owner` | Admin | `{ ownerId: "<user id>" \| null }` | Links the TOR to an `owner` account, or unlinks it |
| DELETE | `/tor/:id` | Admin | — | Soft delete (sets `deletedAt`) |
| POST | `/tor/:id/restore` | Admin | — | Undoes the soft delete |
| GET | `/tor/deleted` | Admin | — | Hidden TORs, newest first |
| GET | `/tor/not-software` | Admin | — | TORs an admin marked `not-software` |
| GET | `/tor/flagged` | Auditor | `?flag=budget-high\|budget-low\|competition&page&pageSize` | `{ total, page, pageSize, items }` |

`CreateTorDto`: `title`, `agency`, `budget` (display text), `deadline`,
`daysLeft` (int ≥ 0), `tags[]`, `stage`, `summary`, optional
`budgetStatus`. `UpdateTorDto`: the same fields, all optional, plus
`classification: "software" | "not-software"`.

- `stage`: `แผนการจัดซื้อจัดจ้าง`, `เปิดรับฟังความคิดเห็น`,
  `ประกาศราคากลาง`, `ประกาศ TOR` (the invitation), `ประกาศผู้ชนะ`.
- `budgetStatus`: `สูงกว่าปกติ`, `ต่ำกว่าปกติ`, `ปกติ`.

### TOR documents

All public. They return the file itself (`Content-Disposition: inline`, or
`attachment` with `?download=1`) and are cached for a day.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/tor/:id/documents/:index` | File number `index` from the TOR's `documents[]`, streamed from the source |
| GET | `/tor/:id/documents/:index/entries` | The PDFs and images inside that file when it is a ZIP |
| GET | `/tor/:id/documents/:index/entries/:entry` | One file from inside the ZIP |
| GET | `/tor/:id/egp-documents` | Documents the national e-GP has for this project: `[{ kind, label, archive }]` |
| GET | `/tor/:id/egp-documents/:kind` | `kind=invitation`: the invitation PDF |
| GET | `/tor/:id/egp-documents/:kind/entries` | `kind=bundle\|draft-bundle`: files inside the bundle |
| GET | `/tor/:id/egp-documents/:kind/entries/:entry` | One file from the bundle |

### Matching

`backend/src/matching/matching.controller.ts`. Scores are 0-100 and come
from fixed rules (`matching.scoring.ts`), not from AI.

| Method | Path | Guard | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/matching/opportunities` | Session | — | Up to 100 TORs for the caller's company, open first, then by score. Each has `match`, `reasons[]`, `gaps[]`, `eligibility[]`, `eligible`. 404 if the account has no company profile |
| GET | `/matching/tor/:id/companies` | Admin | — | Every approved company ranked for this TOR: `[{ companyName, workTypes, score, reasons, gaps, eligibility, eligible }]` |
| POST | `/matching/tor/:id/score` | none | `ScoreMatchDto` | `{ score, reasons, gaps, eligibility, eligible }` for a profile sent in the body |
| GET | `/matching/tor/:id/budget` | none | — | `{ status, budget, median, peerCount, ratio, notes[] }` |
| GET | `/matching/tor/:id/bid-insight` | none | — | Suggested discount and competition from past awards (`BidInsight` in `bid-insight.ts`) |
| POST | `/matching/budget/refresh` | Admin | — | 201 `{ assessed, flagged }`; recomputes every TOR's `budgetStatus` |

`ScoreMatchDto`: `companyName` (required), `workTypes[]`, and optional
`largestPastContract`, `registeredCapital`, `certifications[]`,
`preferredBudgetMin`, `preferredBudgetMax`.

### AI

`backend/src/ai/ai.controller.ts`. Routes that call the model return 503
when `VERTEX_PROJECT_ID` is not set.

| Method | Path | Guard | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/ai/status` | none | — | `{ configured, model, location }` |
| POST | `/ai/extract` | Admin | — | 201 `{ attempted, extracted, skipped, failed }`; reads every pending TOR up to the run's budget |
| POST | `/ai/extract/:torId` | Admin | — | 201 the stored extraction for one TOR |
| POST | `/ai/proposal-draft/:torId` | Org | `{ previousProposal }` (200-20,000 chars) | 200 `{ sections: [{ heading, body }], gaps[] }` |

### Feedback

`backend/src/feedback/feedback.controller.ts`. Comment statuses are
`รอตรวจสอบ` (pending), `อนุมัติ` (approved), `ปฏิเสธ` (rejected).

| Method | Path | Guard | Body / query | Response |
| --- | --- | --- | --- | --- |
| POST | `/tor/:torId/feedback` | none (5/min) | `{ text (10-5000), author? (≤200) }` | 201 the comment, status `รอตรวจสอบ`. 400 after the hearing deadline |
| GET | `/tor/:torId/feedback` | none | `?status=` | Approved comments by default; another status if asked (see [Known issues](#known-issues)) |
| GET | `/feedback/counts` | none | — | `{ "<torId>": <approved count> }` |
| GET | `/feedback` | Admin | `?status=` | Moderation queue across all TORs |
| PATCH | `/feedback/:id` | Admin | `{ status }` | The comment; writes the audit log |

### Reports

`backend/src/reports/reports.controller.ts`.

| Method | Path | Guard | Body / query | Response |
| --- | --- | --- | --- | --- |
| POST | `/tor/:torId/reports` | none (5/min) | `{ reason, message (10-2000), contact? (≤200) }` | 201 the report. If a valid Bearer token is sent, the reporter is recorded from it |
| GET | `/reports` | Admin | `?status=open\|resolved&page&pageSize` | `{ total, page, pageSize, items }`, each with `torTitle` |
| GET | `/reports/:id` | Admin | — | One report with `torTitle` |
| PATCH | `/reports/:id` | Admin | `{ status: "open"\|"resolved", fixed?: bool }` | The report. `fixed: true` logs it as "TOR corrected for this report" |

`reason`: `wrong-info`, `not-software`, `broken-link`, `duplicate`,
`other`.

### Owner

| Method | Path | Guard | Response |
| --- | --- | --- | --- |
| GET | `/owner/tors` | Owner | `{ totals: { tors, matches, feedback: { approved, pending, rejected } }, items: [{ id, title, agency, budget, deadline, daysLeft, stage, createdAt, matchCount, topScore, feedback }] }` for TORs linked to the caller |

### Saved TORs

All `Session`. Identity always comes from the token.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/saved-tors` | — | Array of saved TOR ids |
| POST | `/saved-tors/:torId` | — | 204 |
| DELETE | `/saved-tors/:torId` | — | 204 |
| POST | `/saved-tors/import` | `{ torIds: string[] }` (≤500) | 200 the full saved list after merging (used to move a guest's local bookmarks into the account) |

### Saved searches

All `Session`. At most 50 per account; names are unique per account.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/saved-searches` | — | Own saved searches |
| POST | `/saved-searches` | `{ name (1-100), filters: { query?, sort?, statuses[]?, deadline?, years[]?, agencies[]?, budgets[]? } }` | 201 the saved search; 409 duplicate name or over the limit |
| DELETE | `/saved-searches/:id` | — | 204 |

### Notifications

All `Session`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/notifications` | — | Own notifications, newest first: `[{ id, type, title, message, torId?, score?, read, createdAt }]` |
| PATCH | `/notifications/:id/read` | — | 204 |
| PATCH | `/notifications/read-all` | — | 204 |
| GET | `/notifications/channels` | — | `{ email, slackWebhookUrl?, lineUserId? }` |
| PUT | `/notifications/channels` | `{ email?: bool, slackWebhookUrl?: "https://hooks.slack.com/services/..." \| "", lineUserId?: "U…32 hex" \| "" }` | The channels. An empty string turns a channel off |
| POST | `/notifications/channels/test` | — | 200 `[{ channel, ok, error? }]` after sending a test to each channel that is on |

`type`: `match`, `approval`, `feedback`, `system`.

### Imports

All `Admin`. Each sync is also run on a timer; a manual call joins a run
that is already going. See [pipeline.md](./pipeline.md) for what each
source does.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/egp/sync` | — | 200 `{ fetched, imported, updated, skipped, superseded, failed[] }` |
| POST | `/mea/sync` | — | 200, same shape |
| POST | `/datagov/sync` | — | 200, same shape |
| POST | `/gproc/capture` | `{ projectNumbers: string[] }` (1-100, each 11 digits) | 202 `{ id, status: "running", startedAt, total, counts, notes[] }` |
| GET | `/gproc/capture/:runId` | — | The same run object, `status` now `running`, `done` or `failed` |
| GET | `/egp/metrics` | — | `{ status, lastRunAt, importedToday, history[] }` |
| GET | `/egp/near-misses` | — | Titles the software filter turned down that still look like IT work |

### Audit

| Method | Path | Guard | Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/audit` | Admin | `action?`, `actor?`, `from?` / `to?` (`YYYY-MM-DD`), `page`, `pageSize` (≤100) | `{ items: [{ action, detail, actor, type: "manual"\|"auto", date }], total, page, pageSize, actions[] }`. Admin actions and e-GP sync runs in one feed |

## Frontend route handlers

The browser calls these on the Next.js server (`frontend/src/app/api`).
Each one reads the `torr_session` cookie and forwards the request to the
backend route of the same name. `frontend/src/proxy.ts` refuses every
`/api/*` call without a session with 401, except the ones marked public.

| Route handler | Methods | Backend route | Public |
| --- | --- | --- | --- |
| `/api/auth/login` | POST | `/auth/login`; sets the cookie | ✓ |
| `/api/auth/logout` | POST | `/auth/logout`; clears the cookie | ✓ |
| `/api/auth/me` | GET | none; reads the cookie | ✓ |
| `/api/auth/google` | POST | `/auth/google`; sets the cookie | ✓ |
| `/api/auth/google/complete` | POST | `/auth/google/complete` | ✓ |
| `/api/accounts/me` | GET, PATCH | `/accounts/me` | |
| `/api/ai/proposal-draft/[torId]` | POST | `/ai/proposal-draft/:torId` | |
| `/api/gproc/capture`, `/[runId]` | POST, GET | `/gproc/capture` | |
| `/api/notifications`, `/[id]/read`, `/read-all`, `/channels`, `/channels/test` | as backend | `/notifications/...` | |
| `/api/saved-searches`, `/[id]` | GET, POST, DELETE | `/saved-searches` | |
| `/api/saved-tors`, `/[torId]`, `/import` | GET, POST, DELETE | `/saved-tors` | |
| `/api/tor/[id]/documents/...` | GET | `/tor/:id/documents/...` | ✓ |
| `/api/tor/[id]/egp-documents/...` | GET | `/tor/:id/egp-documents/...` | ✓ |
| `/api/tor/[id]/panel` | GET | `/matching/tor/:id/companies` + `/tor/:id/feedback` in one call | |
| `/api/test-db` | GET | none; talks to MongoDB directly | |

Everything else (sign-up, TOR create and edit, admin actions, feedback,
reports) goes through Server Actions in `frontend/src/app/**/actions.ts`
or is fetched by Server Components.

## Known issues

Found while writing this page. They are listed here so the page is honest
about the current code, not because they are intended.

1. **`GET /tor/:torId/feedback?status=รอตรวจสอบ` is public.** The status
   filter exists for the moderation view, but the route has no guard, so
   anyone can read comments that are still waiting for review or were
   rejected. It should require `Admin` when `status` is anything other
   than `อนุมัติ`.
2. **`/api/test-db` (frontend) lists MongoDB collections** to any signed-in
   user, using its own Mongo connection (database `torfinder`, not
   `torr`). It looks like leftover setup code and can be deleted along
   with the unused `mongodb` dependency in `frontend/package.json`.
3. **`/api/tor/[id]/panel` looks unused.** No page calls it any more, and
   it asks the Admin-only `GET /matching/tor/:id/companies`, so for anyone
   but an admin the company list comes back empty. It can probably be
   deleted.
4. **Rate limits are per process.** With more than one backend instance,
   each one counts separately (see
   [deployment-checklist.md](./deployment-checklist.md)).
