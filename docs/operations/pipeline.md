# The import & AI pipeline — reference

The precise version: every scheduled job, its config, and its exact
behavior, cited against the source. For a plainer walkthrough of why this
exists and how to work with it day to day, see
[pipeline-guide.md](./pipeline-guide.md). Where this file and the code
disagree, trust the code it cites, then fix this file.

## The five jobs

Four independent scheduled jobs write into one shared `tors` collection.
(A fifth, data.go.th, was removed on 26 Nov 2026: กรมบัญชีกลาง's monthly
procurement reports there stop at FY 2562 / 2019 and have not been updated
since October 2021, so every row fell before the 2022 cutoff and the source
never contributed a record.)
None of them call each other directly — a source writes a record, and the
AI job reads it. The import doesn't wait for that: when an import creates new
records, it hands their ids to the AI job and returns, and the AI job reads
them straight away (see "Reading right after import" below). Everything else
still unread is picked up by the AI job's own timer.

| Job | What it imports | Default interval | Polls on boot? | Manual trigger (admin-only unless noted) |
| --- | --- | --- | --- | --- |
| `egp` | Bangkok's own e-GP API | 360 min (`EGP_POLL_MINUTES`) | Yes | `POST /api/egp/sync` |
| `mea` | Metropolitan Electricity Authority's procurement site | 360 min (`MEA_POLL_MINUTES`) | Yes | `POST /api/mea/sync` |
| `gproc` | The national e-GP (กรมบัญชีกลาง / process5), for open projects' procurement step | 180 min (`GPROC_POLL_MINUTES`) | Yes | `POST /api/gproc/capture` — different shape, see below |
| AI extraction | Reads the PDF behind each imported record | Right after each import that creates records (`AI_EXTRACT_AFTER_IMPORT`), plus every 60 min (`AI_POLL_MINUTES`) for the rest of the queue | **No** by default | `POST /api/ai/extract`; backlog: `npm run ai-backfill` |

(`backend/src/config/env.ts` is the source for every default above.)

The AI job is the one exception to "polls on boot": every other job falls
back to `true` if its `*_POLL_ON_STARTUP` var is unset; AI extraction falls
back to `false`, deliberately — a restart-happy dev machine shouldn't pay
for a model call every time it comes back up.

## What state a TOR record carries

There's no CLI here and no `pipelineStatus` enum — every trigger is an
authenticated HTTP endpoint (scheduled or admin-called), and a record's
position in the pipeline is read off a handful of fields on the `TorDoc`
itself (`backend/src/database/database.service.ts`), not a single status
column:

| Field | Absent / unset means | Set means |
| --- | --- | --- |
| `sourceRef` | Admin-entered — `sourceOf()` falls back to `"manual"` | Which import wrote it, prefixed (`egp:69089649017:D0`) |
| `deletedAt` | Live, listed | Soft-hidden — never a real delete, since these are public notices and hiding one has to be reversible and leave a trace |
| `extraction` | Never read by AI, or excluded (see the queue filter below) | The model's own read of the document, kept separate from the agency's published fields on purpose — one is inferred, the other is what was actually published, and that distinction has to survive to the reader |
| `extraction.version` | — | Compared against current `EXTRACTION_VERSION`; older means due for a re-read |
| `extractionFailure` | Never failed, or never tried | `{reason, failedAt, attempts}` — governs the 24h cooldown and 3-attempt cutoff below |
| `classification` | Counts as `software` (the default) | `not-software` once an admin overrides a wrong auto-classification — pulled from listings/matching, not deleted |
| `lockedFields` | Nothing admin-corrected yet | Which fields an admin's manual correction protects from being overwritten by a later import — see `backend/test/tor-corrections.*.test.mjs` for the exact behavior |

There's no version history or rollback mechanism for a TOR record's own
fields — unlike the extraction confidence note below, this isn't a "not
built yet" caveat so much as: a correction overwrites in place, and the
audit log (`/admin/audit`) is the only record of what a field used to say.

## How the scheduler behaves

One abstract class, `backend/src/common/sync-scheduler.ts`, backs all five.
What it guarantees, regardless of which job:

- **Staggered start.** Each job gets its own `startupDelayMs` so five jobs
  booting together don't all hit their source in the same second — and
  because each job's own interval counts from that offset, they stay spread
  out on every later tick too.
- **No overlapping runs.** A tick that lands while the same job's previous
  run (scheduled or admin-triggered) is still going joins that in-flight
  promise instead of starting a second one. Two concurrent syncs against the
  same source can't happen.
- **Retry with backoff.** A run that throws outright is retried up to 3
  times, 5s then 10s apart. Only after all 3 fail does the scheduler give up
  for that tick and notify admins (`AdminAlertsService`) — the next
  scheduled tick is the next real attempt.
- **Partial failure is reported too.** A run can return results *and* a list
  of feeds that didn't answer (`failedFeeds`) — that also notifies admins,
  distinct from an outright failure.
- **Set `*_POLL_MINUTES=0`** to disable a job's background schedule
  entirely. The admin-triggered endpoint still works — polling and manual
  triggering are independent.

## Source-specific config

All read from `backend/src/config/env.ts`; everything else about a source
(portal URLs, keyword filters, per-request timeouts) is hardcoded in that
source's own `*.constants.ts`, not configurable via env.

| Variable | Default | Controls |
| --- | --- | --- |
| `EGP_LOOKBACK_DAYS` | 120 | How far back a sync reads, newest first |
| `EGP_MAX_PAGES` | 40 | Hard page cap per announcement type, regardless of date |
| `EGP_CONCURRENCY` | 5 | Requests in flight against the portal |
| `EGP_ENRICH_BUDGET_MS` | 45000 | Wall-clock cap on reading each record's detail page; whatever's left over is retried next run |
| `VERTEX_PROJECT_ID` | empty | Gates AI extraction entirely — empty means the job does nothing regardless of `AI_POLL_MINUTES` |
| `VERTEX_LOCATION` | `asia-southeast1` | Vertex AI region |
| `VERTEX_MODEL` | `gemini-2.5-flash` | Model used for extraction |
| `AI_EXTRACT_AFTER_IMPORT` | `true` | Read the records each import creates right after it; `false` leaves them to the hourly run |
| `VERTEX_EMBEDDING_MODEL` | `text-multilingual-embedding-002` | Model that embeds TORs for "find similar" |

`gproc`'s manual trigger doesn't match the other two's shape: it's
`POST /api/gproc/capture` with a body of specific `projectNumbers` to fetch,
returns `202 Accepted` with a `runId` immediately, and the actual result is
read back from `GET /api/gproc/capture/:runId` once it finishes — a
background job with a poll-for-result pattern, not a synchronous sync call.

## Which copy wins when sources overlap

A `sourceRef` is prefixed with where a record came from
(`egp:69089649017:D0`); a record with none was typed in by an admin.
`backend/src/tor/tor.constants.ts`'s `sourceRank` is the authority:

```
manual (4) > egp (3) > gproc (2) > mea (1)
```

An admin's own entry always wins. Bangkok's e-GP outranks the national
e-GP because it carries the actual files and signed contracts; the national
feed outranks MEA because it's the same announcement with less attached. An admin-entered
record is never auto-deleted or overwritten by any source.

Within one sync's own results, duplicates collapse first by an exact
`projectNumber + stage` match, then by a close title match within the same
stage — see `backend/src/tor/tor-dedup-index.ts` for the matching logic
itself; this file doesn't re-derive it.

## The AI extraction queue — what it actually reads next

`ExtractionService.pickPending()` (`backend/src/ai/extraction.service.ts`)
selects candidates matching **all** of:

- Listed: not soft-deleted, not classified `not-software`
- Has at least one document whose URL looks readable (or is a `gproc:`
  record at the invitation stage, fetched by project number instead)
- Never extracted, or extracted by an older `EXTRACTION_VERSION` than current
- Not mid-cooldown from a previous failure (24h cooldown, 3 attempts max —
  `AI_REQUEST.retryAfterMs` / `maxAttempts`)
- Any stage, awards included: an award's own notice names the winner and the
  price, so the national e-GP's TOR bundle is read for it by project number,
  as for a draft or invitation
- Created within the last 90 days (`ACTIONABLE_WINDOW_MS`)

Matches are then sorted **newest `createdAt` first** and capped at
`AI_REQUEST.maxCallsPerRun` (25). That's it — there is no stage-based
priority ordering in the current code (draft-before-invitation-before-award
or similar). If you need that behavior, it isn't there yet; don't assume it
is because an older doc said so.

Per-call behavior: `temperature: 0` (same PDF always yields the same
fields), up to 3 model retries, a 180s timeout per document, 3 documents
read concurrently, and a 10-minute wall-clock budget on the whole run —
whatever doesn't finish in that window stays pending for the next run.

### Reading right after import (KPI K9)

Decided for #400: option 2 of the issue, trigger after import, rather than
polling every 5 minutes or relaxing the SRS target. When
`TorImportService.import()` creates records, it calls its listeners with
the new ids after the write, the budget refresh and the match alerts, and
does not wait for them. `ExtractionScheduler` registers one listener
(only when `VERTEX_PROJECT_ID` is set and `AI_EXTRACT_AFTER_IMPORT` isn't
`false`), and it calls `ExtractionService.extractImported(ids)`:

- the same queue rules as above, limited to those ids, with the same
  25-call cap and 10-minute budget; whatever is past the cap waits for the
  hourly run
- one after-import read at a time, so three portals importing together
  don't stack runs
- a record already being read by another run (the hourly one, an admin's
  button) is skipped, so nothing is paid for twice
- an import that created nothing calls no listener, so an idle import makes
  no model call; the total number of calls doesn't change, each new record
  is read once whichever run reaches it first
- a failure inside the read is logged and recorded on the record
  (`extractionFailure`), and can't fail or slow the import

Only new records are handed over. An update of a record already stored was
either read already or is still in the queue, and the hourly run gets to it.

### Catching up a backlog (KPI K7)

The hourly run reads at most 25 records and only from the last 90 days, so
a database restored from a snapshot, or one filled while AI was off, takes
days to catch up, and older records are never read. `npm run ai-backfill`
(`backend/src/scripts/ai-backfill.ts`) works through the queue in batches
of 25 until it's empty or `--max` records have been tried:

```bash
npm run build --prefix backend
npm run ai-backfill --prefix backend                      # counts only, no model call
npm run ai-backfill --prefix backend -- --apply --max=100 # read up to 100
npm run ai-backfill --prefix backend -- --apply --max=500 --include-older --retry-failed
```

Run with no flags first: it prints why each listed record is or isn't
read (the same table as `GET /api/ai/coverage`), how many records the run
would try and a rough cost at $0.02 a record. `--include-older` drops the
90-day window for this run only, and `--retry-failed` clears earlier
failures so each gets one more try. With Docker Compose:
`docker compose exec backend node dist/scripts/ai-backfill.js`.

### Confidence is shown, not a publish gate

Every extraction gets a confidence score (`extraction-confidence.ts`):
weighted by the model's own stated confidence, how many of six expected
fields were actually found (a one-page cover notice scores low even if the
model is sure of what little it read), and whether the extracted budget/
reference-price figures agree with what the portal itself published (each
mismatch costs 25% of the score). The result — `high` / `medium` / `low` —
is attached to the record and surfaced on the TOR detail page. **Nothing in
the current code withholds a low-confidence extraction from the public
site** — it publishes with its confidence level shown, not queued behind a
review gate. If that gate gets built later, update this section.

## Safe to trigger twice

Nothing here needs a lock file or a "don't run this while that's running"
warning — re-triggering any job, by schedule or by hand, is safe by
construction, for a few independent reasons that are worth knowing
separately rather than just trusting "it's fine":

- **A second run joins the first instead of starting over.** Every
  `SyncScheduler` subclass hands every caller the same in-flight promise
  (see above) — an admin clicking "sync" while the scheduled tick is
  already running doesn't start a competing sync, it just waits on the one
  already going.
- **Re-importing something already stored doesn't duplicate it or regress
  it.** The source-rank check (above) means a worse source re-announcing
  the same project is simply skipped, not written over what a better
  source already provided.
- **A record's first-seen fields are only ever filled in once.** Any field
  an import could only guess at (a listing-page link instead of the real
  document, an agency name the enrichment step didn't resolve) is marked
  `provisional` and written **on insert only** — a later, better-informed
  run fills the gap without needing to know the original run under-filled
  it, and a worse-informed later run can't clobber a value a better run
  already wrote. See `ImportRecord.provisional` in `tor-import.service.ts`.
- **A failing record gives up, rather than burning the budget every run.**
  AI extraction stops retrying a document after 3 attempts, with a 24h
  cooldown between tries — the same document failing every hour would
  otherwise eat the entire 25-call batch forever and nothing behind it
  would ever get read.
- **Two AI runs never read the same record.** The hourly run, the
  after-import read and an admin's button can overlap; a record one of
  them is reading is skipped by the others.
- **An admin's manual correction is never silently overwritten.** Once a
  field is in a record's `lockedFields`, no re-import — same source or
  not — touches it again.

The one thing that *isn't* automatically safe: forcing a re-read by
bumping `EXTRACTION_VERSION` re-queues every previously-extracted record
at once, each one spending a real model call the next time the AI job
runs. That's a deliberate, costed decision, not an accidental side effect —
budget for it before bumping it in production.

## Manual triggers, for reference

```bash
TOKEN=<an admin session token>

curl -X POST http://localhost:4000/api/egp/sync      -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/api/mea/sync      -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/api/ai/extract    -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/api/ai/extract/<torId> -H "Authorization: Bearer $TOKEN"  # one record, now

curl -X POST http://localhost:4000/api/gproc/capture -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"projectNumbers":["68000000000"]}'
curl http://localhost:4000/api/gproc/capture/<runId>  -H "Authorization: Bearer $TOKEN"

curl http://localhost:4000/api/ai/status   # the one route above with no auth at all
```

`GET /api/ai/status` is deliberately unguarded — it reports only whether
Vertex AI is configured (a project id is set) plus the model/region in use,
spending no model call and leaking no credential, so a deployment's AI
readiness can be checked without signing in.

Every trigger above — scheduled or manual — writes an entry to the audit
log, readable at `/admin/audit` and summarized on `/admin`. `egp` also
exposes `GET /api/egp/near-misses` (titles the software filter rejected
that still read like IT work, from the latest sync) and
`GET /api/egp/metrics` (sync counts and pass/fail history), both feeding the
admin dashboard's pipeline health card.
