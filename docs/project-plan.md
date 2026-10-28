# Project Plan — TorFinder

## 1. Vision

TorFinder aggregates Thai government software-procurement announcements (TOR)
from an official source (Bangkok's e-GP service) in one place, lets
administrators curate and correct them, and helps registered software
companies (Organizations) find the opportunities that match their work
through automated matching.

## 2. Scope

**In scope**
- Importing announcements from e-GP (Bangkok) — no scraping, via the
  agency's own public API
- TOR management as full CRUD by administrators, with soft delete/restore
- Organization signup and approval (signup → pending → approved)
- Matching TORs against company profiles via AI extraction + match scoring
- Four user roles: Administrator, Organization, Project Owner, Auditor (see
  the SRS)
- Multi-channel notifications (in-app, email, LINE, Slack)
- Bilingual UI (Thai/English) and dark/light theme
- Docker Compose deployment for local/dev

**Out of scope**
- Rich-media file uploads (the system has no file-upload feature at all)
- Acting as an OAuth/OIDC authorization server (the app is only a Google
  OAuth client)
- Scraping sites with no official API (except where explicitly used as a
  fallback)

## 3. Stakeholders & Roles

Per the team's SRS (see [specs/srs.md](./specs/srs.md), Section 3):

| Stakeholder | Needs from the system |
| --- | --- |
| Developer Team | Clear and stable requirements with a realistic scope |
| BMA / Project Owner | A dashboard showing TOR status, match count, and feedback collected |
| Software Company (Bidder) | A filtered, matched, and notified list of TORs with qualification info already extracted |
| Public / People | An easy way to see TOR status, feedback window, and price info |
| สตง. (Auditor Office) | Automatic flags for unusual pricing or low-competition deals |
| Admin | A pipeline health dashboard, correction tools, and moderation controls |

The implemented app uses slightly different labels for the same roles:
Administrator, Organization (= Software Company/Bidder), Project Owner,
Auditor, and Public visitor. See per-endpoint permissions in
[security-asvs-l1.md](../backend/docs/security-asvs-l1.md), section V8 —
Authorization.

## 4. Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, next-intl |
| Backend | NestJS 11, MongoDB driver |
| Database | MongoDB 7 |
| Auth | HMAC-signed session token in an httpOnly cookie, Google OAuth |
| AI | Vertex AI (extraction + match scoring) |
| Deployment | Docker Compose |
| CI/CD | GitHub Actions (`.github/workflows/auth.yml`) |

Setup and environment-variable details live in [README.md](../README.md).

## 5. Process

The project was built in weekly iterations tracked on a GitHub Projects
board, each epic tagged with the SRS functional requirement it implements
(see [specs/srs.md](./specs/srs.md) Section 5 for FR-01…FR-26). See the
summary below and the per-iteration backlog in
[docs/iterations/](./iterations/). Work merges into `main` through review
and CI (lint, build, and an e2e test of the signup/login flow — see
[auth.yml](../.github/workflows/auth.yml)).

Branching/commit conventions: one `feature/<name>` branch per issue, and
Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
`test:`) as documented in the README.

## 6. Iteration Overview

| Iteration | Dates | Status |
| --- | --- | --- |
| 1 | Aug 27 – Sep 02 | Auth, backend setup, TOR CRUD, theming, i18n — all Done |
| 2 | Sep 03 – Sep 09 | Google OAuth, e-GP integration, AI matching, company profiles — all Done |
| 3 | Sep 10 – Sep 16 | Saved TORs, notifications, more data sources, real admin dashboard — all Done |
| 4 | Sep 17 – Sep 23 | Access gaps, AI classification, scope limits, recovery flows — 6/9 epics Done |
| 5 | Sep 24 – Sep 30 | Match scoring, roles, feedback moderation, status timeline — 6/10 epics Done |
| 6 | Oct 01 – Oct 07 | Owner dashboard, error reporting, corrections, auditor flagging — 1/4 epics Done |
| 7 | Oct 08 – Oct 14 | In-class review feedback (13-item epic) — 1/13 Done |
| 8 | Oct 15 – Oct 21 | Not yet captured in full (see [iteration-8.md](./iterations/iteration-8.md)) |

The board continues past iteration 8; git history shows active development
through 2026-10-28.

## 7. Known Documentation Gap

This project plan and the iteration write-ups in
[docs/iterations/](./iterations/) are built directly from the team's
GitHub Projects board, which is the source of truth for planned vs.
delivered scope. The board snapshot used here only goes through iteration
8; later iterations (covering notifications, security hardening, the UI
redesign, and admin governance work visible in git history through
2026-10-28) should be pulled from the live board and added as
`iteration-9.md` onward.
