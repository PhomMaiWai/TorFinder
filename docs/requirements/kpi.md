# KPIs

How we tell whether TorFinder does its job. Each KPI has a target, a way to
measure it, and the value we have today where one exists. The targets come
from the [SRS](./srs.md) where it gives a number (section 7, non-functional
requirements) and are the team's own choice where it doesn't.

Today's values for data come from the TOR snapshot that ships with Docker
Compose (`docker/mongo-seed/tors.archive.gz`, taken October 27, 2026, 683
records). The production database will differ; re-measure there after the
deploy (#235).

> **Team to check:** the targets marked "team target" are proposals. Agree
> on them before the UAT session (#232), so the session can report against
> them.

## Summary

| # | KPI | Target | Today | Status |
| --- | --- | --- | --- | --- |
| K1 | TORs in the repository | 500 or more | 683 | ✅ Met |
| K2 | Years covered | Every year from 2022 | 2022 to 2026, every year present | ✅ Met |
| K3 | Records with a link to the original source | 100% | 683 of 683 | ✅ Met |
| K4 | Freshness: time from publication to listing | Within 6 hours (e-GP, MEA) | Sync runs every 6 hours by default | ✅ By design, measure in production |
| K5 | Duplicate TORs across sources | 0 | Not measured | ⏳ To measure |
| K6 | Import failures noticed by an admin | Same day | Alert on the first failed run | ✅ By design |
| K7 | TOR documents read by the AI | 80% of TORs with a document | 173 of 652 (27%) | ❌ Below target |
| K8 | AI extractions the model is confident about | 70% or more | 148 of 173 (86%) at 0.8 or above | ✅ Met |
| K9 | AI processing time after import | Within 5 minutes (SRS) | Extraction job runs hourly | ❌ Not met by default |
| K10 | Page load: home and search | Under 2 s (SRS) | Not measured | ⏳ To measure |
| K11 | Concurrent users | 100 without slowdown (SRS) | Not measured | ⏳ To measure |
| K12 | Availability | 99% during evaluation (SRS) | Not deployed | ⏳ After deploy |
| K13 | Clicks from home to a TOR's details | 3 or fewer (SRS) | 2 (open the TOR list, open a result) | ✅ Met |
| K14 | Functional requirements delivered | 26 of 26 | 25 full, 1 partial | 🟡 Nearly |
| K15 | Backend tests passing in CI | 100% on every PR | About 520 tests, green on the last `main` run (PR #306) | ✅ Met |
| K16 | Frontend tests run in CI | Yes | No | ❌ Not met |
| K17 | Pull requests with a recorded review | 100% | 9 of 97 | ❌ Below target |
| K18 | UAT tasks completed by test users | 90% (team target) | UAT not run yet | ⏳ After #232 |

## Data coverage and quality

These say whether the data is worth searching.

| KPI | Why it matters | How to measure |
| --- | --- | --- |
| **K1** TORs in the repository | A company only comes back if the list is long enough to be useful. The SRS sizes the MVP at about 500 new TORs a month. | Count `tors` without `deletedAt` in MongoDB. |
| **K2** Years covered | FR-26 says 2022 onward. A missing year means an importer or the `TOR_LISTED_SINCE` cutoff is wrong. | Group `tors` by year of `createdAt`. Snapshot: 2022: 68, 2023: 67, 2024: 106, 2025: 173, 2026: 269. |
| **K3** Link to the source | A business rule: every record keeps a traceable link to e-GP or the agency. | Count records with `sourceUrl`. |
| **K4** Freshness | A TOR is only useful before its deadline. | e-GP and MEA poll every 360 minutes, data.go.th every 1,440 (`EGP_POLL_MINUTES`, `MEA_POLL_MINUTES`, `DATAGOV_POLL_MINUTES`). In production, compare each record's `importedAt` with its announcement date. |
| **K5** Duplicates | FR-05. The same project appears on e-GP, MEA and data.go.th; we should list it once. | Group `tors` by `projectNumber` and count groups with more than one record. |
| **K6** Failures noticed | FR-06. A source can be down for days without anyone noticing. | Each failed or partial run notifies every admin (`AdminAlertsService`). Check `syncRuns` for failures without a matching alert. |

Today's snapshot has 513 records from e-GP and 170 from MEA. By stage: 87
open for comments, 252 TOR announced, 344 winner announced.

## AI

| KPI | Why it matters | How to measure |
| --- | --- | --- |
| **K7** Documents read | FR-08. Scope, qualifications and deliverables only appear once the AI has read the PDF. | Records with `extraction` divided by records with at least one `documents` entry. Snapshot: 173 of 652, and 32 more marked `extractionFailure`. The rest are waiting in the queue, or AI was off when they arrived. |
| **K8** Confident extractions | Low-confidence answers are shown as unverified and need an admin to check them. | Share of the model's own `extraction.confidence` at 0.8 or above. Snapshot: 148 of 173. The level shown on the page (`extraction-confidence.ts`) also checks the amounts against the source, so it can come out lower. |
| **K9** Processing time | The SRS asks for 5 minutes from import. | `extraction.extractedAt` minus `importedAt`. The extraction job runs every 60 minutes (`AI_POLL_MINUTES`), so meeting 5 minutes needs `AI_POLL_MINUTES=5` or running extraction right after each import. |

FR-07 (classifying software or not) is done by keyword rules, not the AI,
so it has no AI KPI here. If we want one, measure how many titles the
filter rejected that an admin would have kept, using `/api/egp/near-misses`.

## Performance and availability

All four come from SRS section 7. None can be measured until the system
runs somewhere stable.

| KPI | How to measure |
| --- | --- |
| **K10** Page load under 2 s | Lighthouse or `curl -w "%{time_total}"` against `/` and `/tors?q=...` on the deployed site, 10 runs each, report the median. Filtering and sorting should update within 1 s. |
| **K11** 100 concurrent users | A load test (for example k6 or autocannon) with 100 virtual users browsing and searching for 5 minutes; pass if the median stays under 2 s and no request fails. Note the rate limit is 100 requests a minute per IP by default, so run it from several IPs or raise `THROTTLE_LIMIT` for the test. |
| **K12** 99% availability | An uptime checker calling `/health` every 5 minutes during the evaluation period. 99% allows about 7 hours down in a month. |
| **K13** 3 clicks to details | Counted by hand: home, search, result. |

## Delivery and process

| KPI | How to measure |
| --- | --- |
| **K14** FRs delivered | The status table in [roles-and-features.md](../project/roles-and-features.md#feature-status-against-the-srs). The partial one is FR-10 (no tech-stack filter). Issue #171 is the check against the SRS. |
| **K15** Backend tests green | The Backend job in `.github/workflows/auth.yml` on every PR. |
| **K16** Frontend tests in CI | A CI job that runs `frontend/` tests. See [testing.md](../process/testing.md#what-ci-runs). |
| **K17** Reviewed PRs | Merged PRs with at least one approval, from the GitHub API. Branch protection that requires one approval would keep this at 100%. |
| **K18** UAT completion | Share of scripted tasks each test user finishes without help in the UAT session (#232), plus a short satisfaction score (1 to 5, team target 4 or more). |

## How often to measure

- Every PR: K15, K16, K17.
- Every week, during iteration review: K1, K2, K5, K7, K8, from a few
  MongoDB queries.
- Once after deploy, then once before the final evaluation: K4, K9 to K12.
- Once, at UAT: K13, K14, K18.
