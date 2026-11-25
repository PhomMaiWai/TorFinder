# TorFinder v1.0

Release notes for deliverable D11 ([deliverables.md](./deliverables.md)).
The same text is used for the GitHub release.

**Released:** 26 Nov 2026 (final presentation) · **Commit:** `_______`
(the commit presented) · **Shipped as:** a Docker Compose release that runs
from a fresh clone (decided 25 Nov 2026, see [D10](./deliverables.md#decisions-that-changed-the-deliverables))

## What TorFinder does

TorFinder collects Bangkok (BMA) government software procurement
announcements (TORs) from e-GP and MEA in one place, reads the
TOR documents with AI, and matches them to software companies' profiles so
each company hears about the projects worth bidding on, early.

## What is in v1.0

- **Search and detail:** keyword, agency and category search; budget and
  deadline filters; "best time to prepare" sort; five-stage procurement
  timeline; the original document from each TOR.
- **For companies:** matching profile with progress nudges, match scores,
  alerts in the app and by email and LINE, saved TORs and searches,
  "find similar", market insights, a growth path, a proposal library with
  certificates as records, and an AI proposal draft.
- **For the public:** which draft TORs are still open for public comment and
  until when (shown on the TOR and as a search filter), and "report a problem"
  on any listing.
- **For admins:** account approval and roles (role changes approved by a
  second admin), TOR corrections with locked fields,
  problem reports, import health with alerts, and one audit trail.
- **Security:** OWASP ASVS 5.0 Level 1 and Level 2 with no failing item,
  staff passkeys, session management, internal mutual TLS. See
  [SECURITY.md](../../SECURITY.md).

23 of the 24 SRS functional requirements in scope are done and FR-10 is
partial. FR-20 and FR-24 were removed with their roles on 22 Nov. The
pass/fail table is in [testing.md](../process/testing.md#functional-requirements-release-check-v10).

## Install

Follow the [README](../../README.md#getting-started): clone, copy
`.env.example` to `.env`, set `SESSION_SECRET` and `SEED_DEMO_DATA=true`,
then `docker compose up -d --build`. Demo accounts are listed in the
[README](../../README.md#demo-accounts).

## Documents

| What | Where |
| --- | --- |
| Deliverables and their status | [deliverables.md](./deliverables.md) |
| Requirements and KPIs | [srs.md](../requirements/srs.md), [kpi.md](../requirements/kpi.md) |
| Design | [architecture.md](../architecture.md), [design/](../design/README.md) |
| Tests | [testing.md](../process/testing.md) |
| Process | [team-workflow.md](../process/team-workflow.md), [retrospectives.md](../process/retrospectives.md), [iterations/](./iterations/) |
| User feedback | [in-class-comments-review.md](../feedback/in-class-comments-review.md), [uat-log.md](../feedback/uat-log.md) |
| Operations | [deployment-checklist.md](../operations/deployment-checklist.md), [maintenance.md](../operations/maintenance.md), [configuration.md](../operations/configuration.md) |
| Security | [project-document.md](../security/project-document.md) |

## Known limitations

| Limitation | Why | Tracked in |
| --- | --- | --- |
| No hosted site; v1.0 runs with Docker Compose | No hosting target was chosen; the deployment is documented so it can be done later | D10, #236 to #240 |
| AI reads 27% of TOR documents (target 80%) and runs hourly (target 5 minutes) | Queue and source formats; MEA zip files and award notices were added on 25 Nov (#421, #423) | KPI K7, K9; #399, #400 |
| No tech-stack filter (FR-10 partial) | Needs a reliable tech-stack field from AI extraction | FR-10 |
| Frontend tests are not run in CI | They need a running backend and `next start` | KPI K16 |
| The "software or not" import filter has no test of its own | Found in the release check | FR-07 in [testing.md](../process/testing.md#functional-requirements-release-check-v10) |
| Accessibility not audited against the DGA standard and WCAG | Planned after the client review; text size and chart contrast done | #263 |
| 2 moderate Dependabot alerts (`minimatch`) | Development dependencies only, not in the running app; dependencies frozen for the release | Dependabot alerts 2, 3 |

## Team

Sai Khun Main ([@SKlv1ain](https://github.com/SKlv1ain)), Nisara
Ploysuttipol ([@fcxbsyo](https://github.com/fcxbsyo)), Bhumipat Kusalatham
([@OverCatX](https://github.com/OverCatX)).

---

## Release checklist (team)

Before tagging, on the commit you will present:

1. All PRs for the release merged; no open PR left that changes the demo.
2. CI green on that commit (`gh run list --branch main --limit 3`).
3. Fresh clone and `docker compose up -d --build` from the README works;
   demo accounts sign in. **Checked 25 Nov on `85d6251`:** clean clone,
   README steps only; every service started; company and admin demo accounts
   signed in; the first import added 44 TORs (35 e-GP, 9 MEA) within about 3
   minutes, after which matches and a match alert appeared. Two problems
   found and added to the README troubleshooting list: no open TORs until
   that first import finishes, and Docker running out of disk (#233).
4. Manual column of the FR table in [testing.md](../process/testing.md#functional-requirements-release-check-v10)
   filled in.
5. Put the commit in the line at the top of this file, merge that change,
   then tag the merge commit:

```bash
git switch main && git pull
git tag -a v1.0 -m "TorFinder v1.0: final release for the Software Process course"
git push origin v1.0
B=https://github.com/PhomMaiWai/TorFinder/blob/v1.0
sed -n '/^## Release checklist/q;p' docs/project/release-v1.0.md \
  | sed -e "s#](\.\./\.\./#]($B/#g" -e "s#](\.\./#]($B/docs/#g" -e "s#](\./#]($B/docs/project/#g" \
  > /tmp/release-notes.md
gh release create v1.0 --title "TorFinder v1.0" --notes-file /tmp/release-notes.md --verify-tag
```

The `sed` steps drop this checklist from the notes and turn the relative
links into links to the `v1.0` tag, so they work on the release page.
