# Iteration 13: Security submission and scope clean-up

**Dates:** Nov 19 – Nov 25, 2026  
**Merged pull requests:** 40 (Dependabot not counted)  
**Source:** merged pull requests on GitHub. Iterations 1 to 7 were written from a GitHub Projects board export; from iteration 8 the export was not available, so this page lists what was merged in the week instead of what was planned.

## Summary

Security course submission (22 Nov) and presentation (23 Nov): ASVS Level 2 complete, staff passkeys and step-up, session list and sign-out of other devices, admin-role approval by a second admin, SECURITY.md, the README rewrite, and removal of the unused Auditor and Project Owner roles.

## Delivered

| PR | Author | What | Closes |
| --- | --- | --- | --- |
| #369 | @fcxbsyo | fix(layout): pass the CSP nonce to the theme script | — |
| #370 | @fcxbsyo | Fix/asvs l3 quick wins | — |
| #371 | @fcxbsyo | Feat/staff passkeys | — |
| #372 | @fcxbsyo | fix(passkeys): require step-up to assign an announcement's owner | — |
| #373 | @SKlv1ain | feat(auth): lockout email and admin reset link (ASVS L3 6.3.5, 6.4.6) | — |
| #375 | @SKlv1ain | feat(ops): documented limits, data retention and secret rotation (ASVS L3 13.1.x, 14.2.7) | — |
| #376 | @fcxbsyo | docs(security): evidence screenshots and index for graded criteria | #349 |
| #377 | @SKlv1ain | fix(docker): copy next.config.ts into the frontend image (X-Powered-By leak) | — |
| #378 | @SKlv1ain | feat(ops): documented limits, data retention and secret rotation — land #375 on main | — |
| #379 | @SKlv1ain | feat(security): close nine ASVS Level 2 gaps (SSRF allowlist, Google nonce, scrypt, Mongo least-privilege, input logging) | #344, #345 |
| #380 | @fcxbsyo | Feat/asvs l3 admin approval | — |
| #381 | @SKlv1ain | docs(security): project document shows Level 3 at 44/71 after #380 | — |
| #382 | @fcxbsyo | Feat/asvs l3 admin approval | — |
| #383 | @SKlv1ain | fix(auth): log Google sign-ups as auth.signup (ASVS 16.3.1) | — |
| #384 | @SKlv1ain | feat(security): immediate revocation and capped backend URLs (ASVS L3 8.3.2, 4.2.5) | — |
| #385 | @SKlv1ain | feat(security): ASVS L3 batch 2 — ReDoS audit, crypto inventory, browser warning, parser-consistent redirect, full authz logging (L3 55/71) | — |
| #387 | @SKlv1ain | docs(security): evidence screenshots for code scanning (C14) and Google sign-in (C5) | — |
| #388 | @SKlv1ain | fix(sidebar): show the signed-in company's name instead of "Arun Digital" | — |
| #389 | @fcxbsyo | Feat/asvs l3 data minimization | — |
| #390 | @fcxbsyo | Feat/asvs l3 files secrets adaptive | — |
| #401 | @fcxbsyo | Feat/asvs l3 mtls edge | — |
| #402 | @fcxbsyo | Test/csp header tests | — |
| #403 | @SKlv1ain | feat(security): ASVS L2 group A — session list, admin sign-out, __Host- cookies, generated DB root password, key policy, edge review (L2 94%) | — |
| #404 | @fcxbsyo | Fix/backend logic | — |
| #405 | @SKlv1ain | feat(security): close the last seven ASVS Level 2 items (L2 125/125): transactions, company passkeys, ClamAV, egress allowlist, vault, separate log store | — |
| #406 | @fcxbsyo | docs(security): map OWASP Top 10 (2025) to controls, ASVS IDs and evi… | #348 |
| #407 | @SKlv1ain | docs(security): evidence 19 (ZAP summary) and 20 (cross-company file refused) | — |
| #408 | @SKlv1ain | docs(security): current Level 3 numbers; evidence 01-03 retaken from main | — |
| #409 | @SKlv1ain | docs(security): SECURITY.md; dependency graph and private vulnerability reporting on | — |
| #410 | @fcxbsyo | Security/asvs 4 gap fixes | — |
| #411 | @fcxbsyo | Fix/demo accounts and security docs | — |
| #412 | @fcxbsyo | Fix/asvs secrets vault wording | — |
| #413 | @OverCatX | docs(readme): rewrite the README in the usual shape | — |
| #414 | @fcxbsyo | Refactor/remove auditor role | — |
| #415 | @fcxbsyo | docs(readme): install and run on macOS and Windows; where each .env v… | — |
| #416 | @fcxbsyo | refactor: remove the project owner role | — |
| #417 | @SKlv1ain | docs(security): ASVS 12.1.3 and 12.3.4 pass; Level 2 127/127; 37 threats | — |
| #418 | @fcxbsyo | fix(security): stop gating session verification on the Authorization … | — |
| #421 | @fcxbsyo | fix(ai): extract TORs whose documents are a MEA zip or only an e-GP project number | — |
| #423 | @OverCatX | fix(ai): extract award announcements too | — |

## Carried over or dropped

- Production deployment (#236 to #240), UAT (#232) and the FR checklist pass (#171) carry over to the release (#397).
- AI coverage (#399) and latency (#400) opened as follow-ups from the KPI review.

## Process numbers

| Pull requests | Reviewed by a teammate | Linked to an issue |
| --- | --- | --- |
| 40 | 40 | 3 |
