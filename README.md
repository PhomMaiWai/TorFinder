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
- **Roles** for administrators, companies and the public.
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

The quickest way to run TorFinder is Docker: one command starts the frontend,
the backend and the database, on macOS and Windows alike. You only need one
secret to fill in; everything else is optional.

### 1. Install the tools

| | macOS | Windows 10/11 |
| --- | --- | --- |
| Git | `xcode-select --install`, or [git-scm.com](https://git-scm.com/download/mac) | [git-scm.com](https://git-scm.com/download/win) (Git for Windows, includes Git Bash) |
| Docker | [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) (Apple silicon or Intel) | [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) with the **WSL 2** backend (the installer offers it) |
| Node.js 22+ | Only for running without Docker: [nodejs.org](https://nodejs.org/) or `brew install node@22` | Only for running without Docker: [nodejs.org](https://nodejs.org/) |

Start Docker Desktop and wait until it says it is running. Check with
`docker compose version`. Give Docker at least 4 GB of memory
(Docker Desktop → Settings → Resources).

### 2. Get the code and create `.env`

macOS (Terminal):

```bash
git clone https://github.com/PhomMaiWai/TorFinder.git
cd TorFinder
cp .env.example .env
```

Windows (PowerShell):

```powershell
git clone https://github.com/PhomMaiWai/TorFinder.git
cd TorFinder
Copy-Item .env.example .env
```

`.env` is ignored by git, so the values you put in it stay on your machine.
Never commit it. `.gitattributes` keeps the scripts the containers run in LF line
endings, so a Windows checkout works without changing any Git setting.

### 3. Fill in `.env`

Open `.env` in any editor (`open -e .env` on macOS, `notepad .env` on Windows).
Only `SESSION_SECRET` is required. For a local run, also turn on the demo
accounts:

```bash
SESSION_SECRET=<a random value of 32+ characters, see below>
SEED_DEMO_DATA=true
```

Make the `SESSION_SECRET` value with:

| macOS | Windows (PowerShell) |
| --- | --- |
| `openssl rand -base64 32` | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)` |

(Git Bash on Windows has `openssl` too.) Paste the output after
`SESSION_SECRET=` with no quotes or spaces.

Every other value can stay as it is: the app runs without them and simply
leaves that feature off. [Getting each value](#getting-each-env-value) below says
where to find them if you want the extra features.

### 4. Start it

```bash
docker compose up -d --build
```

The same command works in Terminal and PowerShell. The first start takes a few
minutes: it builds both images, makes the internal TLS certificates and the
database password, and loads a snapshot of real TOR records. Then open
<http://localhost:3000>.

```bash
docker compose ps                  # every service should be "running"
docker compose logs -f backend     # follow the backend log (Ctrl+C to stop following)
docker compose down                # stop, keep the data
docker compose down -v             # stop and wipe the data; the next start loads the snapshot again
```

After you change `.env`, run `docker compose up -d` again (add `--build` for the
`NEXT_PUBLIC_…` values, which are built into the frontend).

**If something goes wrong**

- *Port is already allocated*: something else uses 3000, 4000 or 27017. Stop it,
  or change the left-hand port in `docker-compose.yml`.
- *The backend exits with `SESSION_SECRET must be a private random value of at
  least 32 characters`*: `SESSION_SECRET` in `.env` is empty, too short, or the
  example value.
- *Windows: `set: illegal option -` or `\r: not found`*: the clone was made before
  `.gitattributes` existed. Run `git rm --cached -r . -q` then `git reset --hard`
  to check the files out again with LF endings.
- *Everyone is signed out after a change*: `SESSION_SECRET` changed. Sign in again.
- *No open TORs and no matches right after the first start*: the bundled
  snapshot is from 27 Oct 2026, so its deadlines have passed. The importers run
  on start and add new TORs from e-GP and MEA within a few minutes (this needs
  internet access); matches and alerts follow. Reload after about 3 minutes.
- *The database restarts with `No space left on device`*: Docker's disk is full.
  Check with `docker system df`, then free space with `docker builder prune`
  (build cache only) or raise the disk size in Docker Desktop → Settings →
  Resources.

### Running without Docker

Requires Node.js 22+ and a MongoDB 7 server. The commands are the same on macOS
and Windows, except for copying the example files (`cp` on macOS, `Copy-Item`
in PowerShell).

```bash
# terminal 1: API on http://localhost:4000
cd backend
npm install
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm run dev

# terminal 2: web app on http://localhost:3000
cd frontend
npm install
cp .env.example .env.local    # Windows: Copy-Item .env.example .env.local
npm run dev
```

In `backend/.env`, `MONGODB_URI` must point at your database:

- **Your own MongoDB without a password:** `MONGODB_URI=mongodb://localhost:27017/torfinder`
- **The Docker database** (`docker compose up -d db`): it only accepts TLS with a
  client certificate. Copy the development certificate out and read its
  password:

  ```bash
  docker compose run --rm certs export                               # writes docker/certs/dev/ (git-ignored)
  docker compose run --rm db-secrets cat /secrets/root-password      # the generated root password
  ```

  Then put that password in place of `<root-password>` in the example
  `MONGODB_URI` in `backend/.env`. Details:
  [configuration.md](docs/operations/configuration.md#backend-outside-docker-database-in-docker).

Both example files use the same development `SESSION_SECRET`. If you change it,
change it in both, or every signed-in request fails. `npm run dev` creates the
demo accounts by default (`SEED_DEMO_DATA=true` in `backend/.env.example`).

## Demo accounts

Created when `SEED_DEMO_DATA=true` (Docker) or by `npm run dev`. The passwords
are published here, so only turn them on for your own machine, never on a
server other people can reach.

| Role | Email | Password | Sign in at | Lands on |
| --- | --- | --- | --- | --- |
| Administrator | `admin@bma.go.th` | `Admin-Demo-2026!` | `/login/admin` | `/admin` |
| Administrator (second) | `admin2@bma.go.th` | `Admin2-Demo-2026!` | `/login/admin` | `/admin` |
| Company (approved) | `contact@arundigital.co.th` | `Arun-Demo-2026!` | `/login/organization` | `/dashboard` |
| Company (approved) | `sales@siamnetwork.co.th` | `Siam-Demo-2026!` | `/login/organization` | `/dashboard` |
| Company (approved) | `contact@itsupply.co.th` | `Supply-Demo-2026!` | `/login/organization` | `/dashboard` |
| Company (approved) | `hello@helpdeskpro.co.th` | `Help-Demo-2026!` | `/login/organization` | `/dashboard` |
| Company (approved) | `contact@softstart.co.th` | `Start-Demo-2026!` | `/login/organization` | `/dashboard` |
| Company (pending) | `contact@techworks.co.th` | `Tech-Demo-2026!` | `/login/organization` | refused until approved |
| Company (pending) | `hello@datacraft.co.th` | `Data-Demo-2026!` | `/login/organization` | refused until approved |

- A pending company is refused ("waiting for admin review") until an
  administrator approves it at `/admin/accounts`.
- Members of the public sign in with Google at `/login/public`, which needs a
  Google client ID (see below).
- Two administrators exist because granting or removing the admin role needs a
  second admin's approval.
- Staff can add a passkey at `/account`. Locally it is optional; on a real
  server, `STAFF_PASSKEYS_REQUIRED=true` makes it required.
- An older local database is fine: on start, demo accounts still on an old
  seeded password get the one above, and missing ones are added.

## Getting each `.env` value

With Docker, everything goes in the root `.env`. Without Docker, the backend
values go in `backend/.env` and the frontend ones (`SESSION_SECRET`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `BACKEND_URL`) in `frontend/.env.local`. Keep
every key and token out of git: only the `.env.example` files are committed,
and they hold no secrets.

| Variable | Needed? | Where to get it |
| --- | --- | --- |
| `SESSION_SECRET` | **Required** | Generate it (step 3 above). Same value in frontend and backend |
| `SEED_DEMO_DATA` | Local only | `true` for the demo accounts; `false` (the default) on any shared server |
| `MONGO_ROOT_PASSWORD` | No | Leave empty: the first start generates one. Read it with `docker compose run --rm db-secrets cat /secrets/root-password` |
| `FRONTEND_ORIGIN` | Only on a server | The site's public address, e.g. `https://torfinder.example.com`. Default `http://localhost:3000` |
| `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No (Google sign-in) | Already set to the team's client ID. If the Google button reports an origin or client error, make your own: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → OAuth consent screen (External, add yourself as a test user) → Credentials → **Create credentials → OAuth client ID** → *Web application* → Authorized JavaScript origins `http://localhost:3000` (and your domain). Copy the **Client ID** into both variables. There is no client secret to keep: the ID is public by design |
| `RESEND_API_KEY` | No (email alerts) | Sign up at [resend.com](https://resend.com) → **API Keys → Create API key** (Sending access). Starts with `re_`. Without a verified domain, Resend only delivers to your own address |
| `NOTIFY_EMAIL_FROM` | With Resend | Keep `TOR Finder <onboarding@resend.dev>`, or an address on a domain you verified in Resend → Domains |
| `LINE_CHANNEL_ACCESS_TOKEN` | No (LINE alerts) | [LINE Developers Console](https://developers.line.biz/console/) → your Messaging API channel → **Messaging API** tab → *Channel access token (long-lived)* → **Issue** |
| `LINE_CHANNEL_SECRET` | With LINE | Same channel → **Basic settings** → *Channel secret* |
| `LINE_BOT_ID` | With LINE | [LINE Official Account Manager](https://manager.line.biz) → Settings → the basic ID, with the `@`. Full setup, including the webhook (it needs a public HTTPS address): [line-notifications.md](docs/operations/line-notifications.md) |
| `VERTEX_PROJECT_ID` | No (AI reading of TOR PDFs, proposal drafts, find-similar) | A Google Cloud project with billing on and the **Vertex AI API** enabled ([console](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)). The project **ID**, not its name |
| `VERTEX_CREDENTIALS_FILE` | With Vertex (Docker) | Console → IAM & Admin → Service accounts → **Create** → role *Vertex AI User* → Keys → **Add key → JSON**. Save the file **outside this repository** and give its absolute path: macOS `/Users/you/.config/torfinder/gcp-vertex.json`, Windows `C:/Users/you/.config/torfinder/gcp-vertex.json` (forward slashes). Without Docker, run `gcloud auth application-default login` instead |
| `VERTEX_LOCATION`, `VERTEX_MODEL` | No | Defaults `asia-southeast1`, `gemini-2.5-flash` |
| `AI_*_PER_DAY` | No | Daily caps on AI calls visitors can trigger; 0 turns a cap off |

Slack alerts need nothing in `.env`: each company pastes its own Slack
incoming-webhook URL on its Notifications page.

The full list of settings, with defaults, is in
[configuration.md](docs/operations/configuration.md#environment-variables) and
the three `.env.example` files.

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
- [deliverables.md](docs/project/deliverables.md): what the team hands over, who
  owns it and where the evidence is
- [retrospectives.md](docs/process/retrospectives.md): how the team changed its
  process, with the evidence
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
