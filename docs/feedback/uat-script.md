# UAT script

The task script for TorFinder's user acceptance test (#232). Each
participant gets the same tasks; the facilitator records the result of each
one in [uat-log.md](./uat-log.md).

**What we want to learn:** can a software company that has never seen
TorFinder find a TOR worth bidding on, understand it, and use the features
the client asked for in the October review, without help?

**Pass mark (KPI K18):** 90% of task attempts completed without help, and
an average satisfaction of 4 or more out of 5. See
[kpi.md](../requirements/kpi.md).

## Before the session (facilitator)

1. Start a fresh copy: `docker compose up -d --build` with
   `SEED_DEMO_DATA=true` in `.env` (see the [README](../../README.md#demo-accounts)).
2. Wait about 3 minutes after the first start, so the importers add TORs
   that are still open (the bundled snapshot's deadlines have passed). Open
   `http://localhost:3000` in a private browser window and check that the
   search shows open TORs.
3. Sign in once as `contact@arundigital.co.th` and check that
   `/dashboard`, `/matches` and `/notifications` show data. Sign out.
4. Have [uat-log.md](./uat-log.md) open to fill in, and a timer.
5. Use a new private window for each participant.

## Participants

- 3 to 5 people who are **not** on the team. Best: someone who has prepared
  or reviewed a government bid. Acceptable: classmates from other teams,
  playing a sales or project manager at a small software company.
- Record them only as P1, P2, … with a one-line profile (for example
  "PM at a software house, has bid on e-GP"). No names, emails or
  recordings without their OK.

## What to say at the start (read out)

> Thank you for helping. We are testing the website, not you, so there are
> no wrong answers. Please think aloud: say what you are looking for and
> what you expect to happen. I can't help you during a task, but you can
> say "I would give up here" at any time. It takes about 30 minutes.
>
> Imagine you work at a small Bangkok software company. Your job is to find
> government (BMA) software projects that your company could bid on.

## Tasks

Read each task aloud; don't point at the screen. Stop a task after 4
minutes or when the participant gives up.

**Scoring:** ✅ **Pass** = done without help · 🟡 **Assisted** = done after a
hint · ❌ **Fail** = gave up, ran out of time or got a wrong answer. Only
✅ counts toward K18.

| # | Task (read aloud) | Signed in as | Done when the participant… | Checks | Client comment |
| --- | --- | --- | --- | --- | --- |
| T1 | "Find a software project from a BMA agency that is still open and closes within the next 30 days." | Guest | Opens a TOR that is open and closes in ≤ 30 days | FR-09, FR-10 | 1.1 sorting |
| T2 | "For that project, tell me which step of the procurement process it is at, and open the original announcement document." | Guest | Names the stage and opens the original document | FR-11, FR-17 | 1.5 stage indicator |
| T3 | "Register your company. Use the email `uat-p<N>@example.com`." Then: "What happens next?" | Guest | Reaches the pending page and says an admin must approve | FR-01 | — |
| T4 | Facilitator signs them in as `contact@arundigital.co.th`. "This is your company's account. How complete is your company profile, and what should you add next?" | Company | Lands on the dashboard; names the completion and one suggested item | FR-12 | 1.2 dashboard after login, 1.4 profile progress |
| T5 | "Which open projects match your company best? How good is the best match?" | Company | Opens the matched TORs and reads a score | FR-13 | — |
| T6 | "Keep that project for later. Then save a search for projects closing within 30 days, so you can run it again tomorrow." | Company | A saved TOR and a saved search both appear on the Saved page | FR-15, FR-16 | — |
| T7 | "Last year you built an e-learning system for a university. Find similar projects." | Company | Uses Find similar and gets a ranked list | — | 2.2 smart search |
| T8 | "Before bidding, you want to know your competition. Which company has won the most projects at one agency, and how close to the reference price do winners bid?" | Company | Answers both from the insights page | — | 2.3 insights, 2.4 charts |
| T9 | "Add your ISO 27001 certificate: issued by BSI, valid until the end of 2027. Then check how many of a TOR's requirements your documents already cover." | Company | Certificate saved with issuer and date; reads the coverage on a TOR | — | 3.1 proposal library, 3.2 certificates |
| T10 | "You notice a TOR has the wrong budget. Tell the site." | Company | Report sent from the TOR page | FR-21 | — |
| T11 | "Where would you see a new matching project as soon as it is announced? Find the most recent one." | Company | Opens notifications and a match alert; may mention LINE | FR-14 | 2.1 early alerts, 2.6 LINE |
| T12 | *(Optional, one participant only.)* Facilitator signs in as `admin@bma.go.th`. "A company reported a wrong budget. Find the report and fix the TOR." | Admin | Opens the report, edits the TOR and marks the report done | FR-22, FR-25 | — |

## After the tasks (ask, and note the answers in the log)

1. "Overall, how satisfied are you with TorFinder, from 1 (not at all) to
   5 (very)?"
2. "What was the most confusing moment?"
3. "What would make you use this every week instead of e-GP?"
4. "Is anything missing that you would need before bidding?"

## After the session (team)

1. Fill in the results matrix and the findings in [uat-log.md](./uat-log.md)
   the same day.
2. Every finding gets a decision: **fix now**, **backlog** or **won't
   fix** (with the reason).
3. Each "fix now" or "backlog" finding becomes an issue from the bug or task
   template, under milestone **D7 User feedback record**, and is linked from
   the log.
4. Fix at least two findings in small PRs, and link each PR from the log.
5. Update K18 in [kpi.md](../requirements/kpi.md) and the summary at the
   top of the log.
