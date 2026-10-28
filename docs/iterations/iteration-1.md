# Iteration 1 — Auth, Backend Setup, TOR CRUD, Theming, i18n

**Dates:** Aug 27 – Sep 02, 2026
**Estimate:** 30 points · 6 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

## Planned work

1. **Authentication** (#1, FR-01) — Done, 5/5
   - Build login page with saved session (#2, linked PR #34)
   - Build sign-up page, email/password (#7)
   - Set new accounts to "Pending Approval" by default (#8, linked PR #55)
   - Show "Pending Approval" message on login attempt (#9)
   - Protect API routes for logged-in + approved users only (#10)
2. **Backend Setup** (#3, not a functional requirement) — Done, 3/3
   - Set up MongoDB Atlas connection (#4, linked PR #28)
   - Set up base API route structure (#5, linked PR #30)
   - Configure environment variables (#6)
3. **TOR CRUD** (#11, not a functional requirement) — Done, 4/4
   - Create TOR entry, admin adds manually (#12, linked PR #55)
   - Read TOR list & detail (#13, linked PR #55)
   - Update TOR entry (#14, linked PR #55)
   - Delete TOR entry, soft delete (#15)
4. **CI/CD for first Iteration** (#16, not a functional requirement) — Done, 2/2
   - Test sign-up/login flow (#17, linked PR #66)
   - Test TOR CRUD endpoints (#18, linked PR #68)
5. **UI Theme Toggle (Light/Dark Mode)** (#19, not a functional requirement) — Done, 3/3
   - Add theme toggle button (#20, linked PR #32)
   - Build dark mode color scheme (#21)
   - Persist user's theme choice (#22)
6. **Language Switch (TH/EN)** (#23, not a functional requirement) — Done, 3/3
   - Set up i18n library, next-intl (#24, linked PR #33)
   - Extract Thai text + add English translations (#25, linked PR #33)
   - Add language switch toggle to navbar (#27, linked PR #33)

## Outcome

Every item in Iteration 1 shipped (6/6 epics, all sub-issues Done). This
covers FR-01 (auth) end to end for email/password, plus the groundwork
(Mongo connection, base API, CI) and two non-functional pieces (theming,
i18n) that every later iteration builds on.
