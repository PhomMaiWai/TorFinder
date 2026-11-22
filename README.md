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

## Software Development Security (01219325) project

TorFinder is our existing web application from Collaborative Software Process
(01219346). For Software Development Security we made it more secure by following
**OWASP ASVS 5.0**: all of Level 1, all of Level 2, and as much of Level 3 as fits.

### Team

| Member | GitHub |
| --- | --- |
| Sai Khun Main | [SKlv1ain](https://github.com/SKlv1ain) |
| Nisara Ploysuttipol | [fcxbsyo](https://github.com/fcxbsyo) |
| Bhumipat Kusalatham | [OverCatX](https://github.com/OverCatX) |

### What we submit

| Deliverable | Where |
| --- | --- |
| Source code | This repository (public; no secrets in it or its history, see C9 below) |
| How to install and run | [Quick start](#quick-start-docker--recommended) and [Running without Docker](#running-without-docker) below |
| Project document | [docs/security/project-document.md](docs/security/project-document.md) (the full version with appendices goes to Google Classroom) |
| Presentation slides | [docs/slides/](docs/slides/) |

### ASVS result

| Level | Requirements | Pass | Partial | Fail | Accepted risk | N/A | Report |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Level 1 | 70 | 56 | 0 | 0 | 0 | 12 (+2 set by hosting) | [asvs-l1.md](docs/security/asvs-l1.md) |
| Level 2 | 183 | 125 | 0 | 0 | 0 | 58 | [asvs-l2.md](docs/security/asvs-l2.md) |
| Level 3 | 92 | 68 | 0 | 0 | 4 | 20 | [asvs-l3.md](docs/security/asvs-l3.md) |

Every Level 1 and Level 2 requirement that applies to TorFinder passes. At Level 3,
68 of the 72 that apply pass. The other 4 need a production domain, DNS or
hardware the project doesn't have yet (HSTS preload, Encrypted Client Hello,
memory encryption, an HSM). They are listed as accepted risks, with what would
close each one, in [asvs-l3.md](docs/security/asvs-l3.md#accepted-risks).

### Project document: the six sections

| # | Section | Where |
| --- | --- | --- |
| 1 | Application name and team members | [project-document.md §1](docs/security/project-document.md#1-application-and-team) |
| 2 | Functional features | [project-document.md §2](docs/security/project-document.md#2-functional-features), [roles-and-features.md](docs/project/roles-and-features.md) |
| 3 | Security features mapped to OWASP ASVS | [project-document.md §3](docs/security/project-document.md#3-security-features-mapped-to-asvs), [asvs-l1.md](docs/security/asvs-l1.md), [asvs-l2.md](docs/security/asvs-l2.md), [asvs-l3.md](docs/security/asvs-l3.md) |
| 4 | Threat modeling | [threat-model.md](docs/security/threat-model.md) (STRIDE, 36 threats, prioritised) |
| 5 | Security principles | [threat-model.md § Security design principles](docs/security/threat-model.md#security-design-principles) |
| 6 | Security test process | [project-document.md §6](docs/security/project-document.md#6-security-test-process) |

### Grading criteria

| # | Criterion | What TorFinder does | Evidence |
| --- | --- | --- | --- |
| 1 | OWASP ASVS requirements we follow | ASVS 5.0 L1, L2 and L3 reviewed requirement by requirement | [asvs-l1.md](docs/security/asvs-l1.md), [asvs-l2.md](docs/security/asvs-l2.md), [asvs-l3.md](docs/security/asvs-l3.md) |
| 2 | Threat model with priorities | STRIDE on a data-flow diagram; each threat scored likelihood × impact, fixed in priority order (Critical first) | [threat-model.md](docs/security/threat-model.md#priorities) |
| 3 | Security design principles | 12 principles, each mapped to the code that applies it | [threat-model.md](docs/security/threat-model.md#security-design-principles) |
| 4 | Password authentication | scrypt hashes; 8–128 characters; email must be verified; lockout | `backend/src/auth/` |
| 5 | Social SSO (OAuth/OpenID) | Google sign-in; ID token signature, audience and expiry checked | `backend/src/auth/auth.service.ts` |
| 6 | Authorization (roles) | Six roles; every backend route has a role guard; pages are gated by role too | `backend/src/common/*.guard.ts`, `frontend/src/proxy.ts` |
| 7 | Access control (own data only) | Queries filter on the session's user id, never a request field; files re-checked for ownership on every read | `backend/test/certificates.e2e.test.mjs`, `library.e2e.test.mjs` |
| 8 | Input validation, SQL/NoSQL injection | Whitelisting DTOs drop unknown fields; typed `$eq` filters; escaped `$regex`; uploads typed by their bytes | `backend/src/common/regex.ts`, DTOs in each module |
| 9 | Environment variables and credentials | Secrets only from the environment; production refuses a missing, published or short `SESSION_SECRET`; `.env` ignored by git; history scanned; GitHub secret scanning and push protection on | `backend/src/config/env.ts`, `.env.example` |
| 10 | CORS (not `*`) | The backend allows exactly one origin, the frontend's | `backend/src/main.ts` |
| 11 | Error handling | Generic message plus an `errorId` for unexpected errors; details only in the server log | `backend/src/common/all-exceptions.filter.ts` |
| 12 | Logging | JSON security events for sign-in, lockout, logout, password changes, refused access and more, never with passwords or tokens; audit log of admin actions | [logging-and-errors.md](docs/security/logging-and-errors.md) |
| 13 | HTTP security headers | Nonce CSP with `strict-dynamic`, HSTS, `nosniff`, `frame-ancestors`, Referrer-Policy; `helmet()` on the backend. Set in our own code | `frontend/src/proxy.ts`, `frontend/src/lib/csp.ts`, `frontend/next.config.ts` |
| 14 | SAST | CodeQL on every PR, Semgrep (8 rule packs) | [sast-report.md](docs/security/sast-report.md) |
| 15 | DAST | OWASP ZAP baseline and signed-in active scan | [dast-report.md](docs/security/dast-report.md), [evidence/](docs/security/evidence/) |
| 16 | Implementation mapped back to the threat model | Done / not done checklist for every threat | [threat-model.md § Mitigation checklist](docs/security/threat-model.md#mitigation-checklist) |
| 17 | Mapped to OWASP ASVS and OWASP Top 10 | Every Top 10 (2025) category with its code, ASVS ids and tests | [owasp-top10.md](docs/security/owasp-top10.md) |
| 18 | Advanced features (4 required, 6 done) | Email verification; login rate limit; backend API rate limit; login timeout (30 min idle, 7 days absolute); token expiry and revocation; breached-password check at sign-up. Also staff passkeys | [project-document.md §3.2](docs/security/project-document.md#32-advanced-features-self-studied-c18) |

### Checking the security yourself

After `docker compose up` (see below):

```bash
# security headers (C13); or open DevTools → Network on http://localhost:3000
curl -sI http://localhost:3000/ | grep -iE 'content-security|strict-transport|x-content-type|referrer|x-frame'

# CORS (C10), with the backend on `npm run dev` (in Docker only the frontend may call it):
# whoever asks, the one allowed origin is the frontend's, never * or the caller's
curl -sI -H 'Origin: https://evil.example' http://localhost:4000/api/tor | grep -i access-control-allow-origin

# the security regression tests (needs MongoDB; see docs/process/testing.md)
cd backend && npm install && npm run test:e2e
```

How we ran Semgrep and ZAP, with the exact commands, is in
[sast-report.md](docs/security/sast-report.md) and
[dast-report.md](docs/security/dast-report.md). Screenshots for each criterion are
listed in [docs/security/evidence/README.md](docs/security/evidence/README.md).

---

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
cp .env.example .env
# put a fresh secret in .env:  SESSION_SECRET=<output of: openssl rand -base64 32>
# for the demo accounts below, also set SEED_DEMO_DATA=true (your own machine only)
docker compose up -d --build
```

The services refuse to start without a private `SESSION_SECRET` of 32+ characters.
The database is created and filled with a snapshot of real TOR records
(`docker/mongo-seed/`), demo accounts are seeded if you opted in, and both services start:

|              | URL                          |
| ------------ | ---------------------------- |
| Web app      | http://localhost:3000        |
| API          | https://localhost:4000/api (callable by the frontend only: TLS 1.3 with its client certificate) |

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

**Only the database in Docker?** It accepts TLS connections with a client
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

---

## Demo accounts

Seeded automatically on startup: any demo account that doesn't exist yet is added.

| Role                            | Email                       | Password       | Signs in at           | Lands on   |
| ------------------------------- | --------------------------- | -------------- | --------------------- | ---------- |
| Administrator                   | `admin@bma.go.th`           | `Admin1234!`   | `/login/admin`        | `/admin`   |
| Administrator (second)          | `admin2@bma.go.th`          | `Admin2345!`   | `/login/admin`        | `/admin`   |
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

> These credentials are public, so they are for your own machine only. `npm run dev`
> seeds them by default; Docker seeds them only when `.env` sets `SEED_DEMO_DATA=true`.
> Never enable them on a server anyone else can reach.

---

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

Built for Collaborative Software Process and Project Management (01219346) and
made more secure for Software Development Security (01219325), Kasetsart University.

## Documentation

- [docs/](docs/README.md) — project plan, requirements, design diagrams, API reference,
  process, operations and security
- [LICENSE](LICENSE) — MIT
