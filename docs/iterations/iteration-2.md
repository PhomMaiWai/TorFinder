# Iteration 2 — Google OAuth, e-GP Integration, AI Matching, Company Profiles

**Dates:** Sep 03 – Sep 09, 2026
**Estimate:** 30 points · 5 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

## Planned work

1. **Google OAuth** (#36, FR-01) — Done, 3/3
   - Add Google OAuth sign-in (#37, linked PR #71)
   - Link Google account to existing email/password account (#38)
   - Set new Google sign-ups to "Pending Approval" by default (#39)
2. **Data Source Integration** (#40, FR-04) — Done, 2/2
   - Build API client (#41, linked PR #57)
   - Normalize & dedupe TOR records from all sources (#42, linked PR #72)
3. **AI Algorithms Implementation** (#43, FR-07) — Done, 3/3
   - Set up Vertex AI extraction pipeline (#44, linked PR #61)
   - Extract scope/budget/qualifications from TOR PDFs (#45, linked PR #61)
   - Build TOR-company match scoring logic (#46, linked PR #61)
4. **Company Profiles** (#47, FR-12) — Done, 2/2
   - Company profile CRUD UI, create/edit forms (#48, linked PR #76)
   - Company profile approval flow, admin dashboard (#49, linked PR #77)
5. **Iteration 2 Testing** (#50, not a functional requirement) — Done, 4/4
   - Test OAuth flow (#51, linked PR #73)
   - Test TOR data integration (#52, linked PR #74)
   - Test company profile CRUD + approval (#53, linked PR #82)
   - Test match scoring logic (#54, linked PR #75)

## Outcome

All 5 epics shipped. This is where the AI core of the product (extraction +
match scoring, FR-07/FR-08/FR-13) and the company-profile side of matching
(FR-12) landed, alongside Google sign-in as a second auth path for FR-01.
