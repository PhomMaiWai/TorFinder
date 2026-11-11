# Working with the import pipeline

A walkthrough for anyone who needs to run, watch, or debug TorFinder's
background data pipeline without first reading five NestJS modules to find
out what's going on. The exact numbers, env vars, and endpoint signatures
live in [pipeline.md](./pipeline.md) — this file is for building the mental
model first.

## The problem it solves

A TOR (Terms of Reference) is a government procurement notice — what an
agency wants built, by when, for how much. They get published across four
different places (Bangkok's own e-GP API, the national e-GP, the Metropolitan
Electricity Authority's own site, and a monthly open-data dump), none of
which agree on format, and several of which publish the same project more
than once. Nobody wants to check four sites a day to find new software work.

So the pipeline does it instead: four independent jobs pull from those four
sources on their own schedule, write everything into one shared database,
and a fifth job reads the PDF behind each new listing with Gemini to pull
out the fields — scope, qualifications, budget, deadline — that would
otherwise mean opening the document yourself.

## The shape of it

```
 four sources, four schedules                  one shared database            the AI reads what's new
 ──────────────────────────────                ─────────────────            ────────────────────────
 egp      ──┐
 mea      ──┤
 datagov  ──┼──►  write/update TOR records ──►   MongoDB `tors`  ◄──────  extraction job picks up
 gproc    ──┘                                                              whatever it hasn't read yet
```

The four import jobs never talk to the AI job, or to each other. Each one
just writes what it found. The extraction job runs on its own clock and
asks the database "what's new and unread" every time it wakes up. If you
turn every import job off and leave the AI one running, it just does
nothing — there's nothing new to read.

## What happens to one TOR, start to finish

1. One of the four sources publishes it. Whichever job is scheduled next
   picks it up on its own sync.
2. If another source already has the same project, the two get reconciled —
   not "first one wins," but a fixed trust order (an admin's own entry beats
   everything; after that, Bangkok's e-GP beats the national e-GP beats MEA
   beats data.go.th — see `pipeline.md` for why that order). The better copy
   survives; the worse one doesn't linger as a duplicate listing.
3. It sits in the database, unread, until the AI extraction job's own
   schedule next comes around — up to an hour later by default.
4. If it's not already-awarded, not older than 90 days, and has a document
   the extraction job can actually fetch, Gemini reads it: scope,
   qualifications, deliverables, budget, deadline, payment terms.
5. The reading gets a confidence score — partly the model's own estimate,
   partly how much of the document it actually found content for, partly
   whether its budget/price numbers agree with what the source portal
   already published. This shows up on the TOR's page as a `high`/`medium`/
   `low` label. **It doesn't hide anything** — a low-confidence reading
   still goes live, just marked as one worth double-checking against the
   original PDF.
6. From here it just sits there, current, until a later sync notices the
   same project has moved to a new stage or been amended — at which point
   steps 1–5 effectively happen again for the update.

## Running it on your own machine

Nothing extra to install beyond what the root `README.md` already has you
set up (`docker compose up -d --build`, or the backend run locally against a
reachable MongoDB). The pipeline is part of the backend process itself —
there's no separate worker to start.

By default, four of the five jobs run their first sync a few seconds after
boot (`*_POLL_ON_STARTUP` defaults to `true` for `egp`/`mea`/`datagov`/
`gproc`). The AI extraction job is the one exception — it stays off at boot
unless you explicitly set `AI_POLL_ON_STARTUP=true`, because unlike the
other four, every run of it spends a real Vertex AI model call, and a dev
machine that restarts ten times a day shouldn't pay for that ten times.

If you want to see a sync happen without waiting for the schedule, every job
has an admin-only HTTP endpoint that runs it immediately — see the table in
`pipeline.md`. To call one from a terminal against your own dev server, you
need an admin session token. If you're signed in through the app already,
your browser's `torr_session` cookie *is* that token — open devtools, copy
its value. Otherwise, since the token is just an HMAC signature over a JSON
payload (`backend/src/common/token.ts`), you can mint your own for local
testing in a one-off Node script using the same `SESSION_SECRET` your dev
backend is running with — the backend test suite does exactly this (see
`backend/test/*.e2e.test.mjs`'s `makeToken` helper) for a pattern to copy.

## Reading what happened

Every sync — scheduled or manual — writes an audit-log entry, visible at
`/admin/audit` and summarized on `/admin`. That's the first place to look,
before digging into server logs: it tells you who (or what) ran a sync, when,
and the one-line result (`imported`, `updated`, `skipped`, `superseded`
counts).

Beyond the audit log:

- `GET /api/egp/metrics` — sync counts and pass/fail history, feeds the
  admin dashboard's pipeline health card.
- `GET /api/egp/near-misses` — titles the software filter *rejected* on the
  latest sync that still read like IT work. This is where a wrongly-excluded
  tender would show up; worth checking if a project you expected to see
  never appeared.
- `GET /api/ai/status` — no login needed, just says whether Vertex AI is
  configured at all (a project id is set) and which model/region. Good for
  confirming a deployment's AI setup didn't silently come up disabled.

## What's normal, and what to actually worry about

| You see | What it means |
| --- | --- |
| A sync's `skipped` count is high | Those projects already exist from a source this one doesn't outrank — not an error, just the trust order doing its job |
| `superseded` shows up | This sync's copy replaced a worse one already stored (e.g. e-GP's version replacing data.go.th's) |
| A scheduled run retried once or twice before succeeding | Normal — the scheduler retries a thrown error up to 3 times, 5s then 10s apart, before giving up and alerting admins |
| An admin alert about a "partial" sync | Some feeds answered and some didn't — results from the ones that worked were still saved |
| `near-misses` isn't empty | The software/IT keyword filter rejected something that might not have deserved it — check it, don't assume it's always wrong |
| An extraction stays pending for a long time | Either the AI job's interval hasn't come around yet (up to 60 min by default), or the record doesn't qualify for the queue at all — check `pipeline.md`'s filter list: award-stage, older than 90 days, and already-failed-3-times records are all permanently skipped, not just delayed |
| A record shows `low` confidence | Expected and not an error — the pipeline publishes it anyway, with the label as a hint to verify it against the source PDF |
| Two admins trigger the same sync at once | The second one joins the first's in-flight run rather than starting a duplicate — you won't get two overlapping syncs against the same source |

## Things worth knowing before you change this

- **The AI extraction schedule and the import schedules are independent on
  purpose.** Speeding up imports doesn't speed up extraction, and vice
  versa — they're different jobs on different clocks reading from the same
  table.
- **`EXTRACTION_VERSION` exists so you can force a re-read.** Bump it when
  the extraction prompt or schema changes, and every previously-extracted
  record becomes eligible for the queue again, once, instead of being
  trusted forever on an outdated read.
- **There's no stage-priority in the AI queue today**, despite what the
  older Thai-language `backend/docs/sync-and-poll.md` says. It's strictly
  newest-first among what qualifies. If you're relying on "drafts get read
  before awards," verify that against `pickPending()` yourself before
  depending on it — see `pipeline.md`'s correction.
- **Confidence is informational, not a gate.** If the product ever needs
  "don't show the public a `low`-confidence reading until someone checks
  it," that's new work, not a flag to flip — nothing currently withholds
  anything based on this score.
