# Iteration 9: Feedback quick wins, accounts and admin governance

**Dates:** Oct 22 – Oct 28, 2026  
**Merged pull requests:** 38 (Dependabot not counted)  
**Source:** merged pull requests on GitHub. Iterations 1 to 7 were written from a GitHub Projects board export; from iteration 8 the export was not available, so this page lists what was merged in the week instead of what was planned.

## Summary

The biggest delivery week of the project. The first client quick wins (sorting, dashboard after login), password reset and email verification, match alerts from the plan stage, admin corrections, saved searches, problem reports, the glass UI redesign, and the first security level 1 work.

## Delivered

| PR | Author | What | Closes |
| --- | --- | --- | --- |
| #266 | @fcxbsyo | Feature/deadline filter | #217, #218, #219 |
| #267 | @fcxbsyo | fix(ui): fix UI | — |
| #268 | @OverCatX | feat: AI proposal draft, bid insight, and external notification channels | — |
| #269 | @SKlv1ain | feat(search): sort results by time to prepare (#251) | #251 |
| #270 | @OverCatX | feat: public Google sign-in, account saved lists, standards profile, in-app document viewer | — |
| #271 | @OverCatX | chore(docker): run locally against the compose Mongo | — |
| #272 | @SKlv1ain | feat(ui): glass redesign of landing page, navbar and dashboard | — |
| #273 | @OverCatX | feat(ai): show a checked confidence, with a please-verify note when low | #180 |
| #274 | @OverCatX | feat(sync): alert every admin when a scheduled run fails or comes back partial | #161 |
| #275 | @OverCatX | chore(docker): start the database with a snapshot of real TOR records | — |
| #276 | @OverCatX | feat(auth): password reset and email verification | #187, #188, #189, #190, #191 |
| #277 | @OverCatX | feat(matching): match alerts per company, from the plan/draft stage, with score and link | #147, #148, #197, #198, #264 |
| #278 | @fcxbsyo | Feature/security level 1 | — |
| #279 | @fcxbsyo | Feature/alert admin | #183, #185 |
| #280 | @fcxbsyo | test(matching): cover threshold boundaries, skip conditions, and scor… | #199 |
| #281 | @fcxbsyo | Feature/flag unusual price | #172, #173, #229, #230, #231 |
| #282 | @OverCatX | feat(admin): edit users' names and roles; audit each change and keep the last admin | #155, #160, #201 |
| #283 | @fcxbsyo | test(accounts): cover user-edit notifications, audit feed, and the tw… | #202 |
| #284 | @OverCatX | feat(saved-searches): save, list and delete searches per account | #207 |
| #285 | @OverCatX | feat(owner): the owner's own TORs with match and feedback counts | #152 |
| #286 | @OverCatX | feat(tor): admin corrections — classification override, last edited by/at, locked against re-imports | #164, #165, #226 |
| #287 | @OverCatX | fix(search): open TORs first, closing soonest by default | — |
| #288 | @fcxbsyo | docs: add LICENSE, SRS, project plan, and iteration backlog docs | — |
| #289 | @SKlv1ain | feat(dashboard): public market overview as the signed-in home; company matches move to /matches | #252 |
| #290 | @SKlv1ain | feat(audit): record the admin actions that wrote no audit entry | #169 |
| #291 | @SKlv1ain | feat(audit): page the audit log and filter it by action, actor and day | #203 |
| #292 | @SKlv1ain | feat(search): save a search by name, and apply or delete it from /saved | #208 |
| #293 | @SKlv1ain | feat(tor): link a TOR to its owner account from the admin edit page | #220 |
| #294 | @SKlv1ain | fix(frontend): serve fonts from the repo instead of next/font/google | — |
| #295 | @SKlv1ain | feat(owner): /owner is the owner's own projects page, without hide/restore | #221 |
| #296 | @SKlv1ain | feat(tor): keep the end of public comment as its own feedbackDeadline | #140 |
| #297 | @fcxbsyo | Tests | #204, #209, #222 |
| #298 | @SKlv1ain | feat(feedback): say until when a draft takes comments, and stop after that day | #215 |
| #299 | @SKlv1ain | feat(reports): let anyone report a problem with a TOR, for admins to review | #223 |
| #300 | @SKlv1ain | feat(reports): "Report a problem" form on the TOR page | #224 |
| #301 | @SKlv1ain | fix(i18n): ship the proposal-draft form's strings to the browser | — |
| #302 | @SKlv1ain | feat(reports): admin review list — open the TOR, resolve or reopen, with audit | #163 |
| #303 | @fcxbsyo | Tests | #216, #234 |

## Carried over or dropped

- Font size (#253), profile nudges (#254), find similar (#255) and market insights (#256) moved to iteration 11.
- Owner and auditor features built here (#285, #295, #281) were removed on 22 Nov (PRs #414, #416).

## Process numbers

| Pull requests | Reviewed by a teammate | Linked to an issue |
| --- | --- | --- |
| 38 | 0 | 27 |
