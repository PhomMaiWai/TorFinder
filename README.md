# TorFinder

[![Security checks](https://github.com/PhomMaiWai/TorFinder/actions/workflows/security.yml/badge.svg)](https://github.com/PhomMaiWai/TorFinder/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

TorFinder collects Thai government software procurement announcements (TORs) for
Bangkok, lets administrators curate them, and matches each one to the software
companies that could bid on it.

## Features

- **Search TORs** by keyword, stage, agency, budget and deadline, or paste a past
  project to find similar ones.
- **TOR detail** with a stage timeline, the original documents, an AI summary and a
  budget check against similar TORs.
- **Matching for companies**: a score for how well each TOR fits the company's
  profile, with alerts by email, LINE or in the app.
- **Market insights**: who wins, at what discount, and how contested each agency is.
- **Admin tools**: approve companies, curate and import TORs, moderate comments,
  review reports, read the audit log.
- **Roles** for administrators, project owners, auditors, companies and the public.
  Details: [roles-and-features.md](docs/project/roles-and-features.md).

Announcements are imported from the agencies' public APIs (Bangkok e-GP, national
e-GP, data.go.th) and the MEA procurement site.

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, next-intl (TH/EN) |
| Backend | NestJS 11, MongoDB Node driver |
| Database | MongoDB 7 |
| Auth | Password (scrypt) and Google sign-in, HMAC-signed session cookie, passkeys for staff |
| AI (optional) | Gemini on Google Vertex AI |
| Run | Docker Compose |

## Getting started

### With Docker (recommended)

Requires Docker with Compose.

```bash
git clone https://github.com/PhomMaiWai/TorFinder.git
cd TorFinder
cp .env.example .env
```

Edit `.env`:

```bash
SESSION_SECRET=<output of: openssl rand -base64 32>   # required, 32+ characters
SEED_DEMO_DATA=true                                    # demo accounts, your own machine only
```

Then start everything:

```bash
docker compose up -d --build
```

Open <http://localhost:3000>. The database starts with a snapshot of real TOR
records.

```bash
docker compose logs -f backend   # follow the backend log
docker compose down              # stop, keep the data
docker compose down -v           # stop and wipe the data; the next start re-seeds
```

### Running without Docker

Requires Node.js 22+ and a MongoDB 7 server.

```bash
# terminal 1: API on http://localhost:4000
cd backend
npm install
cp .env.example .env
#   in .env, point MONGODB_URI at your MongoDB, e.g.
#   MONGODB_URI=mongodb://localhost:27017/torfinder
npm run dev

# terminal 2: web app on http://localhost:3000
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

The example `MONGODB_URI` is for the Docker database, which needs TLS
certificates; [configuration.md](docs/operations/configuration.md#backend-outside-docker-database-in-docker)
shows how to use it. Both example files share the same development
`SESSION_SECRET`; if you change it, change it in both.

## Demo accounts

`npm run dev` creates these by default; Docker creates them when `.env` sets
`SEED_DEMO_DATA=true`. The passwords are public, so never enable them on a server
other people can reach.

| Role | Email | Password | Sign in at |
| --- | --- | --- | --- |
| Administrator | `admin@bma.go.th` | `Admin1234!` | `/login/admin` |
| Administrator (second) | `admin2@bma.go.th` | `Admin2345!` | `/login/admin` |
| Project owner | `owner@bma.go.th` | `Owner1234!` | `/login/admin` |
| Auditor | `auditor@bma.go.th` | `Auditor1234!` | `/login/admin` |
| Company (approved) | `contact@arundigital.co.th` | `Org12345!` | `/login/organization` |
| Company (pending) | `contact@techworks.co.th` | `Tech12345!` | `/login/organization` |
| Company (pending) | `hello@datacraft.co.th` | `Data12345!` | `/login/organization` |

Members of the public sign in with Google at `/login/public`. A pending company
can sign in only after an administrator approves it at `/admin/accounts`.

## Configuration

All settings are environment variables; nothing secret is in the code. The ones
you are most likely to set:

| Variable | Where | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | backend, frontend | Signs sessions. Required in production, 32+ characters, same value in both |
| `MONGODB_URI` | backend | Database connection |
| `FRONTEND_ORIGIN` | backend | The only origin CORS allows |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | backend / frontend | Google sign-in; empty hides the button |
| `VERTEX_PROJECT_ID` | backend | Turns on AI extraction; empty turns it off |
| `RESEND_API_KEY`, `LINE_CHANNEL_ACCESS_TOKEN` | backend | Email and LINE notifications; empty turns them off |

The full list with defaults is in
[configuration.md](docs/operations/configuration.md#environment-variables) and the
`.env.example` files.

## Security

TorFinder is reviewed against [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/):
no Level 1 or Level 2 requirement fails, and 68 of the 72 Level 3 requirements that
apply pass. Highlights:

- scrypt password hashes, a breached-password check, email verification and lockout
- Google sign-in with verified ID tokens; passkeys for staff
- a role guard on every API route; every query scoped to the signed-in account
- whitelisting input validation and escaped MongoDB queries
- CORS for the frontend's origin only; nonce-based CSP, HSTS and other security headers
- rate limits on sign-in and on the whole API; idle and absolute session timeouts
- structured security logs that never contain passwords or tokens
- CodeQL, Semgrep and OWASP ZAP scans, and `npm audit` in CI

The ASVS reports, threat model, OWASP Top 10 mapping and scan reports are in
[docs/security/](docs/security/project-document.md). To report a vulnerability,
see [SECURITY.md](SECURITY.md).

## Running the security checks

These are the checks CI runs in
[`.github/workflows/security.yml`](.github/workflows/security.yml).

**Security regression tests** (authentication, access control, NoSQL injection,
rate limits). They need a MongoDB you can throw away and a backend started with
the test settings:

```bash
cd backend
npm ci && npm run build
export NODE_ENV=development SEED_DEMO_DATA=true VERTEX_PROJECT_ID= \
  MONGODB_URI=mongodb://localhost:27017/torr_sec \
  SESSION_SECRET=ci-test-secret-not-for-production \
  FRONTEND_ORIGIN=http://localhost:3000 \
  EGP_POLL_MINUTES=0 EGP_POLL_ON_STARTUP=false MEA_POLL_MINUTES=0 \
  DATAGOV_POLL_MINUTES=0 GPROC_POLL_MINUTES=0 AI_POLL_MINUTES=0 \
  THROTTLE_LIMIT=300 AUTH_THROTTLE_LIMIT=5 AUTH_THROTTLE_TTL_MS=60000 \
  E2E_BASE_URL=http://localhost:4000
node dist/main.js &
until curl -sf http://localhost:4000/health; do sleep 1; done   # wait for the backend
node --test --test-reporter=spec test/security-owasp.e2e.test.mjs
```

**Dependency audit**: fails on high or critical advisories in production
dependencies.

```bash
(cd backend  && npm ci --ignore-scripts && node ../.github/scripts/npm-audit.mjs backend)
(cd frontend && npm ci --ignore-scripts && node ../.github/scripts/npm-audit.mjs frontend)
```

**Secret scan of the whole git history** (needs a full clone, not `--depth 1`):

```bash
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.21.2 detect --source /repo --redact --no-banner -v
```

**HTTP security headers**, with the app running:

```bash
curl -sI http://localhost:3000/ | grep -iE 'content-security|strict-transport|x-content-type|referrer'
```

**SAST and DAST**: CodeQL runs on every pull request (GitHub → Security → Code
scanning). The Semgrep and OWASP ZAP commands we used, with their results, are in
[sast-report.md](docs/security/sast-report.md#how-to-reproduce) and
[dast-report.md](docs/security/dast-report.md#how-to-reproduce). Only scan your
own local copy: the ZAP active scan sends attack payloads.

**The full test suite** (about 900 backend tests) needs more settings; follow
[testing.md](docs/process/testing.md).

## Project structure

```
backend/     NestJS API: one folder per feature (auth, tor, matching, …)
frontend/    Next.js app: routes in src/app, shared code in src/lib
docker/      certificates, database seed and hardening config for Compose
docs/        requirements, design, process, operations and security docs
```

[architecture.md](docs/architecture.md) has the full code map.

## Documentation

- [docs/](docs/README.md): requirements, design diagrams, API reference, process
  and operations
- [developer-guide.md](docs/process/developer-guide.md): branches, commits and pull
  requests

## Team

| Name | GitHub |
| --- | --- |
| Sai Khun Main | [@SKlv1ain](https://github.com/SKlv1ain) |
| Nisara Ploysuttipol | [@fcxbsyo](https://github.com/fcxbsyo) |
| Bhumipat Kusalatham | [@OverCatX](https://github.com/OverCatX) |

Built at Kasetsart University for 01219346 Collaborative Software Process and
Project Management and 01219325 Software Development Security.

## License

[MIT](LICENSE)
