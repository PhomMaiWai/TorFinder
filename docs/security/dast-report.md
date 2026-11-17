# DAST report

Dynamic application security testing of TorFinder (course criterion 15), run on 17 Nov 2026 with **OWASP ZAP 2.16.1** against a local copy of `main` at `d1497b9`, built and started in production mode. ZAP attacked the running app over HTTP at `http://localhost:3000` only. Every alert was read against the code and classified as real, false positive or accepted risk; the one real finding is fixed in this pull request.

## Summary

| Scan | Signed in | URLs found | Requests | High | Medium | Low | Info |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline (passive), before the fix | No | 107 | spider only | 0 | 5 | 1 | 4 |
| Full: spider + active scan | Yes, demo company account | 95 | 5,573 | 1 | 1 | 1 | 4 |
| Baseline (passive), after the fix | No | 89 | spider only | 0 | 2 | 1 | 4 |

Counts are alert types, as ZAP groups them; each type can cover many URLs.

- **The active scan found no injection, XSS, path traversal, SQL/NoSQL injection or other attack that worked.** Its only alert is the informational *User Agent Fuzzer*.
- **1 real finding, fixed**: pages the proxy doesn't handle (file-like paths such as `/robots.txt`) were answered with the HTML 404 page carrying only `frame-ancestors` as CSP. Three of the five Medium alert types came from this and are gone after the fix.
- **No High or Medium alert is left without a fix or a written reason.** The High *PII Disclosure* is a false positive (a public e-GP number that happens to pass the credit-card checksum), *style-src 'unsafe-inline'* is an accepted risk, and *Absence of Anti-CSRF Tokens* is a false positive checked by hand.

## Tools and setup

| | |
| --- | --- |
| Tool | OWASP ZAP 2.16.1 (Linux package, headless daemon), driven through the ZAP API with the `zaproxy` Python client: [`evidence/zap-scan.py`](./evidence/zap-scan.py) |
| Target | `http://localhost:3000` (Next.js frontend). Browsers only talk to the frontend, which calls the NestJS backend on `:4000` server-side |
| Build | `main` at `d1497b9`, the same commands as the Docker images: backend `npm run build` + `node dist/main.js` with `NODE_ENV=production`; frontend `next build` + `next start` with `NODE_ENV=production` |
| Data | Throwaway local MongoDB 7 loaded with the repo snapshot `docker/mongo-seed/tors.archive.gz` (683 TOR records) and the demo accounts (`SEED_DEMO_DATA=true`). A fresh random `SESSION_SECRET` |
| Signed-in scan | Demo company account `contact@arundigital.co.th`; its session cookie was added to every request with a ZAP *Replacer* rule, and the rule was removed before the reports were written |
| Active scan policy | ZAP default policy, all rules, 2 threads per host |
| Date | 17 Nov 2026 |

### Scope

In scope: everything under `http://localhost:3000`, seeded with `/`, `/dashboard`, `/search`, `/insights`, `/tor/<id>`, `/login`, `/signup`, `/forgot-password`, and, signed in, `/matches`, `/profile`, `/library`, `/saved`, `/notifications`.

Out of scope (excluded in the ZAP context, spider and active scan):

| Excluded | Why |
| --- | --- |
| Any host other than `localhost:3000`, `accounts.google.com`, `*.go.th` | Never scan third-party sites |
| `/api/tor/<id>/documents…`, `/api/tor/<id>/egp-documents…`, `/api/gproc…` | The backend fetches these files from the agencies' and e-GP's own servers, so attacking them would send traffic to `*.go.th` |
| `/api/ai/…` | Calls Vertex AI (off locally anyway) |
| `/api/auth/logout`, `/api/auth/google…` | Logging out would end the signed-in scan; Google sign-in leaves the site |

Admin pages (`/admin`) were not in the signed-in scan: it ran as a company account, which the proxy redirects away from `/admin`.

### Rate limiting during the scan

The backend's per-IP limit (100 requests a minute, `THROTTLE_LIMIT`) stayed on, as asked. Because every request came from one IP, the backend logged **2,334 `rate.limited` events** during the active scan: many attack requests got a page built from a 429 answer instead of real data. This is the limit working, but it also means the pages that read from the backend were tested less deeply than the static ones. A deeper run would raise `THROTTLE_LIMIT` on the local copy only.

## Findings

| # | Alert | Risk (confidence) | Where | Decision | Fix or reason |
| --- | --- | --- | --- | --- | --- |
| 1 | CSP: Failure to Define Directive with No Fallback · CSP: Wildcard Directive · CSP: script-src unsafe-inline | Medium (High) | `/robots.txt`, `/sitemap.xml` (any missing file-like path) | **Real, fixed** | The proxy that sets the strict nonce CSP skips paths that look like files (`.txt`, `.xml`, `.png`…), so a missing one got the HTML 404 page with only `Content-Security-Policy: frame-ancestors 'self'` from `next.config.ts`. The page reflects no input, so it was not exploitable, but it was a page without a script policy. Fix: `next.config.ts` now sends a strict fallback policy (`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` …) on every response; the proxy's nonce policy still replaces it on every page and API route it handles (checked: one CSP header per response) |
| 2 | CSP: style-src unsafe-inline | Medium (High) | Every page | **Accepted risk** | `style-src 'unsafe-inline'` is needed for React `style={…}` attributes (44 in the frontend) and Google's sign-in button. Scripts are nonce-only with `'strict-dynamic'`, so injected CSS can't run code; the remaining risk is CSS-based tricks on a page that already reflects attacker input, and the scans found no such reflection. Documented in `frontend/src/proxy.ts` (ASVS 3.4.3) |
| 3 | Absence of Anti-CSRF Tokens | Medium (Low) | `/signup/organization` | **False positive** | The form posts to a Next.js server action. Next.js refuses a server action whose `Origin` doesn't match the host; checked by hand: the same action POSTed with `Origin: http://evil.example` is refused with *"Invalid Server Actions request"*, with `Origin: http://localhost:3000` it runs. The session cookie is also `SameSite=Lax`. ZAP only looks for a token field by name |
| 4 | PII Disclosure | High (High) | `/saved`, `/saved?scope=org` (signed in) | **False positive** | The "credit card number" is a 12-digit e-GP contract number (e.g. `670924005887`) on a saved TOR that happens to pass the Luhn checksum. It is public procurement data; TorFinder stores no card numbers |
| 5 | Timestamp Disclosure - Unix | Low (Low) | `/dashboard`, `/insights` | **False positive** | Ten-digit numbers in public statistics (baht totals), not server timestamps |
| 6 | Content-Type Header Missing | Info | `/`, `/login`, `/library`, `/profile`… | **False positive** | These are `307` redirects (to the role's home or to sign-in) with an empty body; there is nothing to sniff |
| 7 | Information Disclosure - Suspicious Comments | Info | `/_next/static/chunks/*.js` | **False positive** | Words like `query`, `select`, `from` inside minified React/Next.js code. No comments, credentials or internal hosts |
| 8 | Modern Web Application | Info | Pages | **Information** | ZAP noting a JavaScript app; an AJAX spider would find more links (not available headless here) |
| 9 | User Controllable HTML Element Attribute (Potential XSS) | Info (Low) | `/signup/organization` | **False positive** | After a failed signup the form shows the typed values again in `value="…"`. React escapes every attribute value, and the frontend has no `dangerouslySetInnerHTML`. ZAP's own note asks to test it, which the active scan's XSS rules do; none fired |
| 10 | User Agent Fuzzer | Info | Pages | **Information** | Different user agents get different redirects; nothing to fix |

### Before and after

| | High | Medium | Low | Info |
| --- | --- | --- | --- | --- |
| Baseline before | 0 | 5 | 1 | 4 |
| Baseline after the fix | 0 | 2 | 1 | 4 |

The two Medium types left are #2 (accepted) and #3 (false positive).

## Verification

- After the fix, `curl -I` on `/`, `/search`, `/signup`, `/robots.txt`, `/api/auth/me` shows exactly **one** `Content-Security-Policy` header each: the nonce policy on pages, the strict fallback elsewhere. `/search` and `/insights` load and hydrate with no CSP violation in the browser console. A missing file-like path (`/robots.txt`) still shows the 404 page, now without running Next.js's inline bootstrap script: the server-rendered page and its "back home" link work, it just isn't hydrated.
- The re-run baseline no longer reports finding #1.
- The raw reports were checked for secrets before committing: no session cookie name or value, no `Authorization` header, no token (`eyJ…`), no password, no ZAP API key.

## Evidence

| File | What |
| --- | --- |
| [`evidence/zap-baseline-before.html`](./evidence/zap-baseline-before.html), [`.json`](./evidence/zap-baseline-before.json) | Baseline (passive, signed out) before the fix |
| [`evidence/zap-baseline.html`](./evidence/zap-baseline.html), [`.json`](./evidence/zap-baseline.json) | Baseline after the fix |
| [`evidence/zap-full.html`](./evidence/zap-full.html), [`.json`](./evidence/zap-full.json) | Signed-in spider + active scan |
| [`evidence/zap-scan.py`](./evidence/zap-scan.py) | The script that ran the scans: scope, exclusions, seeds, cookie rule |

## How to reproduce

Only ever against your own local copy: the active scan sends attack payloads.

```bash
# 1. The app, locally, with demo data
cp .env.example .env
#   set SESSION_SECRET=$(openssl rand -base64 32) and SEED_DEMO_DATA=true in .env
docker compose up -d --build

# 2a. Docker quick baseline (macOS; on Linux use --network host and http://localhost:3000)
docker run --rm -v "$(pwd)":/zap/wrk -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:3000 -r zap-baseline.html -J zap-baseline.json

# 2b. Or the full run used for this report: start ZAP headless with its API on…
export ZAP_API_KEY=$(openssl rand -hex 16)
zap.sh -daemon -host 127.0.0.1 -port 8090 -config api.key=$ZAP_API_KEY   # or ZAP desktop: Tools → Options → API
pip install zaproxy requests
# …then the signed-out baseline and the signed-in spider + active scan (demo org password from the README)
python3 docs/security/evidence/zap-scan.py baseline out/
DEMO_ORG_PASSWORD='…' python3 docs/security/evidence/zap-scan.py auth out/
```

The signed-in scan takes about 5–10 minutes on a laptop with the default limits. Sessions end after 30 minutes idle; the scan keeps the session busy, but a longer run should log in again.
