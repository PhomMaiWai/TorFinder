# Requirements

A working reference for what TOR Finder is supposed to do, pulled from
[the team's SRS](./srs.md) (v1.0, Aug 21 2026) so it can be linked from
code and checked against without opening the full document every time. If
this file and the SRS ever disagree, treat the SRS as the source of truth and
fix this file to match it.

## Why the project exists

Bangkok Metropolitan Administration (BMA) agencies publish Terms of
Reference (TOR) — the documents that define a procurement project's scope,
budget, qualifications, and deadlines — but there's no single place to find
them. They're spread across e-GP, individual agency sites, and physical
boards, and each one is a dense PDF a vendor has to read by hand just to
check whether they're even eligible to bid.

TOR Finder pulls TOR announcements in from e-GP, runs them through Vertex AI
(Document AI for parsing, Gemini for classification) to work out which ones
are actually software-related and to pull out structured fields, then builds
search, matching, status tracking, and oversight tools on top of that. It is
explicitly **not** a replacement for e-GP or any official procurement
system — it reads from public data and never becomes the system of record.

## What's in and what isn't

SRS Section 2 scopes the product to:

- TOR search, filtering, and full-detail pages that link back to the source document
- Company-profile matching and match scoring
- Match notifications, bookmarks, and saved searches
- Status tracking across the TOR lifecycle (plan → draft → price → invite → winner) and feedback-window tracking
- Public feedback on draft TORs, plus error reporting and admin correction
- Price-anomaly / low-competition flagging for the Auditor Office
- Pipeline monitoring, moderation, and an audit trail for admins

Hard boundary: automated collection only covers BMA-affiliated agencies,
and only announcements published **2022 or later** (FR-26). Anything older
or from outside BMA is simply never ingested.

Separately, [project-plan.md](../project/project-plan.md) records a few as-built
boundaries the SRS doesn't mention: there's no file-upload feature anywhere
in the app, the Google sign-in integration is OAuth-client-only (this app
never acts as an identity provider for anyone else), and scraping is a
fallback used only where no official API exists.

## Who it's for

SRS Section 3 names five stakeholder groups. The app's own role names
(`backend/src/common/roles.ts`) don't match the SRS's labels one-for-one, so
here's both:

- **BMA / Project Owner** — wants a dashboard of TOR status, match count, and collected feedback for their own announcements. Role: `owner`.
- **Software Company (Bidder)** — wants a filtered, matched, notified list of TORs with qualifications already pulled out. Role: `org`.
- **Public / People** — wants an easy way to check TOR status, the feedback window, and price info, without an account. Browses unauthenticated, or as `viewer` once signed in with Google.
- **สตง. (Auditor Office)** — wants unusual pricing or low-competition deals flagged automatically, out of a volume too large to review by hand. Role: `auditor`.
- **Admin** — wants a pipeline health view, correction tools, and moderation controls. Role: `admin`.

## Where each screen lives

The SRS describes these screens by access level without naming routes. I
checked `frontend/src/app/` directly rather than guess, so this table is
accurate as of this writing — it'll drift as the app changes, so re-verify
before relying on it for anything load-bearing:

| Access level | Screens | Routes |
| --- | --- | --- |
| Public | Home/landing, search | `/`, `/public`, `/search` |
| Public | TOR detail, public feedback, error report | `/tor/[id]` |
| Public | Login, registration | `/login/{admin,organization,public}`, `/signup`, `/signup/organization` |
| Org (logged in) | Company profile, matched TORs | `/profile`, `/matches` |
| Any authenticated account | Notifications, bookmarks/saved searches | `/notifications`, `/saved` |
| Owner | Project owner dashboard | `/owner` |
| Admin | Admin panel | `/admin/{accounts,audit,companies,moderation,notifications,reports,tor,users}` |
| Auditor | Flagged-TOR view | `/auditor` |

Two external systems round out the picture: **e-GP / BMA agency sites**
(announcements in, structured records out) and the **Vertex AI** service
(classification, field extraction, match scoring). Both talk over
HTTPS/JSON, and every ingested record keeps a link back to where it came
from.

## Functional requirements

Numbered exactly as SRS Section 5, grouped by feature area. Priority follows
MoSCoW — Must is required for the MVP, Should can slip past it if time runs
short, Could is a stretch goal.

**Authentication & accounts (Must)**
FR-01 register/log in by email+password or OAuth · FR-02 profile, bookmarks,
and notifications are gated behind sign-in · FR-03 Admin manages accounts and
permissions.

**Automated data collection (Must)**
FR-04 pull TOR announcements from e-GP, filtered to BMA agencies · FR-05
deduplicate the same TOR across sources · FR-06 log and alert Admin on
scraper/sync failure · FR-26 never ingest anything outside BMA, 2022+.

**AI classification & extraction (Must)**
FR-07 classify each listing software / not-software · FR-08 extract scope,
qualifications, price, and feedback deadline from the PDF.

**Search & discovery (Must)**
FR-09 search by keyword, agency, category · FR-10 filter by budget,
deadline, tech stack · FR-11 full detail plus a link to the original
document.

**Matching, personalization, notifications (Must — profile matching may use
AI/Vector Search; notifications, bookmarks, and saved searches are
rule-based)**
FR-12 company builds a matching profile · FR-13 score each TOR against it ·
FR-14 notify above a set score · FR-15 bookmark a TOR · FR-16 save and reuse
a search query.

**Status & public feedback**
FR-17 (Must) show the current lifecycle stage · FR-18 (Must) flag TORs open
for feedback · FR-19 (Should) let the public submit feedback on a draft ·
FR-20 (Must) show the owner their match count and collected feedback.

**Quality, oversight, admin**
FR-21 (Must) report an error on a listing · FR-22 (Must) Admin corrects a
wrong classification/record · FR-23 (Must) Admin hides spam/abusive feedback
· FR-24 (**Could**) flag unusual pricing or low competition for the Auditor
Office · FR-25 (Must) audit trail of admin-relevant actions.

## Non-functional requirements

SRS Section 7 doesn't number these, so neither does this file — they're kept
under the same four headings the SRS uses.

Under **performance**: the home page and search results should load inside
2 seconds, filtering should update within 1 second, and a newly ingested PDF
should finish AI processing within 5 minutes. The system is sized for at
least 100 concurrent users, consistent with a single-agency MVP ingesting
roughly 500 new TORs a month, and none of the background collection/AI work
should be able to slow down the core app's own response times.

Under **safety**: every user input gets validated against injection and bad
data, the search/feedback/collection endpoints are rate-limited, every
scraping and AI job keeps its own error log and run history, duplicate-TOR
checks protect the repository, and anything the AI pipeline is unsure about
goes to an Admin for review instead of publishing unchecked.

Under **security**: passwords are hashed with a standard algorithm, all
client-server traffic runs over TLS, role-based access control keeps Admin
and Project Owner capabilities away from standard accounts, sessions expire
after inactivity, a user's own data (profile, searches, bookmarks, feedback
history) is visible only to them or to an Admin moderating it, and account
data handling follows Thailand's PDPA.

Under **software quality**: 99% uptime outside scheduled maintenance; fully
responsive across desktop/tablet/mobile with search-to-detail reachable in 3
clicks; the database and match index scale horizontally as more agencies or
fiscal years get added; the codebase stays modular enough that a new BMA
data source doesn't require touching the core app; and an external source
going down gets logged and retried rather than taking anything else with it.

## Rules that don't bend

Straight from SRS Section 8 — these aren't engineering preferences, they're
constraints the product has to hold regardless of implementation:

- Only publicly available, software-related TOR data from BMA-affiliated agencies gets collected
- Nothing before 2022 is ingested (FR-26)
- A TOR has to pass AI classification as "software" before it's searchable or matchable
- Match notifications only fire once a score clears the company's own threshold
- Public feedback and error reports sit behind Admin moderation before anyone else sees them
- Every TOR record keeps a traceable link to its original e-GP/agency source

## What was still unresolved at SRS time

Section 11 lists these as open at the time the SRS was written (Aug 2026).
Some have since been settled in the as-built app — noted where I could
confirm it, but check current code/iteration history rather than trusting
this list to still be accurate:

- How conflicts between e-GP and BMA's own procurement sources get reconciled was never finalized
- No fixed confidence threshold was set for AI classification/extraction
- Which OAuth provider(s) to support wasn't decided (as-built: Google)
- Whether "unusual pricing" / "low-competition" (FR-24) gets defined statistically or by fixed rule-of-thumb thresholds is still open
- Whether MVP needs both email and in-app notifications, or in-app alone, was unconfirmed (as-built: in-app, email, LINE, and Slack — see `backend/src/notifications/`)
- How the repository gets backfilled with pre-2026 TORs versus relying on the ongoing sync was never decided

## Terms worth knowing

**BMA** is Bangkok Metropolitan Administration, the government body this
project scopes its data to. **TOR** (Terms of Reference) is the document a
TOR describes. **e-GP** is the Electronic Government Procurement system
agencies publish through. **สตง. / SAO** (State Audit Office) is the
oversight body behind the `auditor` role. A **match score** is the numeric
fit between a company profile and a TOR. **Sole-source procurement** —
awarded without competitive bidding — is what FR-24's low-competition flag
exists to catch. **RBAC** (role-based access control) is what keeps
Admin/Owner/Org/Auditor/Public capabilities separate.

Related reading: [specs/srs.md](./srs.md) for the full document this
one condenses, [project-plan.md](../project/project-plan.md) for the as-built role
names and tech stack, and the root [README.md](../../README.md) for environment
variables and local setup — none of which the SRS itself covers.
