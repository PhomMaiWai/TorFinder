# Configuration and local setup details

The details the [root README](../../README.md) leaves out: running the backend
against the Docker database, how demo data is seeded, where the data comes from,
and every environment variable.

## Backend outside Docker, database in Docker

The Docker database accepts TLS connections with a client
certificate only (ASVS 12.3.5). Copy the development certificate out once, then
point the backend at it:

```bash
docker compose up -d db                     # makes the certificates on first run
docker compose run --rm certs export        # writes docker/certs/dev/ (gitignored)
docker compose run --rm db-secrets cat /secrets/root-password   # the generated root password
# backend/.env, with that password in place of <root-password>:
MONGODB_URI="mongodb://torr:<root-password>@localhost:27017/torfinder?authSource=admin&tls=true&tlsCAFile=../docker/certs/dev/ca.crt&tlsCertificateKeyFile=../docker/certs/dev/local-dev.pem&directConnection=true"
```

A database volume made before the root password was generated still uses `torr`.

Without Docker the database starts empty apart from the demo accounts. Press the
import buttons on `/admin/tor`, or wait for the scheduled imports, to fill it.

## Seeding rules

Seeding runs on backend startup and is **idempotent**: a demo account is inserted only
when no account has its email yet, so restarting never duplicates anything, a demo
account you changed (password, role) is left as it is, and accounts you create by
hand are never touched. A demo account added to `seed-data.ts` later also reaches an
existing database on the next start. TOR records are never seeded by the
backend; in Docker they come from the snapshot in `docker/mongo-seed/`, otherwise from
the importers.

To get a clean slate:

```bash
docker compose down -v && docker compose up -d
```

Demo accounts live in `backend/src/database/seed-data.ts`.

## Where the data comes from

| Source | What it gives | Runs every | Manual trigger (admin) |
| --- | --- | --- | --- |
| Bangkok e-GP (`egp2.bangkok.go.th`) | Drafts for hearing, invitations, award notices from BMA | 6 h | Import button on `/admin/tor` |
| National e-GP (`process5.gprocurement.go.th`) | Current procurement step and tender documents for open projects | 3 h | Capture by project number on `/admin/tor` |
| MEA (`procurement.mea.or.th`) | MEA procurement announcements | 6 h | Button on `/admin/tor` |
| Vertex AI (Gemini) | Fields read from each TOR's PDF | 1 h | `POST /api/ai/extract` (no button yet) |

Every importer keeps only software and IT work in Bangkok, published from 2022 on,
merges the same project across sources (manual > Bangkok e-GP > national e-GP > MEA),
and leaves fields an admin has corrected alone. Re-running is always safe. The details
are in [pipeline.md](./pipeline.md) and, in plainer words,
[pipeline-guide.md](./pipeline-guide.md).

## Environment variables

**backend/.env** (see `backend/.env.example`; every default is in
`backend/src/config/env.ts`)

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://localhost:27017/torfinder` | Required in production |
| `SESSION_SECRET` | dev fallback | Production requires a private value of 32+ characters (the dev placeholder is refused); must match the frontend |
| `PORT` | `4000` | |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allow-list and links in notifications |
| `SEED_DEMO_DATA` | `true` outside production | `false` skips the demo accounts |
| `LOGIN_FAILURE_LIMIT` | `10` | Failed logins per email before a 15-minute lock |
| `TRUST_PROXY` | `loopback, uniquelocal` | Hops trusted for `X-Forwarded-For` (the frontend) |
| `TOR_LISTED_SINCE` | `2022-01-01` | Records older than this are not imported or listed |
| `GOOGLE_CLIENT_ID` | empty | Google sign-in; must match the frontend's |
| `VERTEX_PROJECT_ID` | empty | Empty turns AI extraction and proposal drafts off |
| `VERTEX_LOCATION` | `asia-southeast1` | |
| `VERTEX_MODEL` | `gemini-2.5-flash` | |
| `VERTEX_EMBEDDING_MODEL` | `text-multilingual-embedding-002` | "Find similar" ranks by keywords without Vertex |
| `EGP_POLL_MINUTES` | `360` | `0` turns the job off; same for the other `*_POLL_MINUTES` |
| `MEA_POLL_MINUTES` | `360` | |
| `GPROC_POLL_MINUTES` | `180` | |
| `AI_POLL_MINUTES` | `60` | |
| `EGP_POLL_ON_STARTUP`, `MEA_POLL_ON_STARTUP`, `GPROC_POLL_ON_STARTUP` | `true` | Run once when the backend starts |
| `AI_POLL_ON_STARTUP` | `false` | Off by default so restarts don't spend model calls |
| `EGP_LOOKBACK_DAYS` | `120` | How far back drafts and invitations are read |
| `EGP_MAX_PAGES` | `40` | Pages per announcement type |
| `EGP_CONCURRENCY` | `5` | Requests in flight to e-GP |
| `EGP_ENRICH_BUDGET_MS` | `45000` | Time cap on fetching per-project detail in one sync |
| `RESEND_API_KEY` | empty | Empty turns email off (links are logged instead) |
| `NOTIFY_EMAIL_FROM` | `TOR Finder <noreply@torfinder.app>` | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | empty, `465` | Send email over SMTP instead of Resend, e.g. Gmail (`smtp.gmail.com`, `465`, the Gmail address, an app password). Reaches any address without a verified domain. `SMTP_SECURE` overrides TLS-on-connect (default: on for port 465, STARTTLS otherwise). Not available behind the hardening proxy |
| `MAIL_CATCHER_URL` | empty | Testing only. `http://mailpit:8025` sends every email to Mailpit (`docker compose --profile mail up -d`, view at http://localhost:8025) instead of Resend. Keep it empty in production |
| `LINE_CHANNEL_ACCESS_TOKEN` | empty | Empty turns LINE off |
| `NOTIFY_MATCH_THRESHOLD` | `70` | Default score for match alerts; each company can set its own |
| `NOTIFY_MAX_MATCHES_PER_RUN` | `5` | Most match alerts one company gets per import |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` | `100` / `60000` | Requests per window, every route |
| `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_TTL_MS` | `5` / `60000` | Sign-in, sign-up, comments, reports |

**frontend/.env.local** (see `frontend/.env.example`)

| Variable | Notes |
| --- | --- |
| `BACKEND_URL` | Where the API lives (`http://backend:4000` inside Docker). Server-only |
| `SESSION_SECRET` | Must match the backend |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in button; empty hides it. Baked in at build time |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Address for "ask us to add a standard" on the profile page |
| `FEATURED_TOR_IDS` | Comma-separated TOR ids to pin to the top of search, for demos |
| `MONGODB_URI` | Not read by the app. The frontend e2e tests use it to reach the database (see [testing.md](../process/testing.md#running-the-frontend-tests)) |
