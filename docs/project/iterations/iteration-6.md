# Iteration 6 — Owner Dashboard, Error Reporting, Corrections, Auditor Flagging

**Dates:** Oct 01 – Oct 07, 2026
**Estimate:** 30 points · 4 top-level items
**Source:** GitHub Projects — TORFinder board, Iteration view

## Planned work

1. **Project Owner Dashboard** (#151, FR-20) — Todo, 1/4 (25%)
   - Owner's own TORs with match count and feedback counts (#152, Done,
     linked PR #285)
   - Link a TOR to an owner account; Admin assigns it in the TOR edit page
     (#220)
   - Rebuild `/owner` for the owner role only, remove hide/restore (#221)
   - Tests (#222)
2. **Users report an error on a TOR** (#162, FR-21) — Todo, 0/4
   - Admin review list: open TOR, mark resolved, audit entry (#163)
   - Reports collection (TOR, reason, message, reporter, status) and POST
     endpoint (#223)
   - "Report a problem" form on the TOR page (#224)
   - Test (#234)
3. **Admin corrects a wrong TOR** (#164, FR-22) — Done, 2/4 (50%)
   - Classification override; save and show "last updated by/at" (#165,
     linked PR #286)
   - Lock corrected fields so re-imports do not overwrite them (#226,
     linked PR #286)
   - "Fix this TOR" link from error reports, with audit entry (#227)
   - Test (#228)
4. **Flag unusual price or low competition for the Auditor Office** (#172,
   FR-24) — Done, 4/4
   - `/auditor` page: flagged TORs with reason, filters, link to TOR (#173,
     linked PR #281)
   - Low-competition rule on procurement method, agree the method list
     first (#229, linked PR #281)
   - Auditor-only endpoint and guard (#230, linked PR #281)
   - Test (#231, linked PR #281)

## Outcome

The Auditor flagging epic (#172, FR-24) is the only one fully Done this
iteration. Owner dashboard (#151) and TOR corrections (#164) progressed
partway — their core backend pieces landed (#152, #165, #226) while
supporting UI/tests were still open; error reporting (#162, FR-21) hadn't
started as of this snapshot.
