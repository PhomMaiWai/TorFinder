# Iteration 4 — Access Gaps, AI Classification, Scope Limits, Recovery Flows

**Dates:** Sep 17 – Sep 23, 2026
**Estimate:** 30 points · 9 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

## Planned work

1. **Close the remaining access gaps** (#135, FR-02) — Done, 2/2
   - Add guards to those endpoints, with tests for 401/403 (#136, linked PR #244)
   - Protect `/owner` in the route proxy (#186, linked PR #244)
2. **Classify each listing as software / not software with AI** (#137,
   FR-07) — In progress, 0/4
   - Gemini call with JSON output: label, confidence, reason (#138)
   - Run on all sources, store separately from published fields, batch for
     existing records (#177)
   - Show only "software" in search, matching and dashboards; low
     confidence handling (#178)
   - Tests with a mocked Gemini (#179)
3. **Finish AI field extraction** (#139, FR-08) — In progress, 1/5
   - Extract the feedback deadline as a separate field (#140)
   - Show real confidence, with a "please verify" note when low (#180,
     Done, linked PR #273)
   - Send low-confidence extractions to the Admin review list (#181)
   - Tests (#182)
   - Extract price/performance criteria as weights and explain them (#265)
4. **Limit collected data to BMA agencies and 2022 onward** (#141, FR-26) —
   Done, 4/4
   - Reject records published before 1 Jan 2022 at ingest, all sources
     (#142, linked PR #243)
   - Decide the allowed agency list and what to do with existing records
     (#174, linked PR #243)
   - One-time clean-up of stored records outside scope, count first (#175,
     linked PR #243)
   - E2E tests for the scope filter (#176, linked PR #243)
5. **Public feedback submission** (#149, FR-19) — In progress
6. **Alert Admin and retry when a sync fails** (#158, FR-06) — Done, 3/3
   - In-app notification to all admins on a failed or partial run (#161,
     linked PR #274)
   - Retry up to 3 times with backoff; "Run again" button on admin
     dashboard (#183, linked PR #279)
   - Tests (#185, linked PR #279)
7. **Password recovery and email verification** (#187, FR-01) — Done, 4/4
   - Email sender and password reset backend: request link, token with
     expiry (#188, linked PR #276)
   - "Forgot password" and "Reset password" pages (#189, linked PR #276)
   - Email verification on sign-up: send link, verify page, resend button
     (#190, linked PR #276)
   - Tests: reset and verify flows, expired and reused token (#191, linked PR #276)
8. **Public search: group agencies and feature announcements** (#192,
   FR-09) — Done, 2/2
   - Group agencies in the sidebar filter, main office with its sub-units
     (#193)
   - Put featured announcements first on the public page for demos (#194)
9. **Open the original document from search results** (#195, FR-11) — Done, 1/1
   - Open the best document for each TOR, prefer the TOR file, skip
     zip/html (#196)

## Outcome

6 of 9 epics fully Done; AI classification (#137) and the rest of field
extraction (#139) carried into later iterations as "In progress" items.
Password recovery/email verification (#187) and the retry/alerting work on
failed syncs (#158) both show their linked PRs (#276, #274/#279) actually
merging in late October — those items were planned here but completed in a
later sprint, beyond the iterations captured in this backlog snapshot
(see [iteration 8](./iteration-8.md)).
