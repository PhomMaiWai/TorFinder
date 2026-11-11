# Roles and features

What each kind of user can do in TorFinder, and which features are
finished. Checked against the code on `main` in November 2026: pages in
`frontend/src/app/`, page access in `frontend/src/proxy.ts`, and route
guards in `backend/src/**/*.controller.ts`. For the route behind each
feature see [api.md](../design/api.md); for the diagram version see
[use-case.md](../design/use-case.md).

## Roles

| Role | Code | Who | How they get an account | Home page after sign-in |
| --- | --- | --- | --- | --- |
| Public visitor | — | Anyone reading procurement news | No account needed | — |
| Viewer | `viewer` | A member of the public who wants to keep a list | Google sign-in at `/login/public` | `/dashboard` |
| Organization | `org` | A software company looking for TORs to bid on | Sign up at `/signup/organization`, verify email, wait for admin approval | `/dashboard` |
| Project Owner | `owner` | The agency (BMA department) that publishes a TOR | An admin changes an existing account's role | `/owner` |
| Auditor | `auditor` | สตง. (State Audit Office) | An admin changes an existing account's role | `/auditor` |
| Administrator | `admin` | The TorFinder team | Seeded, or an admin changes an existing account's role | `/admin` |

Each backend guard admits exactly one role, so an admin cannot use the
owner or auditor screens, and the other way round. A company account's role
cannot be changed.

Demo accounts for every role are in the [root README](../../README.md#demo-accounts).

## What each role can do

### Public visitor (everyone)

- Find similar TORs: paste a past project (or pick a TOR with its "find
  similar" button) and get TORs from other agencies ranked by how alike the
  work is, with the words they share (`/search`, `/public`, issue #255).
- Search TORs by keyword and filter by stage, agency, year, budget range and
  deadline; sort the results (`/search`, `/public`). The filters sit under
  "More filters", folded away by default.
- Open a TOR (`/tor/[id]`): the details, a timeline of its stages, the AI
  summary of the TOR document, and the original documents, viewable in the
  page or downloadable.
- See whether the budget is unusual compared with similar TORs, and a
  suggested bid range from past awards.
- See market insights (`/insights`): which companies win most, how far
  under the reference price they won, the top winners at each agency and how
  contested each agency is, filterable by year.
- Comment on a draft TOR while the hearing period is open.
- Report a problem with a TOR (wrong info, not software, broken link,
  duplicate, other).
- Sign up as a company; sign in with a password or Google; reset a
  forgotten password.
- Switch between Thai and English, and between light and dark themes.

### Viewer

Everything a public visitor can do, plus:

- Bookmark TORs and keep them across devices (bookmarks made before signing
  in are moved into the account).
- Save a search by name and run it again from `/saved`.

### Organization

Everything a viewer can do, plus:

- Fill in a company profile: work types, certifications, registered
  capital, largest past contract, preferred budget range (`/profile`).
- See TORs ranked by how well they fit the company, with the reasons, the
  gaps and whether the company meets each stated requirement (`/matches`).
- Find TORs similar to the company profile's past experience with one
  button on the search page.
- Get an alert when a new TOR scores above the company's own threshold
  (40-95), in the app and by email, LINE or Slack; send a test message to
  check the channels (`/notifications`).
- Ask the AI to draft a proposal for a TOR from one of the company's old
  proposals (5 per minute).

### Project Owner

- See every TOR linked to their account, with how many companies match it,
  the top score, and how many comments are approved, pending or rejected
  (`/owner`).

### Auditor

- Review TORs flagged for a budget that is unusually high or low, or for a
  low-competition procurement method (`/auditor`).

### Administrator

- Approve or reject company sign-ups (`/admin/accounts`).
- See every user, rename them, change a non-company account's role, suspend
  and reactivate accounts (`/admin/users`). The last admin cannot be
  demoted.
- Add, edit, hide and restore TORs; mark a TOR as not software; link a TOR
  to a project owner (`/admin/tor`). Edited fields are locked so the next
  import doesn't overwrite them.
- Moderate public comments (`/admin/moderation`).
- Work through problem reports and fix the TOR from the report
  (`/admin/reports`).
- Start an import from Bangkok e-GP, MEA or data.go.th, capture projects
  from the national e-GP by project number, and run AI extraction by hand
  (API only for now, `POST /api/ai/extract`).
- Watch import health (last run, imported today, history, near misses),
  see which companies fit a TOR, and read the audit log (`/admin`,
  `/admin/audit`).

### Automatic (no user)

- Import TORs from Bangkok e-GP, MEA, data.go.th and the national e-GP on a
  timer, keep only software work in Bangkok from 2022 on, and merge
  duplicates across sources.
- Read each TOR's PDF with Vertex AI (Gemini) when it is configured.
- Recompute budget flags and send match alerts after every import.
- Tell admins when an import fails repeatedly.

## Feature status against the SRS

FR numbers are from [summary.md](../requirements/summary.md).

| FR | Requirement | Status | Notes |
| --- | --- | --- | --- |
| FR-01 | Register and sign in by email/password or OAuth | ✅ Done | Google sign-in, email verification, password reset |
| FR-02 | Profile, bookmarks and notifications need sign-in | ✅ Done | Enforced in `proxy.ts` and by backend guards |
| FR-03 | Admin manages accounts and permissions | ✅ Done | Approve, reject, role, suspend |
| FR-04 | Pull TORs from e-GP for BMA | ✅ Done | Also MEA, data.go.th, national e-GP |
| FR-05 | De-duplicate across sources | ✅ Done | Trust order manual > e-GP > MEA > data.go.th |
| FR-06 | Log and alert admin on sync failure | ✅ Done | Sync history kept for Bangkok e-GP only |
| FR-07 | Classify software / not software | ✅ Done | Keyword filter at import, admin override |
| FR-08 | Extract scope, qualifications, price, deadline from the PDF | ✅ Done | Needs `VERTEX_PROJECT_ID` |
| FR-09 | Search by keyword, agency, category | ✅ Done | |
| FR-10 | Filter by budget, deadline, tech stack | 🟡 Partial | Budget and deadline yes; no tech-stack filter |
| FR-11 | Full detail and link to the original document | ✅ Done | Documents open in the page |
| FR-12 | Company matching profile | ✅ Done | |
| FR-13 | Score each TOR against the profile | ✅ Done | Plus "find similar" from a pasted project or profile (#255): Vertex AI embeddings, keyword ranking without them |
| FR-14 | Notify above a set score | ✅ Done | In-app, email, LINE, Slack |
| FR-15 | Bookmark a TOR | ✅ Done | |
| FR-16 | Save and reuse a search | ✅ Done | Up to 50 per account |
| FR-17 | Show the lifecycle stage | ✅ Done | Five-stage timeline |
| FR-18 | Flag TORs open for feedback | ✅ Done | Shows until when comments are open |
| FR-19 | Public feedback on a draft | ✅ Done | Moderated before it is shown |
| FR-20 | Owner sees match count and feedback | ✅ Done | `/owner` |
| FR-21 | Report an error on a listing | ✅ Done | |
| FR-22 | Admin corrects a record or classification | ✅ Done | Corrected fields are locked |
| FR-23 | Admin hides spam or abusive feedback | ✅ Done | |
| FR-24 | Flag unusual pricing or low competition | ✅ Done | `/auditor` |
| FR-25 | Audit trail | ✅ Done | Admin actions and sync runs in one feed |
| FR-26 | Only BMA, only 2022 onward | ✅ Done | Bangkok locality rules; `TOR_LISTED_SINCE` |

### Extras beyond the SRS

- AI proposal draft for companies.
- Bid insight from past awards (typical discount, competition).
- Market insights page from past awards (#256): top winners, awarded vs
  reference price, winner spread per agency. Winners are named by e-GP and
  data.go.th only; MEA publishes the price without the winner.
- National e-GP documents shown file by file inside the page.
- Thai/English and light/dark theme.

### Not finished

- `/admin/companies` still runs on mock data.
- No tech-stack filter in search (FR-10).
- Production deployment is not set up; see
  [deployment-checklist.md](../operations/deployment-checklist.md).
- Two security issues are listed under
  [Known issues in api.md](../design/api.md#known-issues).
