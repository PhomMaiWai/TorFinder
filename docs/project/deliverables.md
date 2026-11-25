# Deliverables

What the team hands over at the end of the Collaborative Software Process
and Project Management course (01219346), who owns each piece, how we know
it is done, and where the evidence is. Every task on the board belongs to
one of these deliverables: each deliverable is a
[GitHub milestone](https://github.com/PhomMaiWai/TorFinder/milestones) of
the same name (D1 to D12, all 207 issues assigned on 25 Nov), and new
issues pick it in the task template's Deliverable field.

Status checked against `main` on 25 Nov 2026. "Lead" is who wrote most of
that deliverable according to the git history; the team can reassign.

**Status key:** ✅ Done · 🟡 Partial (usable, with a known gap) · ❌ Not
done (with the reason).

| ID | Deliverable | Lead | Acceptance criteria | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| D1 | **Working web application** (Next.js frontend, NestJS backend, MongoDB) | Whole team | Runs from a fresh clone with `docker compose up`; covers the SRS functional requirements that are in scope | ✅ 23 of 26 FRs done, FR-10 partial (no tech-stack filter), FR-20 and FR-24 removed with their roles on 22 Nov | [roles-and-features.md](./roles-and-features.md), [README](../../README.md#getting-started) |
| D2 | **Data import and AI pipeline** (e-GP, process5, MEA, data.go.th; Vertex AI extraction and matching) | @OverCatX, @SKlv1ain | Scheduled imports with dedup and admin alerts; AI extraction with a confidence level; match alerts | 🟡 Imports done; AI reads 27% of documents (target 80%) and runs hourly (target 5 min) | [pipeline.md](../operations/pipeline.md), [kpi.md](../requirements/kpi.md) K7, K9, #399, #400 |
| D3 | **Requirements**: SRS v1.0, condensed summary, KPIs | @fcxbsyo | FR-01 to FR-26 and NFRs written, each FR traced to code | ✅ | [srs.md](../requirements/srs.md), [summary.md](../requirements/summary.md), [kpi.md](../requirements/kpi.md) |
| D4 | **Design documents**: use cases, domain model, architecture, ER, class and sequence diagrams, API reference | @OverCatX | Each diagram matches the code on the submitted commit | ✅ Reviewed 25 Nov | [design/](../design/README.md), [architecture.md](../architecture.md) |
| D5 | **Tests and CI** | @fcxbsyo | Backend end-to-end tests and lint/build run on every PR; security checks on every push | 🟡 Backend tests, lint, build, Docker images and security checks in CI; frontend e2e tests run locally only (KPI K16) | [testing.md](../process/testing.md), [`.github/workflows/`](../../.github/workflows/) |
| D6 | **Process records**: project plan, iteration backlogs, team workflow, retrospectives | @SKlv1ain | Every iteration has a backlog write-up; retrospectives record actions and their results | ✅ | [project-plan.md](./project-plan.md), [iterations/](./iterations/), [team-workflow.md](../process/team-workflow.md), [retrospectives.md](../process/retrospectives.md) |
| D7 | **User feedback record** | @SKlv1ain | Every client comment traced to a decision, an issue and a PR; a UAT with 3 to 5 users, logged, with at least 2 findings fixed | 🟡 Client review: 14 of 16 comments delivered, 1 partial, 1 open (#263). UAT: script ready, session not run yet (#232) | [in-class-comments-review.md](../feedback/in-class-comments-review.md), [uat-script.md](../feedback/uat-script.md), [uat-log.md](../feedback/uat-log.md) |
| D8 | **Security self-audit** (Software Security course 01219325, shared codebase) | @SKlv1ain, @fcxbsyo | OWASP ASVS L1 and L2 with 0 failing items, threat model, SAST and DAST reports | ✅ L1 and L2 pass; L3 triaged | [security/](../security/), [SECURITY.md](../../SECURITY.md) |
| D9 | **Operations guide**: deployment checklist, maintenance, limits and retention | @OverCatX | A newcomer can run, back up and update the system | ✅ for Docker Compose | [operations/](../operations/) |
| D10 | **Production deployment** | @OverCatX | Public URL with HTTPS, seeded data, smoke-tested | ❌ Not deployed. Proposed: ship the Docker Compose release instead (team to confirm, see the decisions below) | #236 to #240 |
| D11 | **Release** `v1.0` on GitHub | @SKlv1ain | Annotated tag and release notes on the presented commit, CI green | ⏳ Tagged on presentation day | #397 |
| D12 | **Final presentation and demo** (26 Nov, 35 points) | Whole team | Slides cover the 7 checklist criteria with evidence; demo on a fresh `docker compose up`; one timed rehearsal | ⏳ In progress | #398 |

## How the deliverables map to the SRS

| Deliverable | Functional requirements |
| --- | --- |
| D1 | FR-01 to FR-06 (accounts, roles, approval), FR-09 to FR-19, FR-21 to FR-23, FR-25, FR-26 |
| D2 | FR-07 (software filter), FR-08 (AI extraction), FR-13 (match scoring), FR-14 (alerts) |
| D3 to D12 | Non-functional requirements and course deliverables |

## Decisions that changed the deliverables

| Date | Decision | Why | Evidence |
| --- | --- | --- | --- |
| Oct 2026 | Add market insights, find similar, proposal library, certificates as records and a growth path | The client's in-class review asked for them | Epic #250, [in-class-comments-review.md](../feedback/in-class-comments-review.md) |
| 22 Nov 2026 | Remove the Auditor and Project Owner roles (FR-20, FR-24) | Neither role was being used: each had one read-only page (`/auditor`, `/owner`) | PR #414, PR #416 |
| **Proposed, team to confirm** | Ship as a Docker Compose release, not a hosted site | No hosting target has been chosen ("still an open decision" in the deployment checklist), and the demo runs on a local copy. Deployment stays documented so it can be done later | [deployment-checklist.md](../operations/deployment-checklist.md), #236 |
