# TorFinder

A platform that collects Thai government software procurement announcements (TOR),
lets administrators curate them, and helps registered software companies find the
opportunities that match their work.

Announcements are imported from the **official e-GP RSS service** published by the
Comptroller General's Department — no scraping, no API key required.

## Tech Stack

|          |                                                                  |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, next-intl (TH/EN) |
| Backend  | NestJS 11, MongoDB driver                                        |
| Database | MongoDB 7                                                        |
| Auth     | HMAC-signed session token in an httpOnly cookie                  |

The repository holds two services — `frontend/` and `backend/` — each with its own
`package.json`.

---

## Quick start (Docker — recommended)

Everything runs with one command; you don't need Node or MongoDB installed.

```bash
git clone <repo-url>
cd torr
docker compose up -d --build
```

That's it. The database is created, demo data is seeded, and both services start:

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
printf 'BACKEND_URL=http://localhost:4000\nSESSION_SECRET=dev-only-insecure-secret-change-me\n' > .env.local
npm run dev              # http://localhost:3000
```

> `SESSION_SECRET` must be **identical** in both services — the frontend verifies
> session cookies locally instead of calling the backend on every navigation, so a
> mismatch logs everyone out.

---

## Demo accounts

Seeded automatically the first time the database starts empty.

| Role                            | Email                       | Password     |
| ------------------------------- | --------------------------- | ------------ |
| Administrator                   | `admin@bma.go.th`           | `Admin1234!` |
| Organization (approved)         | `contact@arundigital.co.th` | `Org12345!`  |
| Organization (pending approval) | `contact@techworks.co.th`   | `Tech12345!` |
| Organization (pending approval) | `hello@datacraft.co.th`     | `Data12345!` |

Sign in at `/login/admin` or `/login/organization`.

The two pending accounts exist so the approval queue at `/admin/accounts` isn't empty —
try approving one, then sign in as it. A pending account **cannot** sign in until an
administrator approves it.

Seeding also inserts **5 TOR records** so the listing pages have content.

> These credentials are for local development only. Set `SEED_DEMO_DATA=false` to start
> from an empty database.

---

## Seeding rules

Seeding runs on backend startup and is **idempotent** — each collection is filled only
when it is empty, so restarting never duplicates anything and records you create by hand
are never touched.

To get a clean slate:

```bash
docker compose down -v && docker compose up -d
```

Demo content lives in `backend/src/database/seed-data.ts`.

---

## Importing real announcements from e-GP

Sign in as the administrator, open **/admin/tor**, and press **"ดึงประกาศจาก e-GP"**.

Announcements come from the **Bangkok e-GP public API** (`egp2.bangkok.go.th`) — the same
portal the city publishes procurement on. No API key, no scraping, no HTML parsing.

| Endpoint | Used for |
|---|---|
| `/Projects/GetProjectFromFilter` | Paged project search per announcement type |
| `/ProjectAnnouncements/GetAnnouncementDetailInProject` | Publication date of each announcement |
| `/MasterAnnounceTypes` | The announcement-type ids the search accepts |

Three announcement types are imported and mapped onto the TOR stages:

| e-GP type | Stage in the app |
|---|---|
| ร่างขอบเขตของงาน (TOR) | เปิดรับฟังความคิดเห็น |
| ประกาศเชิญชวน | ประกาศ TOR |
| ประกาศรายชื่อผู้ชนะการเสนอราคา | ประกาศผู้ชนะ |

Each record keeps the project's real agency, budget and publication date, and links back to
its page on the portal.

Notes:

- **Re-running is safe.** Records are keyed on project number + announcement type, so a
  second sync updates rows instead of duplicating them.
- **Only software work is imported.** The portal lists every kind of procurement — cleaning
  contracts, medical supplies, dog cages. `EGP_KEYWORDS` filters at the source, so the
  database holds TORs this product is actually about. Clearing it imports everything.
- **Depth is bounded** by `EGP_PAGE_SIZE x EGP_MAX_PAGES` per keyword and type.
- **Per-project detail is enriched once, not every sync.** The document link and
  procurement method/type/category cost two extra requests per project, so they're
  fetched only for records that don't have them yet (`enrichedAt` unset) — a repeat sync
  makes almost no detail requests.
- **A slow portal can't stall the sync.** Enrichment gets a short per-request timeout, no
  retry, and a hard wall-clock budget (`EGP_ENRICH_TIMEOUT_MS`, `EGP_ENRICH_BUDGET_MS`).
  Once the budget runs out, remaining projects are imported without the extra detail and
  picked up automatically on the next sync — the run always finishes in bounded time
  regardless of how degraded the upstream API is.
- **Requests are pooled**, not burst: `EGP_CONCURRENCY` caps requests in flight, with
  exponential backoff on 429/5xx and no retry on other 4xx.
- **Runs never overlap.** The scheduled poll and the admin button share one in-flight sync.
- Imported records are tagged as e-GP and stay out of the public search, which shows the
  showcase records plus whatever administrators entered by hand.
- The "ดูต้นฉบับ" link on a TOR's detail page points at the actual announcement PDF when
  e-GP has one on file, falling back to the project's listing page otherwise — never a
  generic homepage.

---

## Environment variables

**backend/.env** (see `backend/.env.example`)

| Variable          | Default                          | Notes                                           |
| ----------------- | -------------------------------- | ----------------------------------------------- |
| `MONGODB_URI`     | `mongodb://localhost:27017/torr` | Required in production                          |
| `SESSION_SECRET`  | dev fallback                     | Required in production; must match the frontend |
| `SEED_DEMO_DATA`  | `true` outside production        | Set `false` for an empty database               |
| `PORT`            | `4000`                           |                                                 |
| `FRONTEND_ORIGIN` | `http://localhost:3000`          | CORS allow-list                                 |
| `EGP_API_BASE` | `https://egp2.bangkok.go.th/appapi/api` | Bangkok e-GP API |
| `EGP_LISTING_BASE` | `https://egp2.bangkok.go.th/project-detail` | Public project page |
| `EGP_PAGE_SIZE` | `50` | Projects per request |
| `EGP_MAX_PAGES` | `2` | Pages per announcement type |
| `EGP_CONCURRENCY` | `5` | Requests in flight |
| `EGP_KEYWORDS` | software/IT terms | Source-side filter; empty imports everything |
| `EGP_ENRICH_TIMEOUT_MS` | `8000` | Per-request timeout for document/detail lookups |
| `EGP_ENRICH_BUDGET_MS` | `45000` | Wall-clock cap on the enrichment phase per sync |
| `EGP_POLL_MINUTES` | `360` | Background refresh; `0` disables |
| `EGP_POLL_ON_STARTUP` | `true` | Fill a fresh database on boot |

**frontend/.env.local**

| Variable         | Notes                                                     |
| ---------------- | --------------------------------------------------------- |
| `BACKEND_URL`    | Where the API lives (`http://backend:4000` inside Docker) |
| `SESSION_SECRET` | Must match the backend                                    |

---

## Project structure

```
backend/src/
├── accounts/     # Admin review of organization sign-ups (admin-guarded)
├── auth/         # Sign-up, sign-in, session tokens
├── common/       # Password hashing, session token, admin guard, TH validators
├── config/       # Environment parsing
├── database/     # Mongo connection, indexes, seed data
├── egp/          # e-GP RSS import
└── tor/          # TOR CRUD

frontend/src/
├── app/          # Routes (App Router)
│   ├── admin/    # Admin area: TOR management, account approval
│   ├── api/      # Session cookie endpoints
│   ├── login/    # Sign-in
│   ├── public/   # TOR search
│   └── signup/   # Organization registration
├── components/   # UI, grouped by area
├── data/         # Showcase records used by the public pages
├── lib/          # API clients, validators, hooks
└── messages/     # TH / EN translations
```

## Scripts

Run inside `frontend/` or `backend/`:

```bash
npm run dev     # development server
npm run build   # production build
npm run lint    # ESLint
```

## Branching & commits

- `main` — always deployable
- `feature/<name>` — one branch per issue
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)

## Course context

Built for Collaborative Software Process and Project Management (01219346),
Kasetsart University.
