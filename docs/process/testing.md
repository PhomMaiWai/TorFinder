# Testing

How to run TorFinder's tests, what they cover, and what CI checks. Both apps
use Node's built-in test runner (`node --test`) and `fetch`; there is no
Jest, Vitest or browser automation.

| | Backend | Frontend |
| --- | --- | --- |
| Folder | `backend/test/` | `frontend/test/` |
| Files | 38 | 9 |
| Test cases | about 520 | about 77 |
| Command | `npm run test:e2e` | `npm run test:e2e` |
| Runs in CI | ✅ Yes | ❌ No (lint and build only) |

## Two kinds of test

**Unit tests** (`*.test.mjs` / `*.test.mts`, no `e2e` in the name) call pure
functions directly. Backend unit tests import from the compiled `dist/`
folder, so run `npm run build` first. Frontend unit tests import TypeScript
from `src/` directly, using Node's built-in TypeScript support (Node
22.18 or newer).

**End-to-end tests** (`*.e2e.test.mjs`) send real HTTP requests to a running
server backed by a real MongoDB, then check the response and the database.
Many of them mint session tokens with `SESSION_SECRET` instead of signing in,
so the secret must match the server's.

## Running the backend tests

You need MongoDB running and a backend built and started against it, with
the importers and AI turned off. These are the same settings CI uses
(`.github/workflows/auth.yml`):

```bash
cd backend
npm ci
npm run build

export NODE_ENV=development
export MONGODB_URI=mongodb://localhost:27017/torr_test   # a database you can throw away
export SESSION_SECRET=test-secret
export SEED_DEMO_DATA=true
export EGP_POLL_MINUTES=0 EGP_POLL_ON_STARTUP=false
export MEA_POLL_ON_STARTUP=false DATAGOV_POLL_ON_STARTUP=false GPROC_POLL_ON_STARTUP=false
export VERTEX_PROJECT_ID=
export THROTTLE_LIMIT=300 AUTH_THROTTLE_LIMIT=300   # see the note below
export E2E_BASE_URL=http://localhost:4000

node dist/main.js &          # start the backend
npm run test:e2e             # in the same shell, so the tests see the same env
```

Run one file with `node --test test/matching.e2e.test.mjs`. Unit tests only
need `npm run build`, not a running server.

Why the rate limits are raised: the whole suite shares one backend process,
and the login limit (5 per minute by default) would run out long before the
auth tests that check it. Those tests size their own requests from
`AUTH_THROTTLE_LIMIT`, so raising it doesn't weaken them.

Use a throwaway database. The suites insert and delete their own records,
but a failed run can leave rows behind.

## Running the frontend tests

The frontend end-to-end tests need **both** a backend and a production
build of the frontend (`next build && next start`), pointed at the same
database:

```bash
# backend running as above, on :4000
cd frontend
npm ci
export BACKEND_URL=http://localhost:4000
export SESSION_SECRET=test-secret            # same as the backend
npm run build && npm run start &             # http://localhost:3000

export E2E_BACKEND_URL=http://localhost:4000
export E2E_FRONTEND_URL=http://localhost:3000
export MONGODB_URI=mongodb://localhost:27017/torr_test   # the backend's database
npm run test:e2e
```

The default `MONGODB_URI` in these tests is a plain, password-protected
MongoDB on localhost (`mongodb://torr:torr@localhost:27017/torr?authSource=admin`).
The Docker Compose database needs TLS with the dev certificate and the
generated root password, so export the URI from the README's "Only the database
in Docker?" instead ([key-management.md](../operations/key-management.md#database-passwords)),
or use a throwaway MongoDB as CI does. Some suites
refuse to run against a database that already has data in it; point them at
a fresh one.

## What CI runs

`.github/workflows/auth.yml` runs on every push to `main` and every pull
request that touches `backend/`, `frontend/` or the workflow file. It does
not run for documentation-only changes.

| Job | Steps |
| --- | --- |
| Backend | `npm ci`, lint, build, start the backend against a MongoDB 7 service, wait for `/health`, run every backend test |
| Frontend | `npm ci`, lint, build. **The frontend tests are not run.** |
| Docker images | Build the backend and frontend images (after both jobs pass); nothing is pushed |

So a change that only breaks a frontend test still goes green in CI. Run
`frontend/` tests yourself before merging frontend work, or add a CI job for
them (it needs the backend and `next start` running, like the steps above).

## What is covered

### Backend

| Area | Files | What they check |
| --- | --- | --- |
| Sign-in and accounts | `auth.e2e`, `oauth.e2e`, `account-links.e2e`, `accounts.e2e`, `admin-edit-users.e2e`, `user-edit-conflict`, `roles.e2e`, `role-guards` | Sign-up, login and its rate limit, Google sign-in, reset and verify links, company profile, approval, roles, suspension, every guard |
| TORs | `tor.e2e`, `tor-integration.e2e`, `tor-corrections.e2e`, `tor-corrections`, `tor-stages` | CRUD, soft delete, manual vs imported records, locked fields, stage model |
| Importers | `tor-normalize-dedup`, `scope-filter`, `mea-client`, `mea.e2e`, `datagov.e2e`, `admin-alerts` | Normalising and de-duplicating records, the Bangkok scope rule, MEA page parsing, data.go.th import, sync failure alerts |
| Matching | `matching-scoring`, `matching.e2e`, `match-alerts`, `match-alerts.e2e`, `bid-insight` | Score rules, ranking, which alerts are sent and when, bid suggestion |
| AI | `extraction-confidence`, `proposal-draft`, `feedback-deadline` | Confidence assessment, proposal prompt, cleaning dates read by the model. No model is ever called |
| Public input | `feedback-window.e2e`, `feedback-deadline.e2e`, `reports.e2e` | Comment window, feedback deadline, reporting problems |
| Signed-in features | `saved-tors.e2e`, `saved-searches.e2e`, `notifications.e2e`, `notification-delivery`, `line-link.e2e` | Bookmarks, saved searches, notifications and channels (fetch is faked), linking LINE |
| Admin | `admin-dashboard.e2e`, `audit-hooks.e2e` | Dashboard data, audit entries for admin actions |

### Frontend

| File | What it checks |
| --- | --- |
| `admin-dashboard.e2e` | Admin dashboard pages render the backend's real numbers |
| `admin-reports.e2e` | `/admin/reports` and the "Report a problem" button |
| `saved-searches-api.e2e` | The `/api/saved-searches` route handlers forward the session |
| `tor-search-sort.e2e` | Search result order for each `?sort=` |
| `tor-timeline.e2e` | The TOR page renders the stage timeline |
| `feedback-window` (unit) | "Open for comments until…" logic |
| `tor-deadline-filter` (unit) | "Closing within" filter |

### Not covered

- No browser tests: nothing clicks through the UI, so client-side
  interactions (forms, filters in the browser) are only checked by hand.
- By default no real call is made to e-GP, MEA, data.go.th, Vertex AI,
  Resend, LINE or Slack; those clients are faked or skipped. Live import
  checks exist but are opt-in: set `E2E_EGP_LIVE=1`, `E2E_MEA_LIVE=1` or
  `E2E_DATAGOV_LIVE=1` to run them against the real portals.
- No load or performance tests for the NFR targets (page load under 2 s,
  100 concurrent users).
- FR-07: the keyword filter that decides "software or not" at import
  (`backend/src/common/software-filter.ts`) has no test of its own. Only
  the admin override of the classification is tested.

## Functional requirements: release check (v1.0)

Every functional requirement in the [SRS](../requirements/srs.md) (#171),
with the automated tests that cover it and a manual check on the release
build. Feature status comes from
[roles-and-features.md](../project/roles-and-features.md#feature-status-against-the-srs).

**Automated:** every backend test passed in CI on `main` at `85d6251` (25
Nov 2026, workflow "Auth flow CI/CD"). Frontend tests are run by hand (see
[What CI runs](#what-ci-runs)).

**Manual:** done on a fresh `docker compose up` of the release commit with
the demo accounts. Write ✅ or ❌, with the date and initials. A ❌ gets an
issue under milestone D11.

| FR | Requirement | Status | Automated tests | Manual check |
| --- | --- | --- | --- | --- |
| FR-01 | Register and sign in (email/password, Google) | ✅ Done | `auth.e2e`, `oauth.e2e`, `account-links.e2e`, `password-rehash.e2e` | |
| FR-02 | Profile, bookmarks, notifications need sign-in | ✅ Done | `role-guards`, `roles.e2e`; frontend `workspace-separation.e2e` | |
| FR-03 | Admin manages accounts and permissions | ✅ Done | `accounts.e2e`, `admin-approvals.e2e`, `admin-edit-users.e2e` | |
| FR-04 | Import TORs from e-GP for BMA | ✅ Done | `tor-integration.e2e`, `portal-fetch`, `mea.e2e`, `datagov.e2e` | |
| FR-05 | De-duplicate across sources | ✅ Done | `tor-normalize-dedup` | |
| FR-06 | Log and alert admin on sync failure | ✅ Done | `admin-alerts` | |
| FR-07 | Classify software / not software | ✅ Done | Admin override only: `tor-corrections.e2e`. **No test for the import filter** | |
| FR-08 | AI extracts scope, qualifications, price, deadline | ✅ Done (needs `VERTEX_PROJECT_ID`) | `extraction-confidence`, `tender-bundle`, `document-metadata`, `feedback-deadline` (model faked) | Skip without Vertex AI credentials |
| FR-09 | Search by keyword, agency, category | ✅ Done | `tor.e2e`; frontend `tor-search-sort.e2e` | |
| FR-10 | Filter by budget, deadline, tech stack | 🟡 Partial: no tech-stack filter | frontend `tor-deadline-filter` | |
| FR-11 | Full detail and link to the original | ✅ Done | `tor.e2e`; frontend `leaving-link`, `served-files` | |
| FR-12 | Company matching profile | ✅ Done | `accounts.e2e`, `matching.e2e` | |
| FR-13 | Score each TOR against the profile | ✅ Done | `matching-scoring`, `matching.e2e`, `similar.e2e`, `similar-text` | |
| FR-14 | Notify above a set score | ✅ Done | `match-alerts`, `match-alerts.e2e`, `notifications.e2e`, `notification-delivery`, `line-link.e2e` | |
| FR-15 | Bookmark a TOR | ✅ Done | `saved-tors.e2e` | |
| FR-16 | Save and reuse a search | ✅ Done | `saved-searches.e2e`; frontend `saved-searches-api.e2e` | |
| FR-17 | Show the lifecycle stage | ✅ Done | `tor-stages`; frontend `tor-timeline.e2e` | |
| FR-18 | Flag TORs open for feedback | ✅ Done | `feedback-deadline.e2e`; frontend `feedback-window` | |
| FR-19 | Public feedback on a draft | ✅ Done | `feedback-window.e2e`, `form-timing.e2e` | |
| FR-20 | Owner sees match count and feedback | ❌ Removed 22 Nov (PR #416) | — | — |
| FR-21 | Report an error on a listing | ✅ Done | `reports.e2e`; frontend `admin-reports.e2e` | |
| FR-22 | Admin corrects a record or classification | ✅ Done | `tor-corrections.e2e`, `tor-corrections` | |
| FR-23 | Admin hides spam or abusive feedback | ✅ Done | `asvs-l1-regressions.e2e` (rejected comment hidden from the public) | |
| FR-24 | Flag unusual pricing or low competition | ❌ Removed 22 Nov (PR #414) | — | — |
| FR-25 | Audit trail of admin actions | ✅ Done | `audit-hooks.e2e`, `admin-dashboard.e2e`, `retention.e2e` | |
| FR-26 | Only BMA, only 2022 onward | ✅ Done | `scope-filter` | |

**Result:** 23 of the 24 in-scope FRs are done and FR-10 is partial. Every
in-scope FR has at least one automated test, but for FR-07 only the admin
override is tested, not the import filter. Manual check: _ of 24
passed on _.

## Writing a new test

- Put it in `backend/test/` or `frontend/test/`, named after the feature:
  `<feature>.e2e.test.mjs` for HTTP tests, `<feature>.test.mjs` for pure
  logic.
- Start the file with a comment saying what it covers and what it relies on;
  every existing file does.
- Use `node:test` (`describe`, `it`) and `node:assert/strict`.
- Create the data you need and delete it in `after()`. Use a recognisable
  prefix (for example `"E2E: ..."` in titles) so leftovers are easy to find.
- Keep business rules in pure functions so they can be unit-tested from
  `dist/` without a server.
