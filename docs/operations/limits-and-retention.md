# Limits, retention and secrets

How TorFinder limits its connections to other systems, how long it keeps data, and when its secrets are rotated. This file is the documented configuration that ASVS 5.0 asks for in 13.1.2, 13.1.3, 13.1.4, 13.2.6 and 14.2.7 ([asvs-l3.md](../security/asvs-l3.md)). Every number below is a default in the code; the variable next to it overrides it in `.env`.

## Connections to other systems

(ASVS 13.1.2, 13.2.6)

| Service | Most at once | At the limit | Setting |
| --- | --- | --- | --- |
| MongoDB | 50 connections per backend process | A query waits for a free connection; after 10 s it fails and the caller gets the generic 500. No server reachable for 10 s: the same | `MONGO_MAX_POOL_SIZE`, `MONGO_WAIT_QUEUE_TIMEOUT_MS`, `MONGO_SERVER_SELECTION_TIMEOUT_MS` (`database.service.ts`) |
| e-GP portal | 5 requests in flight (2 for award searches) | Further requests queue in the importer | `EGP_CONCURRENCY` |
| data.go.th | 5 searches in flight | Queue in the importer | `SEARCH_CONCURRENCY` in `datagov.service.ts` |
| MEA portal | One list request per announcement type; detail pages 5 in flight | Detail reads queue, and stop at the enrichment time budget | `MEA_ENRICHMENT` in `mea.constants.ts` |
| gProc portal | One project at a time (2 requests each), with a pause between projects | Stops after a run of consecutive failures (circuit breaker) | `GPROC_REQUEST` in `gproc.constants.ts` |
| Vertex AI | One extraction batch at a time; drafts 5 per minute per client | Further drafts get 429 | Scheduler; route throttle |
| Resend (email), LINE, Slack | One request per message | Each send stands alone; failures are logged | Notification code |
| Frontend → backend | No pool limit (Node's default agent) | Each call has an 8–10 s timeout | `frontend/src/lib/*.ts` |

Requests coming in are limited too: 100 per minute per client on the API (`THROTTLE_LIMIT`), 5 per minute on sign-in, sign-up and reset (`AUTH_THROTTLE_LIMIT`), and 10 wrong passwords per address per 15 minutes (`LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_MS`).

## Timeouts, retries and back-off

(ASVS 13.1.3)

| Call | Timeout | Retries | Back-off and budget |
| --- | --- | --- | --- |
| e-GP, MEA, gProc list pages | 30 s per attempt | 3 | Exponential, 500 ms × 2ⁿ (`common/http-client.ts`) |
| e-GP and MEA detail pages | 8 s | 1 | e-GP enrichment stops after 45 s in total (`EGP_ENRICH_BUDGET_MS`); the rest waits for the next run |
| gProc document bundle | 120 s | 3 | As above |
| data.go.th | 20 s | 3 | As above |
| A whole scheduled sync that throws | — | 3 attempts | 5 s, then 10 s; then admins are alerted (`common/sync-scheduler.ts`) |
| Relaying a portal document or archive | 60 s | 0 | 40 MB cap; the user retries |
| Vertex AI | 120 s | 3 on retryable errors | A failed document is retried after 24 h, not every run |
| Resend, LINE, Slack | 8 s | 0 | Failure is logged; the user's action still succeeds |
| Google sign-in token check | Library default | 0 | Sign-in fails with a message |

## How long data is kept

(ASVS 14.2.7, and the retention gap in L2 14.2.4)

MongoDB deletes these by itself through TTL indexes, about once a minute after they fall due (`DatabaseService.applyRetention`). Setting a period to `0` keeps that data indefinitely.

| Data | Kept for | Why | Setting |
| --- | --- | --- | --- |
| Password-reset and email-check links | 1 h / 24 h, deleted on use | A live link is a key to the account | Fixed (`authTokens`) |
| Passkey challenges | 5 min, deleted on use | Single use | Fixed (`authTokens`) |
| Browsers an account signed in from (hash of the device cookie, browser name, first and last seen) | The last 20 per account; the cookie itself 400 days in the browser | Enough to recognise someone's own devices; the oldest falls off | Fixed (`users.knownDevices`) |
| Requests to grant or remove the admin role | 48 h, deleted when approved, rejected or cancelled | An old request shouldn't be approvable long after anyone remembers why it was made | `ADMIN_APPROVAL_EXPIRY_HOURS` (`adminApprovals`) |
| Notifications | 180 days | Old alerts are about closed tenders | `RETENTION_NOTIFICATIONS_DAYS` |
| Import run history | 90 days | The dashboard shows 7 days; 90 covers an investigation | `RETENTION_SYNC_RUNS_DAYS` |
| Admin audit log | 365 days | Long enough to answer "who changed this" for a year of operation | `RETENTION_AUDIT_LOG_DAYS` |
| Company sign-ups never confirmed by email, still pending | 30 days | They can't sign in and were never reviewed; deleting frees the address | `RETENTION_UNVERIFIED_SIGNUP_DAYS` |
| Container logs, including security events | 5 files × 10 MB per service | Disk is bounded; ship logs elsewhere to keep them longer | `x-logging` in `docker-compose.yml` |
| Accounts, company profiles, uploaded files, saved TORs | While the account exists | The owner's own data; an admin deletes on request | — |
| TOR records | Indefinitely | Public procurement data, used as price history | — |

Deleting an account on request is done by an admin in the database for now; there is no self-service "delete my account".

## Secrets and rotation

(ASVS 13.1.4, 13.3.4)

| Secret | Held in | Rotate | How |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Frontend and backend environment | Every 12 months (`SESSION_SECRET_MAX_AGE_DAYS`), and at once if exposed | Scheduled: with a grace period, below; nobody is signed out. Exposed: new value only, restart both services, every session ends |
| MongoDB root and app passwords | Generated into the `torr_db_secrets` volume (or set in `.env`) | Every 12 months, and when someone with access leaves | Steps in [key-management.md, Database passwords](./key-management.md#database-passwords) |
| `RESEND_API_KEY` | Backend environment | Every 12 months, and if exposed | New key in the Resend dashboard, `.env`, restart; revoke the old one |
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | Backend environment | Every 12 months; the secret at once if exposed (forged webhooks) | Reissue in the LINE console, `.env`, restart |
| `GOOGLE_CLIENT_ID` | Both environments | Not a secret; changes only with the Google project | — |
| Vertex AI credentials | Host's Application Default Credentials | Per the Google Cloud key policy | Rotate the service-account key in Google Cloud |
| Companies' Slack webhook URLs | User records | Owned by each company | The company replaces it in its settings |

Whoever runs the server rotates the secrets and records the date in the team's operations notes.

**Rotating `SESSION_SECRET` without signing anyone out (ASVS 13.3.4).** Sessions and form tokens are signed with `SESSION_SECRET`. During a rotation the old key is still accepted for checking, never for signing, until a set date:

1. Generate a new value (`openssl rand -base64 32`).
2. In `.env`: move the old value to `SESSION_SECRET_PREVIOUS`, put the new one in `SESSION_SECRET`, set `SESSION_SECRET_PREVIOUS_UNTIL` to 8 days from now (a session lasts at most 7), and set `SESSION_SECRET_CREATED` to today.
3. Restart both services. Existing sessions keep working; each is re-signed with the new key on its next request.
4. After the end date the old key stops being accepted by itself. Remove the two `PREVIOUS` lines at the next restart; until then the backend logs `config.secret_rotation_due` daily as a reminder.

**Expiry.** The previous key has a hard end date: in production the services refuse to start with one more than 8 days ahead, or one equal to the current key. The current key's age is known from `SESSION_SECRET_CREATED`; once it is older than `SESSION_SECRET_MAX_AGE_DAYS` (365), the backend logs `config.secret_rotation_due` at startup and daily. It keeps working: an overdue rotation is an operator's alert, not an outage. The other secrets above are rotated by hand on the same schedule; their providers (MongoDB, Resend, LINE) can hold only one value at a time.
