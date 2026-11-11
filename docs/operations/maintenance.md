# Maintenance plan

How we keep TorFinder working after it goes live. The system is not in
production yet (#235), so this is a plan: it says what to watch, how often,
and who does it, using the tools the code already has. Where a tool doesn't
exist yet, it says so.

> **Team to check:** who owns each task is a proposal. Agree on it before
> the production deploy.

## At a glance

| Task | How often | Who | Tool |
| --- | --- | --- | --- |
| Check the system is up | Continuously | Uptime checker, on-call member | `GET /health` |
| Check the imports ran | Every day | Admin on duty | Admin notifications, `/admin` pipeline card |
| Triage problem reports | Every day | Admin on duty | `/admin/reports` |
| Review the audit log | Every week | One member | `/admin/audit` |
| Back up the database | Every day, kept 14 days | Automated | `mongodump` |
| Update dependencies | Every week, sooner for security fixes | Rotating | `npm audit`, `npm outdated` |
| Check the docs still match | Every PR | PR author | [developer-guide.md](../process/developer-guide.md#documentation) |

## 1. Monitoring

### Is it up?

`GET /health` on the backend answers `{"ok":true}` when the process is
running. It does not check MongoDB, so a database outage shows up as errors
on real pages instead. Point an uptime checker at both:

- the backend's `/health` (port 4000, not public), and
- the frontend's home page `/` (it fetches from the backend, so it fails if
  either service or the database is down).

Check every 5 minutes. The SRS target is 99% availability during the
evaluation period ([kpi.md](../requirements/kpi.md), K12).

### Did the imports run?

The importers run on a schedule inside the backend (see
[pipeline.md](./pipeline.md)): e-GP and MEA every 6 hours, data.go.th every
day, AI extraction every hour. Three things tell you when one goes wrong:

1. **Admin notifications.** When a run fails, or some feeds don't answer,
   every active admin gets one unread notification for that source
   (`AdminAlertsService`). It doesn't repeat while the first is unread, so
   an unread alert means "still broken or not yet looked at".
2. **The pipeline card on `/admin`**, backed by `GET /api/egp/metrics`:
   e-GP sync counts and the success and failure history.
3. **`syncRuns` in MongoDB**, one row per e-GP run, with its outcome and
   error. The other importers record only the admin alert and the log.

When a source is down, do nothing at first: the next run retries, and
records already imported stay. If it stays down for more than a day, check
whether the portal changed its page or API. MEA is scraped from HTML, so a
redesign of its site will break it; `mea-client` tests show what the parser
expects.

Also look at `GET /api/egp/near-misses` once a week: titles the software
filter turned down that still look like IT work. A real software TOR there
means the keyword list in the filter needs a new word.

### Logs

Both services log to standard output (NestJS `Logger` in the backend). Keep
what the host collects for at least 14 days. Nothing ships logs elsewhere
yet.

## 2. Backups

There is no backup job in the repository yet. Before the deploy, add one:

```bash
# daily, from a machine that can reach the database
mongodump --uri "$MONGODB_URI" --gzip --archive=torfinder-$(date +%F).archive.gz
```

- Keep 14 daily copies, and store them somewhere other than the database
  host.
- The collections that cannot be rebuilt are `users`, `feedback`,
  `torReports`, `savedTors`, `savedSearches`, `notifications`,
  `auditLogEntries` and the admin corrections on `tors` (`lockedFields`).
  TORs themselves can be re-imported from the sources, but admin edits
  would be lost.
- Test a restore once a month into a throwaway database:
  `mongorestore --gzip --archive=... --nsFrom 'torfinder.*' --nsTo 'restore_test.*'`.
- In Docker Compose, the data lives in the `torr_db_data` volume.
  `docker compose down -v` deletes it.

## 3. Dependency and security updates

The time limits come from the security self-audit
([asvs-l1.md](../security/asvs-l1.md), ASVS 15.1.1):

| Severity | Fix within |
| --- | --- |
| Critical or high | 7 days |
| Medium | 30 days |
| Low | 90 days, in a normal iteration |

The audit says `npm audit` runs in CI, but it does not yet: the workflow has
no audit step and Dependabot is not set up. Until one of them is, run this
every week in both `backend/` and `frontend/`:

```bash
npm audit --omit=dev
npm outdated
```

Update in a `chore(deps): ...` pull request so CI runs the backend tests
against the new versions. Upgrade major versions of Next.js, NestJS and the
MongoDB driver one at a time, in their own PR.

Also on the list:

- **Node.js and MongoDB.** Stay on a supported LTS line (Node 22 or newer,
  MongoDB 7). The Dockerfiles pin the base images.
- **Secrets.** Rotate `SESSION_SECRET` if it may have leaked. Change it in
  both services at the same moment: every session ends and everyone signs
  in again (see [deployment-checklist.md](./deployment-checklist.md)). To
  sign out one user only, suspend and restore them, which revokes their
  existing sessions.
- **Rate limits.** The limits are kept in memory per process. If the backend
  ever runs as more than one instance, they no longer add up and need a
  shared store.

## 4. Bug reports and support

Problems reach us two ways:

1. **From users, in the app.** "Report a problem" on a TOR page creates a
   record in `torReports`. Admins see them at `/admin/reports`, and can fix
   the TOR from the report ("Fix this TOR"); the fix locks the edited fields
   so the next import doesn't overwrite them, and is written to the audit
   log.
2. **From the team or the client.** A GitHub issue with the `bug` label,
   what happened, what was expected and how to repeat it.

| Priority | Example | Response |
| --- | --- | --- |
| P1 | Site down, sign-in broken for everyone, data leak | Same day; hotfix branch `fix/...` straight to a PR |
| P2 | A feature broken for one role, an importer down more than a day | Within 3 days |
| P3 | Wrong data on one TOR, cosmetic issues | Next iteration, or fix the record from `/admin/reports` |

Every bug fix comes with a test that fails without it, where the code can be
tested (see [testing.md](../process/testing.md)).

## 5. Keeping the data in scope

- Each sync removes records that no longer pass the scope rules (Bangkok
  agencies, `TOR_LISTED_SINCE`, software only).
- After changing those rules, run the one-time sweep for older records,
  counting first:

  ```bash
  npm run build --prefix backend
  npm run scope-cleanup --prefix backend            # count only
  npm run scope-cleanup --prefix backend -- --apply # remove
  ```

- Refresh the Docker Compose snapshot (`docker/mongo-seed/`) once a
  semester, so a fresh checkout still shows recent TORs. `restore.sh` has
  the `mongodump` command.

## 6. Keeping the docs current

The docs are only useful while they match the code. The rule is in the
[developer guide](../process/developer-guide.md#documentation): a PR that
changes a route, a collection, a role, an importer or an environment
variable updates the matching page in the same PR. Once a month, someone
reads [api.md](../design/api.md) against the controllers and
[roles-and-features.md](../project/roles-and-features.md) against the board.
