# Software Requirements Specification for TOR Finder

Version 1.0
Prepared by Bhumipat Kusalatham, Nisara Ploysuttipol, Sai Khun Main
August 21, 2026

> This is the team's original SRS, written before implementation began. It
> describes the product as planned (role names like "Software Company" and
> "สตง./Auditor Office", and features like AI classification/matching). The
> as-built system uses slightly different terminology in places (e.g. the
> app calls the bidder role "Organization") — see
> [project-plan.md](../project-plan.md) and
> [docs/iterations/](../iterations/) for how delivery actually mapped onto
> this spec, tracked against the team's GitHub Projects backlog.

## Revision History

| Name | Date | Reason for changes | Version |
| --- | --- | --- | --- |
| Bhumipat, Nisara, Sai Khun | Aug 21, 2026 | Initial draft SRS | 1.0 |

## 1. Purpose & Problem

This SRS defines the software requirements for TOR Finder: a Software
Procurement Discovery and Matching Platform for Bangkok Metropolitan
Administration (BMA) software vendors.

Government agencies publish Terms of Reference (TOR) documents describing
project scope, budgets, qualifications, procurement methods, and
submission/feedback deadlines. This information is scattered across e-GP,
individual agency websites, and physical announcement boards, and is locked
inside dense PDF documents that must be read manually to check eligibility.
This document provides a common reference for the Developer Team, Project
Owner, Software Companies, the public, the Auditor Office (สตง.), and the
System Administrator throughout development, based on the project proposal,
stakeholder analysis, user stories, and functional requirements developed by
the team.

**Document conventions:** FR = Functional Requirement, US = User Story, F =
Feature. Priorities follow the MoSCoW scale: **Must** (required for MVP),
**Should** (important, can follow MVP if time is constrained), **Could**
(desirable if time/data allow; some Could features may depend on AI, e.g.
price-anomaly detection).

**Reading guide:** Readers wanting an overview should start at Section 4
(System Overview). Detailed requirements are in Section 5 (Functional
Requirements).

## 2. Scope

**What the system does:** TOR Finder automatically collects TOR
announcements from e-GP (filtered to BMA-affiliated agencies), uses AI
(Vertex AI: Document AI and Gemini) to classify which listings are
genuinely software-related and extract key structured fields, and provides:

- TOR search and filtering
- Detailed TOR information and access to original source documents
- Company profile-based matching and match scoring
- Match notifications, bookmarks, and saved searches
- TOR status tracking (plan → draft → price → invite → winner) and
  feedback-window tracking
- Public feedback submission on draft TORs
- Error reporting and data correction
- Price-anomaly and low-competition flagging for the Auditor Office
- Administrative pipeline monitoring, moderation, and audit logging

Scoped to BMA data from 2022 onward.

**What it deliberately does NOT do:** The platform will not replace official
government procurement systems (e-GP). It serves as a discovery, matching,
and transparency layer built on top of publicly available TOR information —
not a system of record.

**Main benefits:**
- Reducing the time software companies spend finding and qualifying TORs
- Providing a single place to discover TORs scattered across many sources
- Matching relevant opportunities to a company's profile automatically
- Giving the public and สตง. visibility into procurement fairness and
  pricing
- Giving Project Owners visibility into vendor interest and public feedback
  on their own TOR

**Source material this SRS is based on:** TOR Finder Software Project
Proposal, Stakeholder Analysis, User Stories, Functional Requirements,
Feature Analysis, Demo/UI Mockups, Timeline & Roadmap.

## 3. Stakeholders & Users

| Stakeholder | Role | Responsibilities | Needs from the system |
| --- | --- | --- | --- |
| Developer Team | System Development | Analyze requirements, design, implement, test, and deliver the platform on time (Backend/AI, PM/QA, Frontend/DevOps workstreams) | Clear and stable requirements with a realistic 15-week scope |
| BMA / Project Owner | Project Sponsor / TOR Publisher | Publish TORs, define project scope, monitor vendor interest and feedback on their own TOR | A dashboard showing TOR status, match count, and feedback collected |
| Software Company (Bidder) | End User / Bidder | Search and evaluate TORs, set up a matching profile, and submit qualification-based bids | A filtered, matched, and notified list of TORs with qualification info already extracted |
| Public / People | General Public / Observer | Monitor government spending and review TOR status and feedback windows | An easy way to see TOR status, feedback window, and price info |
| สตง. (Auditor Office / SAO) | Oversight Body | Watch for bad pricing and unfair, non-competitive deals across thousands of scattered listings | Automatic flags for unusual pricing or low-competition deals |
| Admin | System Operator | Keep the pipeline running accurately, correct misclassified TORs, moderate feedback, and prevent abuse | A pipeline health dashboard, correction tools, and moderation controls |

**Intended audience for this document:** Developer Team (implementation),
Project Owner/BMA (review and validation), End Users — Software Companies &
Public (understanding available functions), System Administrator
(admin/moderation/pipeline functions), Auditor Office/สตง. (oversight and
anomaly-flagging functions).

## 4. Features

TOR Finder is a centralized web platform that collects, classifies, and
structures software-related TOR information from BMA-affiliated government
agencies, then surfaces it to software companies, the public, the Project
Owner, and the Auditor Office (สตง.) through one dashboard.

**Flow:** e-GP / BMA Agency Sites → Automated Data Collection (scrape +
dedupe) → AI Classification (software / not software) → AI Field Extraction
(scope, qualifications, price, deadline) → TOR Repository → Search,
Matching, Status Tracking, Dashboard, and Notifications

The system also provides administrative functions for correcting
misclassified or erroneous TORs, moderating feedback, and auditing user
activity.

**Major product functions:**

*Authentication & Account*
- Register and log in (email/password or OAuth)
- Bookmarks and notifications tied to account across devices
- (Admin) manage user accounts and permissions

*Automated Data Collection*
- Automatically pulls TOR announcements from e-GP, filtered to
  BMA-affiliated agencies, limited to data from 2022 onward
- Duplicate TORs across multiple sources are merged
- Scraper/sync failures are logged and Admins are alerted

*AI Classification & Extraction*
- Each listing classified as "software" or "not software" using AI (Gemini)
- Key fields extracted from each TOR: scope, bidder qualifications, price
  benchmark, feedback deadline (Vertex AI / Document AI)

*TOR Search & Discovery*
- Search/filter by keyword, agency, category, budget, deadline, technology
  stack
- View full TOR details and open the original source document

*Matching & Personalization*
- Software company creates/edits a matching profile (skills, size,
  specialty)
- Match score calculated between company profile and each TOR (Vector
  Search / semantic matching)
- Notification when a new TOR matches above a set score
- Bookmark TORs and save search queries for reuse

*Status & Feedback*
- TOR status stage shown (plan → draft → price → invite → winner)
- TORs open for public feedback are flagged
- Public users can submit feedback on a draft TOR
- Project Owners see match count and feedback collected on their own TOR

*Quality & Oversight*
- Users report errors/discrepancies on TOR listings
- Admins correct wrongly classified or erroneous TORs
- Admins remove/hide spam/abusive feedback
- TORs with unusual pricing or low-competition methods flagged for สตง.
- User actions relevant to audit/oversight logged (audit trail)

**Operating environment:** Web-based platform with responsive access on
desktop, tablet, and mobile devices.

**Constraints:**
- TOR information collected only from e-GP and BMA-affiliated agency
  sources
- Automated collection limited to BMA data from 2022 onward (FR-26)
- Collected TOR information may become outdated if the original government
  source changes; system always links back to the original source and
  last-updated timestamp for verification
- Does not replace official government procurement systems (e-GP)
- 12 week development plan with a team of three
- MVP focuses on Must-priority features: authentication, data collection, AI
  classification/extraction, search, matching, notifications, status
  tracking, admin panel

## 5. Functional Requirements

### 5.1 Authentication & Account Management

This feature handles user registration, login, and account-linked data
(bookmarks, notifications), plus administrative control over accounts and
permissions.

- **FR-01:** The system shall allow users to register and log in
  (email/password or OAuth).
- **FR-02:** The system shall restrict access to profile, bookmarks, and
  notifications to authenticated users.
- **FR-03:** The system shall let Admin manage user accounts and
  permissions.

Priority: Must
Trigger → Outcome: User registers with email/password or OAuth → system
creates an account and authenticates the session. User logs in with valid
credentials → system restores profile, bookmarks, and notifications. Admin
disables or edits a user account → system updates permissions and logs the
action. Unauthenticated user attempts to access profile/bookmarks → system
redirects to login.

### 5.2 Automated Data Collection

This feature keeps the TOR repository current by automatically ingesting
TOR announcements from e-GP and BMA agency sources, removing duplicates,
and alerting Admin when collection fails.

- **FR-04:** The system shall scrape/ingest TOR announcements from e-GP,
  filtered to BMA-affiliated agencies.
- **FR-05:** The system shall deduplicate TORs that appear across multiple
  sources.
- **FR-06:** The system shall log scraper/sync failures and alert Admin.
- **FR-26:** The system shall limit automated data collection to TOR
  announcements from BMA-affiliated agencies published in 2022 or later;
  records outside this scope shall not be ingested into the repository.

Priority: Must
Trigger → Outcome: Scheduled scraper job runs → system pulls new TORs,
filtered to BMA-affiliated agencies. System detects the same TOR across
multiple sources → merges duplicate records. Scraper job fails or times out
→ system logs the failure and alerts Admin.

### 5.3 AI Classification & Field Extraction

This feature uses AI (Vertex AI: Document AI and Gemini) to determine which
ingested listings are genuinely software-related and to convert each
qualifying TOR PDF into structured, queryable fields. This is the core
capability of the product, not a bolt-on.

- **FR-07:** The system shall classify each listing as "software" or "not
  software" using AI.
- **FR-08:** The system shall extract key fields from each TOR: scope,
  qualifications, price, and feedback deadline.

Priority: Must
Trigger → Outcome: New TOR ingested → system classifies it as "software" or
"not software." Listing classified as software-related → system extracts
scope, qualifications, price benchmark, and feedback deadline from the PDF.
Classification confidence is low or extraction fails → system flags the
record for Admin review (see 5.7).

### 5.4 TOR Search & Discovery

This feature lets users search, filter, and inspect TOR records produced by
5.3, including access to the original source document.

- **FR-09:** The system shall let users search TORs by keyword, agency, and
  category.
- **FR-10:** The system shall let users filter TORs by budget, deadline,
  and technology stack.
- **FR-11:** The system shall let users view full TOR detail and access the
  original document.

Priority: Must
Trigger → Outcome: User enters keywords or selects filters → system updates
results in real time. User applies budget/deadline/tech-stack filters →
results narrow. User selects a TOR → system displays full detail and a link
to the original document. Query yields no results → system displays "no
results found."

### 5.5 Matching, Personalization & Notifications

This feature lets a software company describe itself once and have the
system continuously surface and notify it of relevant opportunities, while
saving time on repeat searches.

- **FR-12:** The system shall let a company create and edit a matching
  profile.
- **FR-13:** The system shall calculate a match score between a company
  profile and each TOR.
- **FR-14:** The system shall send a notification when a new TOR matches
  above a set score.
- **FR-15:** The system shall let users bookmark a TOR.
- **FR-16:** The system shall let users save a search query and reuse it.

Priority: Must (profile matching may optionally use AI/Vector Search;
notifications, bookmarking, and saved searches are rule-based)
Trigger → Outcome: Company creates/edits a matching profile → system stores
skills, size, specialty for scoring. New TOR classified and extracted →
system scores it against active profiles. Score exceeds threshold → system
sends a notification. User bookmarks a TOR → saved to bookmark list. User
saves a search query → filter set stored for reuse.

### 5.6 Status Tracking & Public Feedback

This feature shows where each TOR is in its lifecycle, flags the window
during which the public can comment on a draft, and gives Project Owners
visibility into how their TOR is being received.

- **FR-17:** The system shall show each TOR's status stage (plan → draft →
  price → invite → winner).
- **FR-18:** The system shall flag TORs currently open for public feedback.
- **FR-19:** The system shall let public users submit feedback on a draft
  TOR.
- **FR-20:** The system shall show match count and feedback per TOR to the
  Project Owner.

Priority: Must for status/feedback visibility (FR-17, FR-18, FR-20); Should
for public feedback submission (FR-19)
Trigger → Outcome: User views a TOR → system displays current status stage.
TOR enters public-comment period → system flags it as open for feedback.
Public user submits feedback → system records it as "Pending." Project
Owner views their TOR → system shows match count and collected feedback.

### 5.7 Quality, Oversight & Administration

This feature keeps the repository accurate and the platform free of abuse,
and gives the Auditor Office an automated way to spot pricing or
competition red flags across a volume of listings it could not otherwise
review by hand.

- **FR-21:** The system shall let users report an error/discrepancy on a
  TOR listing.
- **FR-22:** The system shall let Admin correct a wrongly classified or
  erroneous TOR.
- **FR-23:** The system shall let Admin remove or hide spam/abusive
  feedback.
- **FR-24:** The system shall flag TORs with unusual price or
  low-competition method for Auditor Office.
- **FR-25:** The system shall log user actions relevant to admin/audit
  review (audit trail).

Priority: Must for error reporting/correction, moderation, and the audit
trail (FR-21, FR-22, FR-23, FR-25); Could for price-anomaly flagging (FR-24)
Trigger → Outcome: User reports an error → system records it for Admin
review. Admin corrects a wrongly classified/erroneous TOR → record and
"last updated" metadata are updated. Admin hides spam/abusive feedback →
content is hidden from public view. System detects unusual pricing or
low-competition method → flags the TOR for Auditor Office review. Any
audit-relevant user action → system logs it.

## 6. External Interfaces

**Screens/pages, grouped by access level:**

*Public Access (no login required)*
- Home / Landing Page — value proposition, TOR search entry point, quick
  access to sign-in
- Search Page — search bar and filters (keyword, agency, category, budget
  range, deadline, technology stack)
- TOR Detail Page — project scope, agency, budget, qualifications, price
  benchmark, feedback deadline, status timeline, link to original e-GP
  source
- Public Feedback Screen — form to submit feedback on a draft TOR, view of
  current feedback window
- Login Screen — email/password, login action, password recovery,
  registration link
- Registration Screen — name, email, password, password confirmation,
  email verification

*End User (registered, logged in)*
- Company Profile Screen — company size, specialty/tech stack, experience,
  used to compute match scores
- Matched TORs Dashboard — matched TORs with match score, deadline, status
  (draft / open for feedback / announced)
- Notification Page / Settings — match notifications and channel
  preferences (email / in-app)
- Bookmarks & Saved Searches Screen — saved TORs and reusable saved search
  filters
- TOR Detail Page (logged-in view) — includes AI classification confidence
  and capability-match indicator, in addition to public fields

*Project Owner (registered, logged in)*
- Project Owner Dashboard — match count and feedback collected on the
  owner's published TOR

*Administrator*
- Admin Panel — data collection health dashboard (collection status,
  failures), TOR correction tools, feedback moderation queue, user
  management, audit log

*Auditor (สตง.)*
- Auditor View — list of TORs flagged for unusual pricing or
  low-competition procurement method

*Applies to all screens*
- Error Messages — clear notifications for invalid input, failed searches,
  unavailable documents, unsuccessful data collection, and other system
  errors

**Other systems it connects to:**

*e-GP and BMA Agency Websites*
- Purpose: provide publicly available TOR announcements for automated
  collection, limited to BMA-affiliated agencies
- Data in: published TOR announcements, project details, budgets,
  procurement method, qualifications, documents/attachments, source URLs
- Data out: structured TOR records stored in the TOR repository
- Communication: automated collection of TOR data from supported
  government sources
- Processing: data extraction, deduplication, classification, scheduled
  synchronization
- References: Bangkok Metropolitan Administration
  (https://egp2.bangkok.go.th/), Open Government Data of Thailand
  (https://data.go.th/), Metropolitan Electricity Authority
  (https://procurement.mea.or.th/), Ministry of Labour
  (https://www.mol.go.th/procurement_categories/draft-tor-and-tender-documents),
  Digital Government Development Agency
  (https://www.dga.or.th/procurements/)

*AI Processing Service*
- Purpose: classify TOR listings as software-related, extract structured
  fields from TOR PDFs, compute company-to-TOR match scores
- Data in: raw TOR PDF documents; company profile data (skills, size,
  specialty)
- Data out: classification label (software / not software), extracted
  fields (scope, qualifications, price, deadline), numeric match score
- Processing: document parsing to extract text and fields from PDFs;
  AI-based classification and matching against company profiles

**Communications interfaces:**
- Protocol: HTTPS (secure, encrypted connection) for communication between
  users, the web application, and supported external sources
- Data format: structured data (JSON) for transferring TOR records, user
  information, match scores, feedback, notification data, and collection
  status between system components
- Document access: web-based access to TOR documents and attachments in
  their original formats
- Source verification: web links to the original e-GP/agency source for
  each TOR
- Authentication communication: secure communication for registration,
  email verification, login, password reset, and administrator access
- Notification communication: between the matching engine and the
  notification interface when newly published TORs match a user's profile
  or saved search
- Data collection communication: with e-GP and BMA agency sources for
  collecting and synchronizing publicly available TOR information
- Error communication: transmission and display of collection errors,
  classification failures, unavailable sources, invalid requests, and other
  system error information

## 7. Non-functional Requirements

**Performance:**
- Home page and search results load within 2 seconds under normal network
  conditions
- Search filtering/sorting updates displayed within 1 second
- AI classification and field-extraction pipeline processes a newly
  ingested TOR PDF within 5 minutes of ingestion
- Supports at least 100 concurrent users without degradation, consistent
  with a single-agency (BMA) MVP scale of ~500 new TORs/month
- Automated data collection and AI processing jobs execute in the
  background without affecting core application response times

**Safety:**
- All user inputs (search filters, profile data, feedback submissions) are
  validated to prevent injection attacks and invalid data entry
- Rate limiting on search, feedback submission, and data collection API
  endpoints to prevent abuse
- Error logs and execution history maintained for all automated scraping
  and AI-processing jobs
- Validation checks detect and prevent duplicate TOR records from
  corrupting the repository
- AI classification/extraction outputs below a confidence threshold route
  to Admin for manual review rather than publishing unchecked

**Security:**
- All user passwords hashed using industry-standard password hashing
  algorithms
- All client-server data transmissions encrypted using standard TLS/HTTPS
  protocols
- Role-based access control (RBAC) isolates Admin and Project Owner
  functions from standard End User and Software Company access
- Session tokens for logged-in users securely stored and expire after a
  defined period of inactivity
- Company profiles, saved searches, bookmarks, and feedback histories
  accessible only to the account owner, or to Admin for moderation
- Registered user and company profile data handled in a manner consistent
  with Thailand's Personal Data Protection Act (PDPA)

**Software Quality Attributes:**
- *Availability:* 99% uptime during the evaluation period, excluding
  scheduled maintenance windows
- *Usability:* fully responsive across desktop, tablet, mobile devices; TOR
  search to full TOR details reachable within 3 clicks from home page
- *Scalability:* database and Vector Search index scale horizontally to
  handle growing volumes of TOR records as additional agencies or fiscal
  years are added
- *Maintainability:* codebase follows a modular architecture allowing new
  BMA agency data sources to be added without modifying the core web
  application
- *Reliability:* gracefully handles external e-GP/agency website failures
  by logging collection errors and retrying scheduled sync jobs without
  disrupting existing platform features

## 8. Business Rules & Hard Constraints

- The system shall collect and analyze only publicly available
  software-related TOR information from BMA-affiliated agencies.
- The system shall only include BMA data from 2022 onward (FR-26).
- A TOR record must pass AI classification as "software" before it is
  surfaced to software companies in search and matching.
- Match notifications shall only be sent when a TOR's match score exceeds
  the company's configured threshold.
- Public feedback and error reports are subject to Admin moderation before
  remaining visible to other users.
- All TOR records displayed in the repository must retain a traceable link
  to their original e-GP/agency source URL for verification.

## 9. User Stories

- **US-01:** As a user, I want to register and log in, so that I can access
  my profile and save data.
- **US-02:** As a user, I want my bookmarks and notifications tied to my
  account, so I don't lose them across devices.
- **US-03:** As an admin, I want to manage user accounts and permissions,
  so I can control access and handle abuse.
- **US-04:** As an admin, I want the system to pull TORs from e-GP
  automatically, so I don't have to check manually.
- **US-05:** As an admin, I want duplicate TORs merged, so users don't see
  the same listing twice.
- **US-06:** As an admin, I want to be alerted when the scraper fails, so
  data doesn't silently go stale.
- **US-07:** As a software company, I want only software-related TORs
  shown to me, so I don't waste time on irrelevant listings.
- **US-08:** As a software company, I want qualification requirements
  already extracted from the TOR, so I don't have to read the full PDF.
- **US-09:** As a user, I want to search TORs by keyword, agency, or
  category, so I can find relevant projects quickly.
- **US-10:** As a user, I want to filter TORs by budget, deadline, and tech
  stack, so I only see what fits me.
- **US-11:** As a user, I want to view full TOR details and open the
  original document, so I can verify the extracted info.
- **US-12:** As a software company, I want to set up a profile with my
  skills and size, so the system can match me to relevant TORs.
- **US-13:** As a software company, I want a match score for each TOR, so
  I know how well it fits me.
- **US-14:** As a software company, I want to get notified when a new TOR
  matches my profile, so I don't miss opportunities.
- **US-15:** As a software company, I want to bookmark a TOR, so I can
  find it again later.
- **US-16:** As a software company, I want to save a search query, so I
  don't have to re-enter the same filters every time.
- **US-17:** As a user, I want to see a TOR's current status stage, so I
  know if it's still open or already awarded.
- **US-18:** As a public user, I want to know when a TOR is open for
  feedback, so I can comment before it's finalized.
- **US-19:** As a public user, I want to submit feedback on a draft TOR,
  so I can raise concerns about fairness.
- **US-20:** As a project owner, I want to see match count and feedback on
  my TOR, so I know how it's being received.
- **US-21:** As a user, I want to report an error on a TOR listing, so
  incorrect data gets fixed.
- **US-22:** As an admin, I want to correct a wrongly classified or
  erroneous TOR, so the data stays accurate.
- **US-23:** As an admin, I want to remove or hide spam/abusive feedback,
  so the feedback section stays useful.
- **US-24:** As an auditor, I want TORs with unusual pricing or low
  competition flagged, so I can review them faster.
- **US-25:** As an admin, I want a log of user actions, so I can audit
  activity if something goes wrong.

## 10. Traceability

| User Story ID | User Story Summary | Functional Requirements | Feature |
| --- | --- | --- | --- |
| US-01 | Register and log in | FR-01 | F1 |
| US-02 | Bookmarks/notifications tied to account | FR-02 | F1 |
| US-03 | Admin manage user accounts and permissions | FR-03 | F1 |
| US-04 | Auto-pull TORs from e-GP | FR-04 | F2 |
| US-05 | Merge duplicate TORs | FR-05 | F2 |
| US-06 | Alert admin on scraper failure | FR-06 | F2 |
| US-07 | Only software-related TORs shown | FR-07 | F3 |
| US-08 | Qualification requirements extracted | FR-08 | F3 |
| US-09 | Search TORs by keyword/agency/category | FR-09 | F4 |
| US-10 | Filter by budget/deadline/tech stack | FR-10 | F4 |
| US-11 | View full TOR detail and original document | FR-11 | F4 |
| US-12 | Set up a matching profile | FR-12 | F5 |
| US-13 | Match score for each TOR | FR-13 | F5 |
| US-14 | Notified when a new TOR matches | FR-14 | F5 |
| US-15 | Bookmark a TOR | FR-15 | F5 |
| US-16 | Save a search query | FR-16 | F5 |
| US-17 | See TOR's current status stage | FR-17 | F6 |
| US-18 | Know when TOR is open for feedback | FR-18 | F6 |
| US-19 | Submit feedback on a draft TOR | FR-19 | F6 |
| US-20 | Project Owner sees match count and feedback | FR-20 | F6 |
| US-21 | Report an error on a TOR listing | FR-21 | F7 |
| US-22 | Admin correct misclassified/erroneous TOR | FR-22 | F7 |
| US-23 | Admin remove/hide spam feedback | FR-23 | F7 |
| US-24 | Flag unusual pricing/low competition for สตง. | FR-24 | F7 |
| US-25 | Log of user actions (audit trail) | FR-25 | F7 |

Note: FR-26 (data-scope constraint — BMA data from 2022 onward) has no
dedicated user story; it is enforced as a business rule (see Section 8)
applied across Automated Data Collection and TOR Search & Discovery.

For how each FR was actually delivered sprint by sprint, see the team's
GitHub Projects iteration backlog, summarized in
[docs/iterations/](../iterations/).

## 11. Open Issues & Assumptions

**Open Issues:**
- Reconciliation between e-GP and BMA's own procurement sources listed in
  Section 6 has not been finalized, specifically how duplicate TORs are
  matched and which field values take priority when sources conflict.
- Specific numeric confidence threshold(s) for AI classification and for
  each extracted field have not yet been defined.
- The specific OAuth identity provider(s) to support for FR-01 have not
  been finalized.
- The method for defining "unusual pricing" or "low-competition" for FR-24
  (statistical outlier detection vs. rule-based thresholds by
  category/agency) has not been decided, and depends on how much
  historical BMA pricing data is available for calibration.
- Whether both email and in-app notification channels are required for
  MVP, or whether in-app alone is sufficient for the Must-priority scope,
  has not been confirmed.
- How the initial repository will be populated with pre-existing 2022–2026
  TORs versus relying solely on the ongoing scheduled sync has not been
  decided.

**Assumptions:**
- The listed e-GP and BMA agency sources provide sufficient publicly
  available data for automated collection.
- The estimated volume of ~500 new TORs per month and the ~฿6,912/month
  AI/cloud operating cost will remain roughly accurate through the 15-week
  development and evaluation period.
- Google Vertex AI (Gemini and Document AI) will remain accessible and
  priced consistently with current estimates for the duration of the
  project.
- MongoDB Atlas's free tier will be sufficient for development and
  evaluation-scale data volumes; a paid tier is not required within the
  project timeline.
- The three-person team's role split (Backend/AI, PM/QA/Test,
  Frontend/DevOps) will remain stable for the duration of the 15-week plan.
- BMA-affiliated agencies' TOR publication formats and PDF structures will
  remain reasonably consistent, such that AI extraction logic built during
  development continues to work without major rework.
- The MVP evaluation environment will not require handling real financial
  transactions or legally binding submissions; TOR Finder remains a
  discovery/transparency layer, not a bidding system of record.

## Appendix A. Glossary

- **Bangkok Metropolitan Administration (BMA)** — The local government
  authority responsible for public administration and procurement across
  Bangkok's districts and agencies.
- **Terms of Reference (TOR)** — Official public document defining the
  scope, requirements, budget, qualifications, and submission details for a
  government procurement project.
- **TOR Finder** — The name of the software system described in this
  document; a platform that discovers, classifies, extracts, matches, and
  tracks BMA software-related TORs.
- **e-GP** — The Electronic Government Procurement system used to publish
  Thai government procurement announcements.
- **State Audit Office (SAO)** — The Thai government oversight body
  responsible for auditing public spending, including checking for unfair
  or non-competitive procurement.
- **Match Score** — A numeric score representing how well a software
  company's profile fits a given TOR, calculated by the AI matching engine.
- **Vertex AI** — Google Cloud's AI platform used by TOR Finder for
  Document AI (PDF parsing) and Gemini (classification and matching).
- **Vector Search** — A semantic search capability in MongoDB Atlas used to
  match company profiles to TORs based on meaning, not just keywords.
- **Sole-source procurement** — A procurement method awarded without open
  competitive bidding, which สตง. monitors for fairness risk.
- **MVP (Minimum Viable Product)** — The initial release of TOR Finder
  containing the Must-priority feature set.
- **Role-Based Access Control (RBAC)** — System restricting capabilities
  and features based on assigned user role (e.g., Software Company, Public,
  Project Owner, Admin).
- **Stakeholder** — Any individual or group involved in or impacted by the
  system, including the Developer Team, BMA/Project Owner, Software
  Companies, the Public, สตง., and Admin.

## Appendix B. Mockup

The original SRS includes annotated UI mockups (Figures 1–12): Home/Landing
Page, Search Results (public portal), the value-proposition/onboarding
section, account-type selection and login, registration, TOR search with
filters, the TOR detail page, the Matched TORs dashboard, the bookmarks
empty state, the company profile screen, and the notifications feed — each
captioned with which section/FR it corresponds to. See the original SRS PDF
for the actual screens.
