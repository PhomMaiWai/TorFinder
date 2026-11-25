# Retrospectives

How the team changed the way it works, iteration by iteration. Each row is
a problem we saw, what we changed, and what happened afterwards, with the
evidence in this repository.

**About the sources.** No written retrospective notes were kept in the
repository during the project. Rows 1 to 7 below are therefore
**reconstructed from the repository**: each problem and each change is
visible in the git history, the pull requests or the GitHub settings, and
the dates come from there. The last section is a **draft for the final
retrospective**, built from the same numbers, for the team to confirm,
change and add to.

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

## Final retrospective (25 Nov 2026): draft for the team

### What went well

- The review rule worked straight away: every PR since 3 Nov has a
  teammate's review.
- Splitting the client feedback into one issue per comment made it easy to
  plan and to show progress: 14 of 16 comments delivered.
- Keeping the docs next to the code meant the role removal on 22 Nov
  updated the code, tests and design docs in the same PRs.

### What to improve

- **PRs stopped naming their issue.** Linking fell from 27 of 38 PRs in
  iteration 9 to 3 of 40 in iteration 13. Most of iteration 13 was
  security-course work that had no issue of its own.
- **Issues are thin.** About 89 of 197 issues have a one-line body, and few
  link to a design document.
- **The board went stale.** Iteration backlogs after iteration 7 had to be
  rebuilt from merged PRs.
- **No user test yet.** All feedback so far came from the client review.

### Actions

| Action | Proposed owner | Done in |
| --- | --- | --- |
| Issue templates (task and bug) with Goal, Acceptance criteria, Deliverable and Design reference; no blank issues | @SKlv1ain | ✅ Done 25 Nov: [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/) |
| PR template asks for the issue number, the deliverable and whether the design docs were updated; Definition of Done says the same | @SKlv1ain | ✅ Done 25 Nov: [`.github/pull_request_template.md`](../../.github/pull_request_template.md), [team-workflow.md](./team-workflow.md#definition-of-done) |
| Every open issue gets a deliverable (milestone) | @SKlv1ain | This submission: milestones on GitHub |
| Run the user acceptance test with a script and a feedback log | Whole team | #232 |
| Write retrospective notes in this file at the end of each iteration, not only in chat | Whole team | From the next iteration |
