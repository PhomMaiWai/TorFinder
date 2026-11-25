# Architectural Decision Records

The design decisions that shaped TorFinder, one per section: what we had to
decide, what we chose, and what it costs us. Each one is written from the
code on `main` and the pull request that brought it in, so it can be checked.

These record **design decisions**, not how the team worked. Process changes
(review on `main`, issue linking, Definition of Done) are in
[retrospectives.md](../process/retrospectives.md). Decisions about scope and
deliverables are in [deliverables.md](../project/deliverables.md#decisions-that-changed-the-deliverables).

**Status** is one of *Accepted* (what the code does today), *Changed*
(still in force, but a later change adjusted it) or *Superseded* (replaced;
the record says by what). To change a decision, add a new ADR and mark the
old one; don't rewrite history.

| ADR | Decision | Date | Status |
| --- | --- | --- | --- |
| [001](#adr-001-a-separate-nestjs-backend-the-browser-never-calls-it) | A separate NestJS backend; the browser never calls it | 4 Sep 2026 | Accepted |
| [002](#adr-002-mongodb-through-the-official-driver-no-orm) | MongoDB through the official driver, no ORM | 29 Aug 2026 | Changed |
| [003](#adr-003-our-own-hmac-signed-session-token-checked-in-both-services) | Our own HMAC-signed session token, checked in both services | 4 Sep 2026 | Changed |
| [004](#adr-004-match-scores-are-rules-not-ai) | Match scores are rules, not AI | 10 Sep 2026 | Accepted |
| [005](#adr-005-vertex-ai-is-optional-and-only-reads) | Vertex AI is optional and only reads | 10 Sep 2026 | Changed |
| [006](#adr-006-official-sources-imported-inside-the-backend-process) | Official sources, imported inside the backend process | 16 Sep 2026 | Accepted |
| [007](#adr-007-a-fixed-rank-decides-which-copy-of-a-tor-wins) | A fixed rank decides which copy of a TOR wins | 16 Sep 2026 | Accepted |
| [008](#adr-008-stream-tor-documents-never-store-them) | Stream TOR documents, never store them | 26 Oct 2026 | Accepted |
| [009](#adr-009-design-docs-live-in-the-repo-as-markdown-and-mermaid) | Design docs live in the repo as Markdown and Mermaid | 11 Nov 2026 | Accepted |
| [010](#adr-010-drop-the-auditor-and-project-owner-roles) | Drop the Auditor and Project Owner roles | 22 Nov 2026 | Accepted |
| [011](#adr-011-ship-v10-as-a-docker-compose-release) | Ship v1.0 as a Docker Compose release | 25 Nov 2026 | Accepted |

---

## ADR-001: A separate NestJS backend; the browser never calls it

**Date:** 4 Sep 2026 · **Status:** Accepted · **Evidence:** PR #30 (`backend/` created), `frontend/src/lib/*-api.ts`

**Context.** The first commits were a single Next.js app talking to MongoDB
directly. Importers, schedulers, matching and AI calls were coming, and none
of them belong in a request handler that a serverless runtime may freeze.

**Decision.** Business logic lives in a NestJS backend (`backend/`), one
module per area. The Next.js app is a front end only: Server Components,
Server Actions and the thin `/api/*` route handlers call the backend from
the server, using `BACKEND_URL`, which is never sent to the browser.

**Consequences.**
- One place enforces roles and validation. The backend's CORS allow-list
  is a second line of defence, not the first.
- Every new screen needs a backend route and often a small proxy route in
  `frontend/src/app/api`, so features touch two services.
- The frontend's own MongoDB connection was removed in Nov 2026
  (`frontend/src/lib/mongodb.ts`); `mongodb` stays there only for e2e tests.

## ADR-002: MongoDB through the official driver, no ORM

**Date:** 29 Aug 2026 · **Status:** Changed (Atlas → Compose, 27 Oct) · **Evidence:** PR #28, PR #271, `backend/src/database/database.service.ts`

**Context.** A TOR from e-GP, one from MEA and one an admin types in carry
different fields, and the AI adds a nested `extraction` object later. The
shape was still moving every week.

**Decision.** Store everything in MongoDB and use the official `mongodb`
driver with typed helpers, not Mongoose or an ORM. Indexes are created in
code at start-up (`DatabaseService`), so a fresh database is ready without a
migration step. The database first ran on MongoDB Atlas; since PR #271 the
team and the demo use the `mongo:7` container from `docker-compose.yml`,
seeded from `docker/mongo-seed/` when its volume is empty.

**Consequences.**
- Adding a field needs no migration, and nested AI output fits as is.
- Nothing stops a bad document at the database: validation is the DTOs'
  job (`class-validator`) and the tests'.
- Joins are done by hand (references by id), see
  [er-diagram.md](./er-diagram.md).

## ADR-003: Our own HMAC-signed session token, checked in both services

**Date:** 4 Sep 2026 · **Status:** Changed (revocation 28 Oct, rotation 20 Nov) · **Evidence:** PR #34, PR #278, `backend/src/common/token.ts`, `frontend/src/lib/auth.ts`

**Context.** The frontend has to know on every navigation who is signed in
and with which role, without a round trip to the backend. The backend has to
trust the same identity when the frontend forwards it.

**Decision.** The backend signs a small payload (`sub`, `email`, `role`,
`iat`, `exp`, …) with HMAC-SHA-256 using `SESSION_SECRET`. The frontend keeps
it in the `torr_session` httpOnly cookie and checks the signature itself with
Web Crypto in `proxy.ts`; it sends the token to the backend as
`Authorization: Bearer`. We used Node's `crypto` rather than a JWT library:
the format is ours, there is only one algorithm, so there is no `alg` header
to get wrong.

**Consequences.**
- Both services must share the same `SESSION_SECRET`.
- A signed token can't be taken back by itself. PR #278 added
  `sessionMinIssuedAt` (logout, password reset, suspension end older
  tokens); later work added a `sessions` record per sign-in and a grace
  period for rotating the secret.
- `jose` is still listed in `frontend/package.json` from an early try but no
  code imports it.

## ADR-004: Match scores are rules, not AI

**Date:** 10 Sep 2026 · **Status:** Accepted · **Evidence:** PR #61, PR #75 (tests), `backend/src/matching/matching.scoring.ts`

**Context.** A company has to trust why a TOR was or wasn't sent to it, and
the score decides who gets an alert. A model's score can change between runs
and is hard to test.

**Decision.** `scoreMatch(tor, company)` is a plain function: work type,
eligibility (registered capital, past contract size, certifications) and
project size, with fixed weights in `matching.constants.ts`. AI only supplies
inputs (the qualifications it read from the PDF). An alert goes out at 70 or
more (`NOTIFY_MATCH_THRESHOLD`).

**Consequences.**
- Same input, same score; the reasons shown to the company are the rules
  that fired, and the boundaries are covered by unit tests.
- It only knows the skills and work types we wrote down; a new kind of
  project scores low until the lists are updated.
- Some early documents (project plan, requirements summary) still say "AI
  match scoring"; this ADR is what the code does.

## ADR-005: Vertex AI is optional and only reads

**Date:** 10 Sep 2026 · **Status:** Changed (embeddings added 11 Nov) · **Evidence:** PR #61, PR #314, `backend/src/ai/`, `backend/src/similar/similar.service.ts`

**Context.** TOR PDFs are long Thai documents, and reading budget, deadline
and qualifications out of them by hand doesn't scale. But a GCP project costs
money, needs credentials, and isn't available on every laptop or in CI.

**Decision.** Gemini on Vertex AI is used for three things only: reading
fields out of TOR documents (`ExtractionScheduler`), drafting a proposal
when a company asks, and text embeddings for "find similar TORs". All three
switch off when `VERTEX_PROJECT_ID` is empty. Find similar falls back to
keyword (TF-IDF) ranking and says which one it used. AI output is stored as
`extraction` with a confidence, and an admin can correct it.

**Consequences.**
- The whole app, the tests and the demo run without a GCP account.
- Without AI, TORs keep only what the source gave, so match scores are
  rougher.
- No decision (import, score, approval) is made by the model alone.

## ADR-006: Official sources, imported inside the backend process

**Date:** 16 Sep 2026 · **Status:** Accepted · **Evidence:** PR #57, PR #117, `backend/src/common/sync-scheduler.ts`

**Context.** TORs are spread over Bangkok e-GP, the national e-GP and MEA.
Scraping arbitrary sites breaks often and may break their terms. We also had
no budget for a separate queue or worker service.

**Decision.** Import only from the agencies' own public channels (Bangkok
e-GP's JSON API, the national e-GP, MEA's procurement pages). Each source has a
scheduler built on `SyncScheduler` that runs inside the backend process on a
timer; an admin's "sync now" joins a run already in progress. A keyword
filter (`common/software-filter.ts`) keeps only software projects.

**Consequences.**
- No extra service to run: three containers are the whole system.
- Timers restart with the process, and rate limits are in memory, so the
  design assumes one backend instance (see
  [deployment-checklist.md](../operations/deployment-checklist.md)).
- The data.go.th importer, added under this decision, was removed on 25 Nov.

## ADR-007: A fixed rank decides which copy of a TOR wins

**Date:** 16 Sep 2026 · **Status:** Accepted · **Evidence:** PR #72, PR #117, `backend/src/tor/tor.constants.ts` (`sourceRank`), `backend/src/tor/tor-dedup-index.ts`

**Context.** The same project is often published by more than one source,
and an admin may already have typed it in or corrected it.

**Decision.** Every record carries a `sourceRef` saying where it came from,
and `sourceRank` settles duplicates: **manual > egp > gproc > mea**. An
admin's record is never overwritten or deleted by an import. Within a sync,
duplicates collapse on `projectNumber + stage`, then on a close title match
in the same stage.

**Consequences.**
- Admin corrections survive every later import.
- The rank is a judgement (Bangkok e-GP carries the files and contracts, so
  it beats the national feed); changing it means changing one constant and
  its tests.
- A title match can miss a duplicate whose title was reworded.

## ADR-008: Stream TOR documents, never store them

**Date:** 26 Oct 2026 · **Status:** Accepted · **Evidence:** PR #270, `backend/src/tor/tor-document.service.ts`

**Context.** People want to open the TOR PDF without leaving TorFinder, but
keeping copies means storage, keeping them up to date, and holding files we
don't own.

**Decision.** When someone opens a document, the backend fetches it from the
portal and streams it through to the browser. Only files already recorded
on the announcement can be opened, by position, never by a URL from the
caller, so it can't be used to reach arbitrary addresses. Nothing is written
to disk or the database.

**Consequences.**
- No file storage to run or back up, and the file is always the portal's
  current one.
- If the portal is down, the document can't be opened.
- AI extraction also downloads the file from the portal when it runs and
  keeps only the fields it read, so it depends on the portal too.

## ADR-009: Design docs live in the repo as Markdown and Mermaid

**Date:** 11 Nov 2026 · **Status:** Accepted · **Evidence:** PR #308, PR #309, [README.md](./README.md)

**Context.** The course asks for use case, domain, system, ER, class and
sequence diagrams and an API description, and they have to stay true as the
code changes.

**Decision.** No GitHub wiki and no drawing files. Diagrams are Mermaid
inside Markdown under `docs/design/`, which GitHub draws in place. A pull
request that changes what a page describes updates the page in the same PR
(the Definition of Done in [team-workflow.md](../process/team-workflow.md)).

**Consequences.**
- Docs are reviewed in the same PR as the code, and history shows when
  each changed.
- Mermaid limits layout; large diagrams are split into several.
- Each design page carries a "last reviewed against the code" line that
  someone has to keep updating.

## ADR-010: Drop the Auditor and Project Owner roles

**Date:** 22 Nov 2026 · **Status:** Accepted · **Evidence:** PR #414, PR #416, [srs.md](../requirements/srs.md) (FR-20, FR-24 marked removed)

**Context.** The SRS had five roles. The Auditor (flagged TORs, FR-24) and
Project Owner (match count and feedback per TOR, FR-20) each ended up with one
read-only page that nobody was using, and each role added guards, routes and
tests.

**Decision.** Remove both roles and their pages. Three account roles remain
(`admin`, `org`, `viewer` in `backend/src/common/roles.ts`), plus visitors
who don't sign in. Each guard admits exactly one role
(`backend/src/common/role.guard.ts`).

**Consequences.**
- Fewer guards and less code to secure for the security course.
- The SRS now has 24 active FRs; FR-20 and FR-24 stay listed as removed so
  the numbering doesn't change.
- The budget check and bid insight that FR-24 had used are still shown to
  everyone, as extras outside the SRS.

## ADR-011: Ship v1.0 as a Docker Compose release

**Date:** 25 Nov 2026 · **Status:** Accepted · **Evidence:** [deliverables.md](../project/deliverables.md) D10, [release-v1.0.md](../project/release-v1.0.md), #236

**Context.** D10 was a public HTTPS deployment, but no hosting target was
chosen and the demo runs on a local copy.

**Decision.** v1.0 is a tagged release that runs from a fresh clone with
`docker compose up`. The edge (`docker-compose.edge.yml`) and hardening
(`docker-compose.hardening.yml`) files stay so a server deploy can follow
[deployment-checklist.md](../operations/deployment-checklist.md) later.

**Consequences.**
- Anyone can run the presented version on their own machine.
- There is no public URL, so nothing is measured from real users yet.
