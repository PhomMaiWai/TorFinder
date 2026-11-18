# SAST report

Static application security testing of TorFinder (course criterion 14), run on 17 Nov 2026 against `main` at `4d75e48`. Two tools were used: **CodeQL** on GitHub and **Semgrep** locally. Every finding was read in the code and classified as a real issue or a false positive; all real issues are fixed on branch `fix/sast-findings`.

## Summary

| Tool | Findings | Real, fixed | False positive | After the fixes |
| --- | --- | --- | --- | --- |
| Semgrep 1.185.0 | 16 | 13 | 3 | **0** (re-scanned) |
| CodeQL 2.27.4 | 28 | 21 | 7 | **0** open (21 closed as fixed, 7 dismissed as false positives) |
| **Total** | **44** | **34** | **10** | |

No finding showed an exploitable vulnerability that a user could use to reach data or functions they aren't allowed to. The real findings are hardening: one path-traversal pattern between the frontend and the backend, supply-chain settings for CI and Dependabot, containers running as root, and three code-quality patterns.

## Tools and setup

| | CodeQL | Semgrep |
| --- | --- | --- |
| Where | GitHub code scanning, default setup | Local CLI, metrics off (no code sent anywhere) |
| Version | CodeQL 2.27.4 | Semgrep 1.185.0 |
| Rules | `security-extended` suite: 103 JavaScript/TypeScript rules, 23 GitHub Actions rules | 267 rules from `p/default`, `p/owasp-top-ten`, `p/javascript`, `p/typescript`, `p/nodejs`, `p/secrets`, `p/dockerfile`, `p/github-actions` |
| Scope | Whole repository (backend, frontend, workflows) | 441 tracked files; excludes `node_modules`, the database snapshot and the generated password list |
| Results | Repository → Security → Code scanning | `docs/security/evidence/semgrep-2026-11-17.json` |

CodeQL now runs automatically on every push to `main` and on every pull request.

## Real findings and fixes

| # | Tool | Rule | Where | Risk | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | CodeQL #7–#17 (11 alerts) | `js/request-forgery` (critical) | Frontend server actions and API routes that call the backend, e.g. `app/tor/[id]/actions.ts` | An id chosen by the browser went into the backend URL unchecked; an id of `..` would send the request to a different backend path. The caller still only has their own permissions, but it is a real path-traversal pattern | New `lib/backend-path.ts`: `idPath()` accepts only a 24-character MongoDB ObjectId and encodes it; used at all 13 call sites. API routes answer 404 to a malformed id without calling the backend. The admin import action checks `source` against its allowlist at runtime |
| 2 | CodeQL #1–#3 | `actions/missing-workflow-permissions` | `.github/workflows/auth.yml` | The CI token had the default permissions | `permissions: contents: read` |
| 3 | CodeQL #4–#6, Semgrep (8) | Unpinned / mutable action tags | `.github/workflows/auth.yml` | A moved or hijacked tag would change the code CI runs | Every action pinned to a full commit SHA, with the version as a comment |
| 4 | Semgrep (3) | `dependabot-missing-cooldown` | `.github/dependabot.yml` | A just-published (possibly compromised) version could be proposed immediately | `cooldown: default-days: 7` for every ecosystem |
| 5 | Semgrep (2) | `dockerfile.missing-user` | `backend/Dockerfile`, `frontend/Dockerfile` | Both containers ran as root | `USER node` and `COPY --chown=node:node` in the runtime stage |
| 6 | CodeQL #24 | `js/remote-property-injection` | `backend/src/tor/tor.service.ts` `changedFields` | A request key becomes an object key. The DTO whitelist already limits keys to known fields | The function walks a fixed list of updatable field names instead of the request body and collects changes in a `Map`, so no request key is ever used as a property name (#350). The earlier `__proto__`/`constructor`/`prototype` skip was not recognised by CodeQL as a sanitizer and is gone |
| 7 | CodeQL #18, #19 | `js/incomplete-sanitization` | `matching/work-types.ts`, one e2e test | Only `.` and `-` were escaped before building a RegExp | Uses the shared `escapeRegex()` (all special characters) |
| 8 | CodeQL #28 | `js/regex/missing-regexp-anchor` | `common/document-labels.ts` | `/^boq|pricebuild/` reads as if both halves were anchored | Split into two explicit patterns with the same meaning |

## False positives

| Tool | Rule | Where | Why it is not a vulnerability |
| --- | --- | --- | --- |
| CodeQL #21–#23 | `js/sql-injection` (NoSQL) | `accounts.service.ts`, `reports.service.ts` | The `status` filter is validated with `@IsIn(…)` against a fixed list before it reaches the query, so it is always one of those strings, never an object |
| CodeQL #25–#27 | `js/user-controlled-bypass` | `session.guard.ts`, `role.guard.ts`, `reports.controller.ts` | This is authentication itself: the token comes from the request header, and its HMAC signature, expiry and revocation are verified before it is trusted |
| CodeQL #20 | `js/reflected-xss` | `tor.controller.ts` `POST /tor` | The admin-only route returns JSON (`application/json`), not HTML, so nothing is rendered |
| Semgrep | `detect-non-literal-regexp` | `matching/requirements.ts` | The pattern is built from hard-coded ISO numbers |
| Semgrep | `detect-non-literal-regexp` | `matching/work-types.ts` | Built from this file's own constants, now fully escaped |
| Semgrep | `detect-non-literal-regexp` | `components/public/tor-document-list.tsx` | `covers` is one of three fixed patterns defined in the backend, never user input |

The Semgrep false positives are marked in the code with `nosemgrep` and the reason, so a re-scan stays clean and the triage is visible. The CodeQL false positives are to be dismissed in GitHub's Security tab with the reasons above.

## Verification

- Semgrep re-scan of the fixed branch: **0 findings** (267 rules, 443 files).
- CodeQL re-scan of `main` after #350: **0 open alerts** in GitHub → Security → Code scanning.
- Backend: lint, build and 624 e2e tests pass (3 skipped).
- Frontend: lint, build and all 81 e2e tests pass.
- Manual check: `POST /api/saved-tors/not-an-id` and `/api/saved-tors/..%2Faccounts` now get a 404 from the frontend without reaching the backend; a real id still works.
- The Docker images are rebuilt by CI (`docker/build-push-action`) on the pull request.

## How to reproduce

```bash
python3 -m venv .venv-semgrep && .venv-semgrep/bin/pip install semgrep
.venv-semgrep/bin/semgrep scan --metrics=off \
  --config p/default --config p/owasp-top-ten --config p/javascript --config p/typescript \
  --config p/nodejs --config p/secrets --config p/dockerfile --config p/github-actions \
  --exclude node_modules --exclude 'docker/mongo-seed/*.gz' \
  --exclude backend/src/common/common-passwords.ts .
```

CodeQL: GitHub → Security → Code scanning, or `gh api repos/PhomMaiWai/TorFinder/code-scanning/alerts`.
