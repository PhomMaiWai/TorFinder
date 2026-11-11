# TorFinder

A platform that collects Thai government software procurement announcements (TOR)
in Bangkok, lets administrators curate them, and helps registered software companies
find the opportunities that match their work.

Announcements are imported from the agencies' own **public JSON APIs** — Bangkok's
e-GP, the national e-GP (กรมบัญชีกลาง) and data.go.th — with no API keys. The
Metropolitan Electricity Authority publishes no API, so its procurement site's listing
and detail pages are read directly. Gemini on Vertex AI reads each
TOR's PDF to pull out scope, qualifications, price and deadlines.

Full documentation, including design diagrams and the API reference, is in
[docs/](docs/README.md).

## Tech Stack

|          |                                                                  |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, next-intl (TH/EN) |
| Backend  | NestJS 11, MongoDB driver                                        |
| Database | MongoDB 7                                                        |
| Auth     | HMAC-signed session token in an httpOnly cookie, Google sign-in  |
| AI       | Gemini on Google Vertex AI (optional)                            |
| Notify   | In-app, email (Resend), LINE, Slack                              |

The repository holds two services — `frontend/` and `backend/` — each with its own
`package.json`.

---

## Quick start (Docker — recommended)

Everything runs with one command; you don't need Node or MongoDB installed.

```bash
git clone https://github.com/PhomMaiWai/TorFinder.git
cd TorFinder
docker compose up -d --build
```

That's it. The database is created and filled with a snapshot of real TOR records
(`docker/mongo-seed/`), demo accounts are seeded, and both services start:

|              | URL                          |
| ------------ | ---------------------------- |
| Web app      | http://localhost:3000        |
| API          | http://localhost:4000/api    |
| Health check | http://localhost:4000/health |

Useful commands:

```bash
docker compose logs -f backend   # follow backend logs
docker compose down              # stop (keeps the database)
docker compose down -v           # stop and wipe the database, so the next start re-seeds
```

Already ran it before the snapshot existed? The snapshot only loads into an empty
database, so wipe it once: `docker compose down -v && docker compose up -d`.

---

## Running without Docker

You need **Node.js 22+** and a **MongoDB 7** instance you can reach.

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env     # then edit MONGODB_URI if yours isn't on localhost
npm run dev              # http://localhost:4000
```

**2. Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev              # http://localhost:3000
```

> `SESSION_SECRET` must be **identical** in both services — the frontend verifies
> session cookies locally instead of calling the backend on every navigation, so a
> mismatch logs everyone out.

Without Docker the database starts empty apart from the demo accounts. Press the
import buttons on `/admin/tor`, or wait for the scheduled imports, to fill it.

---

## Demo accounts

Seeded automatically the first time the `users` collection is empty.

| Role                            | Email                       | Password       | Signs in at           | Lands on   |
| ------------------------------- | --------------------------- | -------------- | --------------------- | ---------- |
| Administrator                   | `admin@bma.go.th`           | `Admin1234!`   | `/login/admin`        | `/admin`   |
| Project owner                   | `owner@bma.go.th`           | `Owner1234!`   | `/login/admin`        | `/owner`   |
| Auditor                         | `auditor@bma.go.th`         | `Auditor1234!` | `/login/admin`        | `/auditor` |
| Organization (approved)         | `contact@arundigital.co.th` | `Org12345!`    | `/login/organization` | `/dashboard` |
| Organization (pending approval) | `contact@techworks.co.th`   | `Tech12345!`   | `/login/organization` | —          |
| Organization (pending approval) | `hello@datacraft.co.th`     | `Data12345!`   | `/login/organization` | —          |

A member of the public can also sign in with Google at `/login/public` to keep
bookmarks and saved searches.

The two pending accounts exist so the approval queue at `/admin/accounts` isn't empty —
try approving one, then sign in as it. A pending account **cannot** sign in until an
administrator approves it.

What each role can do is described in
[docs/project/roles-and-features.md](docs/project/roles-and-features.md).

> These credentials are for local development only. Set `SEED_DEMO_DATA=false` to start
> without them.

---

## Seeding rules

Seeding runs on backend startup and is **idempotent**: demo accounts are inserted only
when the `users` collection is empty, so restarting never duplicates anything and
accounts you create by hand are never touched. TOR records are never seeded by the
backend; in Docker they come from the snapshot in `docker/mongo-seed/`, otherwise from
the importers.

To get a clean slate:

```bash
docker compose down -v && docker compose up -d
```

Demo accounts live in `backend/src/database/seed-data.ts`.

---

## Where the data comes from

| Source | What it gives | Runs every | Manual trigger (admin) |
| --- | --- | --- | --- |
| Bangkok e-GP (`egp2.bangkok.go.th`) | Drafts for hearing, invitations, award notices from BMA | 6 h | Import button on `/admin/tor` |
| National e-GP (`process5.gprocurement.go.th`) | Current procurement step and tender documents for open projects | 3 h | Capture by project number on `/admin/tor` |
| MEA (`procurement.mea.or.th`) | MEA procurement announcements | 6 h | Button on `/admin/tor` |
| data.go.th | Monthly government contract data | daily | Button on `/admin/tor` |
| Vertex AI (Gemini) | Fields read from each TOR's PDF | 1 h | `POST /api/ai/extract` (no button yet) |

Every importer keeps only software and IT work in Bangkok, published from 2022 on,
merges the same project across sources (manual > Bangkok e-GP > MEA > data.go.th),
and leaves fields an admin has corrected alone. Re-running is always safe. The details
are in [docs/operations/pipeline.md](docs/operations/pipeline.md) and, in plainer words,
[docs/operations/pipeline-guide.md](docs/operations/pipeline-guide.md).

---

## Environment variables

**backend/.env** (see `backend/.env.example`; every default is in
`backend/src/config/env.ts`)

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://localhost:27017/torfinder` | Required in production |
| `SESSION_SECRET` | dev fallback | Required in production; must match the frontend |
| `PORT` | `4000` | |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allow-list and links in notifications |
| `SEED_DEMO_DATA` | `true` outside production | `false` skips the demo accounts |
| `TOR_LISTED_SINCE` | `2022-01-01` | Records older than this are not imported or listed |
| `GOOGLE_CLIENT_ID` | empty | Google sign-in; must match the frontend's |
| `VERTEX_PROJECT_ID` | empty | Empty turns AI extraction and proposal drafts off |
| `VERTEX_LOCATION` | `asia-southeast1` | |
| `VERTEX_MODEL` | `gemini-2.5-flash` | |
| `EGP_POLL_MINUTES` | `360` | `0` turns the job off; same for the other `*_POLL_MINUTES` |
| `MEA_POLL_MINUTES` | `360` | |
| `DATAGOV_POLL_MINUTES` | `1440` | |
| `GPROC_POLL_MINUTES` | `180` | |
| `AI_POLL_MINUTES` | `60` | |
| `EGP_POLL_ON_STARTUP`, `MEA_POLL_ON_STARTUP`, `DATAGOV_POLL_ON_STARTUP`, `GPROC_POLL_ON_STARTUP` | `true` | Run once when the backend starts |
| `AI_POLL_ON_STARTUP` | `false` | Off by default so restarts don't spend model calls |
| `EGP_LOOKBACK_DAYS` | `120` | How far back drafts and invitations are read |
| `EGP_MAX_PAGES` | `40` | Pages per announcement type |
| `EGP_CONCURRENCY` | `5` | Requests in flight to e-GP |
| `EGP_ENRICH_BUDGET_MS` | `45000` | Time cap on fetching per-project detail in one sync |
| `RESEND_API_KEY` | empty | Empty turns email off (links are logged instead) |
| `NOTIFY_EMAIL_FROM` | `TOR Finder <noreply@torfinder.app>` | |
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
| `MONGODB_URI` | Not read by the app. The frontend e2e tests use it to reach the database (see [testing.md](docs/process/testing.md#running-the-frontend-tests)) |

---

## Project structure

```
backend/src/
├── accounts/        # Company approval, user directory, roles, suspend, own profile
├── ai/              # Vertex AI client, TOR extraction job, proposal drafts
├── audit/           # Audit log of admin actions and sync runs
├── auth/            # Sign-up, sign-in, Google, password reset, email verification
├── common/          # Guards, session token, password hashing, software filter, scheduler base
├── config/          # Environment parsing
├── database/        # Mongo connection, indexes, demo accounts
├── datagov/         # data.go.th importer
├── egp/             # Bangkok e-GP importer and pipeline metrics
├── feedback/        # Public comments and moderation
├── gproc/           # National e-GP capture and documents
├── matching/        # Match scoring, budget check, bid insight, match alerts
├── mea/             # MEA importer
├── notifications/   # In-app notifications, email/LINE/Slack delivery, admin alerts
├── owner/           # Project owner's own TORs
├── reports/         # "Report a problem" and the admin review list
├── saved-searches/  # Saved searches
├── saved-tors/      # Bookmarks
├── scripts/         # One-off maintenance (scope-cleanup)
└── tor/             # TOR CRUD, import/dedup, documents, stages

frontend/src/
├── app/             # Routes (App Router)
│   ├── admin/       # Admin: TORs, accounts, users, moderation, reports, audit, notifications
│   ├── api/         # Route handlers: session cookie and proxies to the backend
│   ├── auditor/     # Flagged TORs for the Auditor Office
│   ├── dashboard/   # Overview
│   ├── login/       # Sign-in for admin/staff, organizations, public (Google)
│   ├── matches/     # A company's matched TORs
│   ├── notifications/
│   ├── owner/       # A project owner's own TORs
│   ├── profile/     # Company profile
│   ├── public/      # Public TOR listing
│   ├── saved/       # Bookmarks and saved searches
│   ├── search/      # TOR search
│   ├── signup/      # Organization registration
│   └── tor/         # TOR detail page
├── components/      # UI, grouped by area
├── data/            # Showcase records used by the public pages
├── i18n/            # next-intl setup
├── lib/             # API clients, validators, hooks
├── types/
└── proxy.ts         # Page and /api access by role (Next.js middleware)

frontend/messages/   # TH / EN translations
docs/                # Project documentation
```

## Scripts

Run inside `frontend/` or `backend/`:

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # ESLint
npm run test:e2e   # tests; see docs/process/testing.md for what they need running
```

## Contributing

Branches, commit messages and pull requests are described in
[docs/process/developer-guide.md](docs/process/developer-guide.md), and testing in
[docs/process/testing.md](docs/process/testing.md).

## Course context

Built for Collaborative Software Process and Project Management (01219346),
Kasetsart University.

## Documentation

- [docs/](docs/README.md) — project plan, requirements, design diagrams, API reference,
  process, operations and security
- [LICENSE](LICENSE) — MIT
