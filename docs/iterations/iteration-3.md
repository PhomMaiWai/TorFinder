# Iteration 3 — Saved TORs, Notifications, More Data Sources, Real Admin Dashboard

**Dates:** Sep 10 – Sep 16, 2026
**Estimate:** 30 points · 6 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

> This is the iteration the team itself marked with a dedicated QA branch —
> `test/iteration-3` (PR #124) — which is also the linked PR for the
> "Iteration 3 Testing" epic below.

## Planned work

1. **Saved TORs, backend-wired** (#78, FR-15) — Done, 2/2
   - Backend: SavedTorsModule + endpoints (#88, linked PR #81)
   - Frontend: migrate `use-saved-tors.ts` off localStorage (#89, linked PR #81)
2. **Notifications, backend-wired** (#83, FR-14) — Done, 2/2
   - Backend: NotificationsModule + endpoints (#90, linked PR #87)
   - Frontend: wire notifications page + badge off the mock (#91, linked PR #87)
3. **New Data Sources — data.go.th + MEA Procurement** (#92, FR-04) — Done, 4/4
   - Research API access & auth requirements for data.go.th and
     procurement.mea.or.th (#93)
   - Build data.go.th API client + software-relevance filter (#94, linked PR #117)
   - Build procurement.mea.or.th client + filter, scraper fallback if no
     public API (#95, linked PR #117)
   - Normalize & dedupe records from both sources against existing TOR data
     (#96, FR-05, linked PR #117)
4. **UI Polish** (#97, not a functional requirement) — Done, 3/3
   - Audit spacing/typography consistency across pages (#98, linked PR #122)
   - Fix responsive/mobile layout issues (#99, linked PR #123)
   - Polish empty, loading, and error states (#100, linked PR #121)
5. **Wire Admin Dashboard to Real Data** (#101, FR-03) — Done, 5/5
   - Backend: real pipeline metrics endpoint, sync counts and success/fail
     history (#102, linked PR #118)
   - Backend: real audit log endpoint (#103, linked PR #118)
   - Backend: real user list endpoint (#104, linked PR #118)
   - Frontend: wire `admin/page.tsx` off mock data (#105, linked PR #119/#120)
   - Frontend: wire `admin/audit` and `admin/users` off mock data (#106,
     linked PR #119/#120)
6. **Iteration 3 Testing** (#107, not a functional requirement) — Done, 7/7
   - Test data.go.th client (#108, linked PR #124)
   - Test MEA client/scraper (#109, linked PR #124)
   - Test normalize & dedupe across data.go.th + MEA + e-GP (#110, linked PR #124)
   - Test admin pipeline metrics + audit log + user list endpoints (#111,
     linked PR #124)
   - Test admin dashboard renders real data, incl. empty states (#112,
     linked PR #124)
   - Backfill: test Saved TORs endpoints (#113, linked PR #115)
   - Backfill: test Notifications endpoints (#114, linked PR #116)

## Outcome

All 6 epics shipped (26/26 sub-issues Done) — the heaviest iteration of the
project. Saved TORs and Notifications became real self-service modules
(FR-14/FR-15), two more data sources joined e-GP (FR-04/FR-05), and the
admin dashboard moved entirely off mock data (FR-03).
