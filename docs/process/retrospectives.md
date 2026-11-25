# Retrospectives

How the team changed the way it works, iteration by iteration. Each row is
a problem we saw, what we changed, and what happened afterwards, with the
evidence in this repository.

**About the sources.** No written retrospective notes were kept in the
repository during the project. Rows 1 to 7 below are therefore
**reconstructed from the repository**: each problem and each change is
visible in the git history, the pull requests or the GitHub settings, and
the dates come from there. Rows 8 and 9 were recorded as they happened, in
the last iteration. The [format](#how-we-run-a-retrospective) we use from
now on and the final retrospective come after the numbers.

## Summary

| # | Iteration | Problem we saw | What we changed | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | Pull requests had no common shape, so a reviewer could not tell what to check | A PR template: summary, type, how to test, checklist | 160 of 168 merged PRs use its sections | `.github/pull_request_template.md` (27 Aug) |
| 2 | 2 → 3 | Iteration 2 merged 22 PRs with no automatic tests, and only 3 of them were reviewed | CI on every PR (lint, build, end-to-end tests), then a week of backfilling tests for what already existed | Iteration 3: auth, Google sign-in, TOR CRUD, matching, accounts, saved TORs and notifications covered end to end; about 520 backend tests now | `ci(auth)` commit on 10 Sep; test commits 10 to 16 Sep; [testing.md](./testing.md) |
| 3 | 4 → 8 | Big epics stalled: iterations 4 to 7 finished 6/9, 6/10, 1/4 and 1/13 epics, and work kept carrying over | Split work into small sub-issues, one PR each. The client feedback became one epic with 13 sub-issues (#250) | Iteration 9 merged 38 PRs, 27 of them closing a named issue; all of #250's sub-issues but one are now closed | [iteration-7.md](../project/iterations/iteration-7.md), [iteration-9.md](../project/iterations/iteration-9.md) |
| 4 | 9 → 10 | Almost nothing was reviewed: 5 of the 92 PRs merged before 3 Nov had a teammate's review (KPI K17) | Changed the `main` ruleset on 3 Nov: a PR needs one approving review, no force-push, no deletion | 76 of the 76 PRs merged since then were reviewed by a teammate | Ruleset "main protection" (updated 3 Nov); per-iteration numbers below |
| 5 | 10 → 11 | A timing-based test failed at random, so a red CI run stopped meaning "broken" | Fixed the race (#304), then replaced the timing test with a unit test | The flaky test no longer fails CI at random | #304, commit `9f6df3e` |
| 6 | 11 | Most features were built in September and October, but the design documents were only written on 11 Nov | Rebuilt `docs/` around the code: architecture map, design diagrams, API reference (#308, #309, #316), then kept them in the same PR as the code change | The design docs were updated with each role change on 22 Nov | [design/](../design/README.md) |
| 7 | 12 → 13 | Dependabot opened one PR per package, and a stacked PR merged into its dead base branch instead of `main` (#375) | Grouped Dependabot updates and held majors (#336); rule: retarget a stacked PR to `main` after its base merges, and check the work landed (#378 re-landed #375) | Dependabot now opens one grouped PR per ecosystem; #375's work was re-landed on `main` in #378 | `.github/dependabot.yml`, #336, #375 → #378 |
| 8 | 13 | Issues were thin: about 89 of 197 had a one-line body, and few linked a design doc (#393) | Rewrote the issue bodies with Context, Goal, Acceptance criteria and a Design line (24 Nov, @fcxbsyo); added task and bug templates so new issues start that way (25 Nov) | 207 of 207 issues have acceptance criteria; 106 link a design or requirements doc; blank issues are off | [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/), #393 |
| 9 | 13 | Board tasks did not point at a deliverable: 187 of 197 issues had no milestone (#392) | Wrote the deliverables down (D1 to D12) and made each one a milestone (25 Nov) | 0 of 207 issues without a milestone | [deliverables.md](../project/deliverables.md), [milestones](https://github.com/PhomMaiWai/TorFinder/milestones) |

## Review and issue-linking, per iteration

From the merged pull requests (Dependabot not counted). "Reviewed" means a
teammate other than the author left a review.

| Iteration | Dates | PRs merged | Reviewed | Linked to an issue |
| --- | --- | --- | --- | --- |
| 1 | Aug 27 – Sep 02 | 2 | 2 | 1 |
| 2 | Sep 03 – Sep 09 | 22 | 3 | 9 |
| 3 | Sep 10 – Sep 16 | 16 | 0 | 16 |
| 4 | Sep 17 – Sep 23 | 3 | 0 | 3 |
| 5 | Sep 24 – Sep 30 | 1 | 0 | 0 |
| 6 | Oct 01 – Oct 07 | 8 | 0 | 4 |
| 7 | Oct 08 – Oct 14 | 0 | 0 | 0 |
| 8 | Oct 15 – Oct 21 | 1 | 0 | 1 |
| 9 | Oct 22 – Oct 28 | 38 | 0 | 27 |
| 10 | Oct 29 – Nov 04 | 1 | 0 | 0 |
| **11** | **Nov 05 – Nov 11** (review required from 3 Nov) | 11 | **11** | 6 |
| 12 | Nov 12 – Nov 18 | 25 | 25 | 9 |
| 13 | Nov 19 – Nov 25 | 40 | 40 | 3 |
| **All** | | **168** | **81** | **79** |

To recompute, run:

```bash
gh pr list --state merged --limit 500 --json number,mergedAt,author,reviews,closingIssuesReferences
```

## How we run a retrospective

From now on every retrospective uses this format and is written up here the
same day, not only in chat.

| Step | Time | What happens |
| --- | --- | --- |
| 1. Check last actions | 5 min | Go through the previous action table: done, not done, and did it help? Mark each one here |
| 2. Look at the numbers | 5 min | The per-iteration table above (PRs, reviewed, linked to an issue), open issues per milestone, KPIs that moved |
| 3. Went well / to improve | 10 min | Everyone writes notes on their own first (2 min), then reads them out; group duplicates |
| 4. Vote | 3 min | Each person has 3 votes for the "to improve" items that matter most |
| 5. Actions | 7 min | The top 1 to 3 items become actions, each with **one owner**, a **check date** and **how we will know it worked**. An action with no owner is dropped |

A facilitator (rotating) keeps time; a note-taker fills in the record below.

## Final retrospective (held __ Nov 2026)

**Status: to hold with the whole team before the presentation (26 Nov),
then fill in this section.** The points marked *proposed* were drafted
from the repository numbers on 25 Nov to start the discussion. Keep, change
or delete them in the meeting; anything the team adds goes in too.

**Present:** _ · **Facilitator:** _ · **Note-taker:** _ · **Length:** _ min

### 1. Last actions

| Action (from row) | Done? | Did it help? |
| --- | --- | --- |
| Require one review on `main` (row 4) | ✅ 3 Nov | Yes: 76 of 76 PRs reviewed since |
| Rebuild design docs from the code and keep them in the same PR (row 6) | ✅ 11 Nov | _ |
| Retarget stacked PRs to `main` and check the work landed (row 7) | ✅ | _ |

### 2. Numbers looked at

- PRs since the review rule: 76 of 76 reviewed. Iteration 13: 40 PRs, 3
  linked to an issue.
- Issues: 207, all under a deliverable milestone, all with acceptance
  criteria, 106 with a design link.
- Client comments: 14 of 16 delivered. UAT: _ (see [uat-log.md](../feedback/uat-log.md)).

### 3. What went well

| Item | Votes |
| --- | --- |
| *Proposed:* The review rule worked straight away: every PR since 3 Nov has a teammate's review | _ |
| *Proposed:* One issue per client comment made it easy to plan and to show progress (14 of 16 delivered) | _ |
| *Proposed:* Docs next to the code: the role removal on 22 Nov updated code, tests and design docs in the same PRs | _ |
| _ | _ |

### 4. What to improve

| Item | Votes |
| --- | --- |
| *Proposed:* **PRs stopped naming their issue.** Linking fell from 27 of 38 PRs in iteration 9 to 3 of 40 in iteration 13; most of iteration 13 was security-course work with no issue of its own | _ |
| *Proposed:* **The board went stale.** Iteration backlogs after iteration 7 had to be rebuilt from merged PRs | _ |
| *Proposed:* **Feedback came late and from one source.** Only the client review until the UAT; no user test before the last week | _ |
| *Proposed:* **Work arrived in bursts.** Iterations 7, 8 and 10 merged 0, 1 and 1 PRs; iterations 9 and 13 merged 38 and 40 | _ |
| _ | _ |

### 5. Actions

Agreed in the meeting. The first three were already done on 25 Nov as part
of preparing this retrospective; confirm them and add the new ones below.

| Action | Owner | Check date | How we will know it worked | Status |
| --- | --- | --- | --- | --- |
| Issue templates (task and bug) with Goal, Acceptance criteria, Deliverable and Design reference; no blank issues | @SKlv1ain | 25 Nov | New issues have every field filled in | ✅ Done 25 Nov: [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/) |
| PR template asks for the issue number, the deliverable and whether the design docs were updated; Definition of Done says the same | @SKlv1ain | 25 Nov | PRs from now on say which issue and deliverable they serve | ✅ Done 25 Nov: [`.github/pull_request_template.md`](../../.github/pull_request_template.md), [team-workflow.md](./team-workflow.md#definition-of-done) |
| Every issue gets a deliverable (milestone) | @SKlv1ain | 25 Nov | 0 issues without a milestone | ✅ Done 25 Nov: 12 milestones D1 to D12, 207 of 207 issues assigned ([milestones](https://github.com/PhomMaiWai/TorFinder/milestones)) |
| Run the user acceptance test with a script and a feedback log | _ | _ | K18 measured; at least 2 findings fixed | ⏳ Script ready: [uat-script.md](../feedback/uat-script.md), #232 |
| Write retrospective notes here at the end of each iteration, in the format above | _ | Next iteration | A dated section here for every iteration | ⏳ |
| _ | _ | _ | _ | _ |
