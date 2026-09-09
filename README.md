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
The backend reads the official RSS feed and upserts announcements into the database.

- Re-running is safe: records are keyed by project number and announcement type, so an
  import updates existing rows instead of duplicating them.
- Feeds are pulled one at a time — e-GP drops connections when several are requested at
  once, and one failing feed doesn't abort the whole run.
- The feed carries no agency name. Set `EGP_DEPARTMENTS` to `deptId:ชื่อหน่วยงาน` pairs
  joined by `|` to label imports per department; leave it empty to pull nationwide.

Imported records are tagged as e-GP and are kept out of the public search — that page
shows the showcase records plus whatever administrators entered by hand.

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
| `EGP_FEED_URL`    | official e-GP RSS URL            |                                                 |
| `EGP_DEPARTMENTS` | empty                            | `deptId:ชื่อหน่วยงาน` pairs joined by `\|`      |

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
