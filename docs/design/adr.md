# Architectural Decision Records

The main design decisions behind TorFinder. Each one says what we chose,
why, and what it costs. To change a decision, add a new ADR; don't edit the
old one.

| ADR | Decision | Date |
| --- | --- | --- |
| [001](#adr-001-separate-backend) | Separate NestJS backend; the browser never calls it | 4 Sep 2026 |
| [002](#adr-002-mongodb-without-an-orm) | MongoDB without an ORM | 29 Aug 2026 |
| [003](#adr-003-our-own-signed-session-token) | Our own signed session token | 4 Sep 2026 |
| [004](#adr-004-match-score-by-rules-not-ai) | Match score by rules, not AI | 10 Sep 2026 |
| [005](#adr-005-ai-is-optional) | AI is optional | 10 Sep 2026 |
| [006](#adr-006-imports-run-inside-the-backend) | Imports run inside the backend | 16 Sep 2026 |
| [007](#adr-007-fixed-source-rank-for-duplicates) | Fixed source rank for duplicates | 16 Sep 2026 |
| [008](#adr-008-stream-documents-dont-store-them) | Stream documents, don't store them | 26 Oct 2026 |
| [009](#adr-009-docs-in-the-repo) | Docs in the repo | 11 Nov 2026 |
| [010](#adr-010-drop-auditor-and-project-owner-roles) | Drop Auditor and Project Owner roles | 22 Nov 2026 |
| [011](#adr-011-ship-as-docker-compose) | Ship as Docker Compose | 25 Nov 2026 |

## ADR-001: Separate backend

- **Decision:** All logic lives in a NestJS backend. The Next.js app only
  calls it from the server, so the browser never sees `BACKEND_URL`.
- **Why:** imports, schedulers and AI don't belong in page code, and roles
  are checked in one place.
- **Cost:** a new feature usually touches both services.
- **Evidence:** PR #30

## ADR-002: MongoDB without an ORM

- **Decision:** MongoDB with the official driver, no Mongoose. Indexes are
  made in code at start-up.
- **Why:** each source gives different fields, and AI output is nested, so
  the shape kept changing.
- **Cost:** the database doesn't validate anything; DTOs and tests do.
- **Evidence:** PR #28, PR #271 (moved from Atlas to the Compose database)

## ADR-003: Our own signed session token

- **Decision:** the backend signs the session with HMAC-SHA-256
  (`SESSION_SECRET`); the frontend checks it from an httpOnly cookie.
- **Why:** the frontend knows who is signed in without calling the backend,
  and one fixed algorithm leaves nothing to misconfigure.
- **Cost:** both services need the same secret, and logout needs a
  revocation check (`sessionMinIssuedAt`, PR #278).
- **Evidence:** PR #34, `backend/src/common/token.ts`

## ADR-004: Match score by rules, not AI

- **Decision:** `scoreMatch()` scores work type, eligibility and project
  size with fixed weights. Alerts go out at 70+.
- **Why:** same input gives the same score, a company can see why, and it
  can be unit tested.
- **Cost:** it only knows the skills and work types we listed.
- **Evidence:** PR #61, PR #75, `backend/src/matching/matching.scoring.ts`

## ADR-005: AI is optional

- **Decision:** Vertex AI only reads TOR documents, drafts proposals and
  ranks "find similar". Without `VERTEX_PROJECT_ID` all three turn off and
  find similar falls back to keywords.
- **Why:** the app, tests and demo must run without a GCP account.
- **Cost:** without AI, TORs have only what the source gave.
- **Evidence:** PR #61, PR #314

## ADR-006: Imports run inside the backend

- **Decision:** each source (Bangkok e-GP, national e-GP, MEA) has a timer
  inside the backend process. No separate worker or queue.
- **Why:** three containers are the whole system.
- **Cost:** it assumes one backend instance.
- **Evidence:** PR #57, PR #117, `backend/src/common/sync-scheduler.ts`

## ADR-007: Fixed source rank for duplicates

- **Decision:** when sources overlap, **manual > egp > gproc > mea**. An
  import never overwrites an admin's record.
- **Why:** admin corrections must survive every later import.
- **Cost:** a reworded title can slip past the duplicate check.
- **Evidence:** PR #72, `backend/src/tor/tor.constants.ts`

## ADR-008: Stream documents, don't store them

- **Decision:** a TOR file is fetched from the portal and streamed to the
  reader. Only files already on the announcement can be opened.
- **Why:** no file storage to run, and the file is always the portal's own.
- **Cost:** if the portal is down, the file can't be opened.
- **Evidence:** PR #270, `backend/src/tor/tor-document.service.ts`

## ADR-009: Docs in the repo

- **Decision:** no wiki. Docs are Markdown with Mermaid diagrams in
  `docs/`, updated in the same PR as the code.
- **Why:** docs get reviewed with the code and stay up to date.
- **Cost:** Mermaid limits layout.
- **Evidence:** PR #308, PR #309

## ADR-010: Drop Auditor and Project Owner roles

- **Decision:** remove both roles. Accounts are `admin`, `org` or `viewer`.
- **Why:** each had one read-only page that nobody used.
- **Cost:** FR-20 and FR-24 are removed from the SRS (24 active FRs).
- **Evidence:** PR #414, PR #416

## ADR-011: Ship as Docker Compose

- **Decision:** v1.0 is a release that runs with `docker compose up`, not a
  hosted site.
- **Why:** no hosting was chosen, and the demo runs locally.
- **Cost:** no public URL yet.
- **Evidence:** [deliverables.md](../project/deliverables.md) D10
