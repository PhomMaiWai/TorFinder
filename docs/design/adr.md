# Architectural Decision Records

Short notes on the main design decisions. Dates are when the change was
merged; the PR numbers show where.

## ADR-001: A separate backend the browser never calls (2026-09-04)

**Context.** Imports, schedulers, matching and AI calls were coming, and
none of them belong in page code. Roles also had to be checked in one place.

**Decision.** All logic lives in a NestJS backend. The Next.js app calls it
only from the server, so `BACKEND_URL` never reaches the browser (PR #30).

**Trade-offs.** A new feature usually touches both services, and some calls
need a small proxy route in `frontend/src/app/api`.

## ADR-002: MongoDB without an ORM (2026-08-29)

**Context.** Each source gives different fields and the AI adds a nested
`extraction` object, so the data shape kept changing.

**Decision.** MongoDB with the official driver, no Mongoose. Indexes are
created in code when the backend starts (PR #28). Since PR #271 we use the
`mongo:7` container from Docker Compose instead of Atlas.

**Trade-offs.** New fields need no migration, but the database checks
nothing; DTOs and tests have to.

## ADR-003: Our own signed session token (2026-09-04)

**Context.** The frontend has to know who is signed in on every page without
asking the backend each time.

**Decision.** The backend signs the session with HMAC-SHA-256 and
`SESSION_SECRET`. The frontend keeps it in an httpOnly cookie, checks the
signature itself and forwards it to the backend (PR #34). One fixed
algorithm, so there is nothing to misconfigure.

**Trade-offs.**
- Both services need the same secret.
- A signed token can't be taken back by itself, so logout and suspension
  needed a revocation check, `sessionMinIssuedAt` (PR #278).

## ADR-004: Match score by rules, not AI (2026-09-10)

**Context.** The score decides which company gets an alert, so it has to be
explainable and the same every time.

**Decision.** `scoreMatch()` is a plain function over work type, eligibility
(capital, past contracts, certificates) and project size, with fixed
weights. Alerts go out at 70 or more (PR #61, tests in PR #75).

**Trade-offs.** Easy to test and explain, but it only knows the skills and
work types we listed.

## ADR-005: AI is optional (2026-09-10)

**Context.** Reading long Thai TOR PDFs by hand doesn't scale, but Vertex AI
needs a paid GCP project that laptops and CI don't have.

**Decision.** Vertex AI only reads TOR documents, drafts proposals and ranks
"find similar". Without `VERTEX_PROJECT_ID` all three switch off and find
similar falls back to keyword ranking (PR #61, PR #314). The AI never
decides an import, a score or an approval.

**Trade-offs.** The app, tests and demo run without GCP, but without AI a
TOR has only what its source gave.

## ADR-006: Imports run inside the backend (2026-09-16)

**Context.** TORs come from Bangkok e-GP, the national e-GP and MEA, and we
had no budget for a separate queue or worker.

**Decision.** Each source has a timer inside the backend process
(`SyncScheduler`). A keyword filter keeps only software projects (PR #57,
PR #117).

**Trade-offs.** Three containers are the whole system, but it assumes one
backend instance: timers and rate limits live in memory.

## ADR-007: Fixed source rank for duplicates (2026-09-16)

**Context.** The same project is often published by several sources, and an
admin may already have corrected it.

**Decision.** When records overlap, **manual > egp > gproc > mea**. An
import never overwrites or deletes an admin's record (PR #72).

**Trade-offs.** Admin fixes survive every import, but a reworded title can
slip past the duplicate check.

## ADR-008: Stream documents, don't store them (2026-10-26)

**Context.** People want to open the TOR PDF inside TorFinder, but keeping
copies means storage and files we don't own.

**Decision.** The backend fetches the file from the portal and streams it to
the reader. Only files already listed on the announcement can be opened, not
any URL (PR #270).

**Trade-offs.** No file storage to run, but if the portal is down the file
can't be opened.

## ADR-009: Docs in the repo, not a wiki (2026-11-11)

**Context.** The design diagrams have to stay true as the code changes.

**Decision.** Docs are Markdown with Mermaid diagrams in `docs/`, updated in
the same PR as the code (PR #308, PR #309).

**Trade-offs.** Docs are reviewed with the code, but Mermaid limits layout.

## ADR-010: Drop the Auditor and Project Owner roles (2026-11-22)

**Context.** Each role had one read-only page that nobody used, but still
added guards, routes and tests.

**Decision.** Remove both. Accounts are now `admin`, `org` or `viewer`
(PR #414, PR #416).

**Trade-offs.** Less code to secure, but FR-20 and FR-24 are removed from
the SRS (24 active FRs).

## ADR-011: Ship as Docker Compose (2026-11-25)

**Context.** No hosting was chosen and the demo runs on a local copy.

**Decision.** v1.0 is a release that runs with `docker compose up` from a
fresh clone ([deliverables.md](../project/deliverables.md) D10).

**Trade-offs.** Anyone can run the presented version, but there is no public
URL yet.
