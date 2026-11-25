# UAT log

Results of the user acceptance test (#232), run with the task script in
[uat-script.md](./uat-script.md). This is the second round of user
feedback, after the client's in-class review
([in-class-comments-review.md](./in-class-comments-review.md)).

> **Status: not run yet.** The script and this log were prepared on 25 Nov
> 2026. Everything below the line is left blank for the facilitator. Do not
> fill it in from memory or estimates: only what was observed in a session.

## Summary

| | Target (K18) | Result |
| --- | --- | --- |
| Task attempts passed without help | 90% | _ of _ (_%) |
| Average satisfaction | 4 or more out of 5 | _ |
| Findings | — | _ total: _ fix now, _ backlog, _ won't fix |
| Findings fixed and merged | 2 or more | _ |

**In one sentence:** _what the session showed._

---

## Sessions

| Participant | Profile (one line, no names) | Date | Facilitator | Note-taker | Length |
| --- | --- | --- | --- | --- | --- |
| P1 | | | | | |
| P2 | | | | | |
| P3 | | | | | |
| P4 | | | | | |
| P5 | | | | | |

Setup: `main` at commit `_______`, `docker compose up` with demo data,
browser _______.

## Results per task

✅ Pass (no help) · 🟡 Assisted (after a hint) · ❌ Fail · — not attempted.
Add the time in minutes where you took it, for example `✅ 2:10`.

| Task | P1 | P2 | P3 | P4 | P5 | Passed |
| --- | --- | --- | --- | --- | --- | --- |
| T1 Find an open TOR closing within 30 days | | | | | | _ / _ |
| T2 Stage and original document | | | | | | _ / _ |
| T3 Register a company | | | | | | _ / _ |
| T4 Dashboard and profile progress | | | | | | _ / _ |
| T5 Best match and its score | | | | | | _ / _ |
| T6 Save a TOR and a search | | | | | | _ / _ |
| T7 Find similar | | | | | | _ / _ |
| T8 Market insights | | | | | | _ / _ |
| T9 Certificate and coverage | | | | | | _ / _ |
| T10 Report a problem | | | | | | _ / _ |
| T11 Match notification | | | | | | _ / _ |
| T12 Admin fixes the report (optional) | | | | | | _ / _ |
| **All attempts** | | | | | | **_ / _ (_%)** |

## Satisfaction and answers

| Participant | Satisfaction (1–5) | Most confusing moment | Would use it weekly if… | Missing before bidding |
| --- | --- | --- | --- | --- |
| P1 | | | | |
| P2 | | | | |
| P3 | | | | |
| P4 | | | | |
| P5 | | | | |

## Findings

One row per problem. If several participants hit the same problem, it is one
row: list them all under "Seen by". Quote what they said where you can.

**Severity:** **High** = blocks the task · **Medium** = slows them down or
needs a hint · **Low** = cosmetic or a suggestion.

| ID | Task | What happened | Quote | Seen by | Severity | Decision | Issue | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | | | | | | | # | # |
| F2 | | | | | | | # | # |
| F3 | | | | | | | # | # |

**Decision:** **fix now** (before the release) · **backlog** (issue under
milestone D7, fixed later) · **won't fix** (say why).

## What we changed because of the UAT

For the slides: each change with its before and after.

| Finding | Change | PR (date) | Before | After |
| --- | --- | --- | --- | --- |
| F_ | | # | | |
| F_ | | # | | |

## Follow-up

- Update K18 in [kpi.md](../requirements/kpi.md) with the result above.
- Update the D7 status in [deliverables.md](../project/deliverables.md).
- Close #232 when the log is filled in and two fixes are merged; then #394.
