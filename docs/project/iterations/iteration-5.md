# Iteration 5 — Match Scoring, Roles, Feedback Moderation, Status Timeline

**Dates:** Sep 24 – Sep 30, 2026
**Estimate:** 30 points · 10 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

## Planned work

1. **Match score** (#145, FR-13) — Done, 1/1
   - Show match score on Matched TORs dashboard (#146)
2. **Notify companies when a new TOR matches** (#147, FR-14) — Done, 5/5
   - After each import or classification, score new TORs and create one
     notification (#148, linked PR #277)
   - Per-company threshold, default 70, and on/off switch in Profile (#197,
     linked PR #277)
   - Notification page shows score and links to the TOR (#198, linked PR #277)
   - Tests (#199, linked PR #280)
   - Notify at the plan or draft stage, not only when the invitation opens
     (#264, linked PR #277)
3. **Research MOL and DGA sources** (#153, FR-04) — Todo, 0/2
   - Read both sites: structure, terms, fields (#154)
   - Put MOL and DGA API/scraper in db (#205)
4. **Admin can edit users and change roles** (#155, FR-03) — Done, 4/4
   - Users page: change role, edit name (#160)
   - Add owner and auditor roles to user model, session and guards (#200,
     linked PR #247)
   - Audit entry per change; block removing the last admin (#201, linked PR #282)
   - Tests (#202, linked PR #283)
5. **Feedback moderation** (#166, FR-23) — Done, 1/1
   - Moderation queue and hide/remove feedback (#167)
6. **Log every admin action in the audit trail** (#168, FR-25) — In progress, 0/3
   - Add the missing hooks (#169)
   - Audit page: pagination and filter by action, actor, date (#203)
   - Tests (#204)
7. **Save and reuse searches** (#206, FR-16) — Todo, 1/3
   - SavedSearches backend: create, list, delete per user (#207, Done,
     linked PR #284)
   - "Save this search" on Search page; apply and delete on Saved page (#208)
   - Tests (#209)
8. **Show the TOR status timeline: plan → draft → price → invite → winner**
   (#210, FR-17) — Done, 3/3
   - Extend the stage model to 5 stages and map announcement types (#211,
     linked PR #248)
   - Timeline on the TOR page; stage filter updated (#212, linked PR #249)
   - Tests (#213, linked PR #249)
9. **Flag TORs open for public feedback** (#214, FR-18) — In progress, 0/2
   - Show "open for feedback until ..." and stop flagging after the
     deadline (#215)
   - Test (#216)
10. **Add a deadline filter to search** (#217, FR-10) — Done, 2/2
    - Filter: closing within 7 days / 30 days / any (#218, linked PR #266)
    - Test (#219, linked PR #266)

## Outcome

6 of 10 epics fully Done. Owner/auditor roles (FR-03), the five-stage
status timeline (FR-17), and the deadline filter (FR-10) all landed here.
Saved searches (FR-16), the audit trail (FR-25), and the public-feedback
flag (FR-18) carried forward with some sub-issues still open; MOL/DGA
research (#153) hadn't started as of this snapshot.
