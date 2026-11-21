# Deployment checklist

Nothing about this deploy fails loudly except the two things `required()`
is built to catch (`MONGODB_URI`, `SESSION_SECRET` entirely missing, in
production). Almost everything else here can go wrong while `/health` still
answers `{"ok":true}` and the app looks fine to a developer who doesn't try
to sign in from a second device. Read this before the first real deploy.

No hosting target is decided anywhere in this repo — no Kubernetes
manifests, no Terraform, no platform config. **Where this actually runs is
still an open decision**, not something this checklist can verify for you.

---

## Staff passkeys only work on the real address

Staff (admin, owner, auditor) sign in with a password **and a passkey**
([passkeys.md](../security/passkeys.md)). A passkey is bound to the site's
origin, which the backend takes from `FRONTEND_ORIGIN`. If that is still
`http://localhost:3000` on a server, every passkey ceremony fails, and with
`STAFF_PASSKEYS_REQUIRED=true` (the production default) no staff member can
reach their console.

- Set `FRONTEND_ORIGIN=https://<the address users type>` in `.env`.
- Set `STAFF_PASSKEYS_REQUIRED=true` in `.env`: compose defaults it to
  `false` so a local stack or demo works without a passkey.
- `STAFF_PASSKEYS_REQUIRED` must be the same on the frontend and backend
  (compose passes the one value to both).
- Tell staff they will add a passkey at their next sign-in, and that a second
  device is worth adding. The break-glass steps for a lost last-admin passkey
  are in passkeys.md.

---

## The one that logs everyone out without an error anywhere

The backend issues a session token signed with its own `SESSION_SECRET`.
The frontend never calls the backend to check that token again — it
re-verifies the signature itself, locally, on every request
(`frontend/src/lib/auth.ts`, `verifySessionToken`, plain HMAC-SHA256 via
`crypto.subtle`). That's deliberate — it avoids a backend round trip on
every navigation — but it means the two services' `SESSION_SECRET` values
have to be **byte-identical**, and nothing checks that they are.

If they drift even slightly:

1. `POST /auth/login` succeeds against the backend (it has no opinion on the
   frontend's secret) and the cookie gets set.
2. The very next page load calls `verifySessionToken()` locally, the HMAC
   doesn't match, and it returns `null` — same as no cookie at all.
3. The user lands back on the login screen. No request failed, nothing
   logged an error on either service — the symptom is just "login doesn't
   work," which looks like a frontend bug long before anyone thinks to diff
   two env vars.

This is a different shape of bug than a typical cross-origin cookie problem
— there's no browser-to-backend request for `SameSite`/CORS to break,
because the frontend's own API routes proxy the backend server-side. The
failure mode here is purely "two copies of a shared secret disagreed."

- [ ] `SESSION_SECRET` is the exact same string in both services' environments — diff them, don't eyeball them
- [ ] Confirmed by actually signing in through a browser against the deployed frontend, not just checking both env vars are *set*

## The fallback that only exists so local dev doesn't break

Both services read `SESSION_SECRET` (and the backend also reads
`MONGODB_URI`) through a `required()` helper that throws **only when
`NODE_ENV === "production"`**. Outside that, it silently returns a
hardcoded dev value — `dev-only-insecure-secret-change-me` for the secret,
`mongodb://localhost:27017/torfinder` for the backend's Mongo URI. This is
correct and necessary for local development. It is also exactly what
happens if a deploy forgets to set `NODE_ENV=production` — both Dockerfiles
in this repo set it (`ENV NODE_ENV=production`), so building from the
provided images is safe, but a deploy that runs `node dist/main.js` or
`npm start` directly (a VM, a systemd unit, a platform that injects its own
env and drops this one) gets the insecure fallback with **no startup error
at all**, because from `required()`'s point of view nothing is missing.

Two things ride on the same flag:

- `SEED_DEMO_DATA` defaults to `true` whenever `NODE_ENV` isn't exactly
  `production`. The demo accounts and their passwords are committed in
  plaintext in this repo's own `README.md`
  (`admin@bma.go.th` / `Admin-Demo-2026!`, and five more). The seeder only runs
  when the `users` collection is completely empty
  (`database.service.ts`'s `seedUsers()`), so the dangerous moment is
  specifically **first boot against a fresh production database** — exactly
  what a new deployment's first start usually is. After that first boot it's
  silent either way: a non-empty collection means it never fires again,
  which also means checking for demo accounts *after* the fact only tells
  you whether the very first boot got this right.
- The frontend's session cookie only gets `secure: true` when
  `NODE_ENV === "production"` (`frontend/src/app/api/auth/login/route.ts`)
  — without it, the cookie is sent over plain HTTP.

- [ ] `NODE_ENV=production` is actually set in the running process, not just in a Dockerfile you assume got used
- [ ] `echo $NODE_ENV` (or the platform's env inspector) checked on the live container/process itself, post-deploy — not inferred from the deploy script
- [ ] `SEED_DEMO_DATA=false` set explicitly anyway, so this doesn't depend on `NODE_ENV` being right

## Environment variables that matter

| Variable | Service | Gets it wrong, and | 
| --- | --- | --- |
| `SESSION_SECRET` | both | see above — the two must match exactly |
| `MONGODB_URI` | backend | points at the real production database, not the dev/demo one a laptop or CI run wrote into |
| `SEED_DEMO_DATA` | backend | `false`, explicitly — see above |
| `FRONTEND_ORIGIN` | backend | the CORS allow-list; wrong value is silent today (no browser code calls the backend directly — see below) but becomes load-bearing the moment any does |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | both | must be the *same* OAuth client, or Google ID-token verification on the backend rejects tokens the frontend's sign-in button happily produced |
| `THROTTLE_LIMIT` / `AUTH_THROTTLE_LIMIT` | backend | production should run with the real defaults (`100` / `5`) or a deliberately chosen value — not CI's loosened `300`/`300` (see `pipeline.md`); carrying that over removes real rate-limiting in production |

### Build-time vs. runtime, on the frontend

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is inlined into the client JavaScript bundle
at `next build` time (it's a `NEXT_PUBLIC_*` var, and also an explicit
Docker build `ARG` in `frontend/Dockerfile`). Changing it after the image is
built does nothing — restarting the container serves the same bundle.
Rebuilding is the only fix.

`BACKEND_URL` and `SESSION_SECRET`, by contrast, are read at request time by
server-side route handlers (`frontend/src/app/api/auth/*/route.ts`) — a
container restart with a new value takes effect immediately, no rebuild
needed. Know which kind of variable you're changing before you "fix" one
with a restart and watch nothing change.

- [ ] If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` changed, the frontend image was **rebuilt**, not just restarted
- [ ] `BACKEND_URL` on the deployed frontend actually resolves to the deployed backend — not `localhost`, which inside a container means the container itself

## Rate limiting assumes one process

`ThrottlerModule.forRoot(...)` in `backend/src/app.module.ts` is configured
with no external store — counters live in that one Node process's memory.
`docker-compose.yml` runs exactly one backend container, so this is correct
as shipped. The moment the backend runs as more than one instance (a second
container behind a load balancer, an autoscaled platform), each instance
keeps its own independent counter and the effective limit silently
multiplies — `AUTH_THROTTLE_LIMIT=5` becomes 5-per-instance, with nothing
logging that it happened.

- [ ] If deploying more than one backend instance, either pin it to exactly one, or replace the throttler's storage with something shared (Redis) before doing so — this repo ships neither

## What's already known to be missing

From the team's own ASVS Level 1 self-audit
(`docs/security/asvs-l1.md`) — explicitly flagged there as
pre-production work, not yet done:

- [ ] **Password wordlist** — `common-passwords.ts` ships a ~120-word starter list; the audit recommends the SecLists top-10k before production
- [ ] **`npm audit`**, both services — explicitly listed as "outside source review," i.e. not yet checked
- [ ] **Client address** — the reverse proxy writes the address it saw as the right-most `X-Forwarded-For` entry. The Caddy edge does this by default (`reverse_proxy` in `docker/caddy/Caddyfile`); a proxy of your own must too (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). The frontend passes on only the right-most entry, so this is the value the rate limits and the security log use (ASVS 4.1.3, 15.3.4). Never let clients reach port 3000 except through that proxy
- [ ] **TLS termination** — use the Caddy edge (see "HTTPS edge" below) rather than a proxy of your own; it is what the ASVS Level 3 report was checked against. Never publish 4000 or 27017. The database root password is generated on the first `up` ([key-management.md](./key-management.md#database-passwords)); set `MONGO_ROOT_PASSWORD` in `.env` only to choose it yourself. `NODE_ENV=production` stays set on the frontend for the `Secure` cookie attribute (see above)

And not from the audit, just from reading the code:

- [ ] No database backup strategy exists anywhere in this repo. `docker-compose.yml`'s volume persists data across container restarts — that is not a backup, it's the same disk
- [ ] No image ever gets pushed anywhere by CI (`docker-images` job in `auth.yml` builds with `push: false`) — getting an image to a registry and rolling it out is entirely manual today

## HTTPS edge

`docker-compose.edge.yml` adds Caddy in front of the frontend (ASVS 12.1.2, 12.1.4, 4.1.2, 4.2.1, 4.2.3, 4.2.4; `docker/caddy/Caddyfile`): HTTPS with a certificate it obtains and renews itself, TLS 1.2 and 1.3 with forward-secret ciphers only, OCSP stapling, HTTP/2 and HTTP/3, and plain HTTP redirected to HTTPS for pages but refused with 403 for `/api/*`, so an API call sent unencrypted fails visibly.

- [ ] DNS for the domain points at the server, and ports 80 and 443 (TCP, plus 443/UDP for HTTP/3) are open to it
- [ ] In `.env`: `SITE_ADDRESS=<domain>`, `FRONTEND_ORIGIN=https://<domain>` (passkeys and CORS use it)
- [ ] Start with both files: `docker compose -f docker-compose.yml -f docker-compose.edge.yml up -d --build`
- [ ] `curl -sI https://<domain>/` shows `HTTP/2` and `strict-transport-security: max-age=31536000; includeSubDomains; preload`
- [ ] `curl -sI http://<domain>/search` gives `308` to `https://`, and `curl -s http://<domain>/api/auth/me` gives `403 HTTPS required`
- [ ] Check the TLS setup with an external scanner (e.g. SSL Labs): only TLS 1.2 and 1.3, no non-forward-secret suites
- [ ] **HSTS preload (ASVS 3.7.4):** once every subdomain serves HTTPS, submit the domain at hstspreload.org. Removal takes months, so only after the site is settled on HTTPS
- [ ] **Encrypted Client Hello (ASVS 12.1.5):** build Caddy with your DNS provider's module (`xcaddy build --with github.com/caddy-dns/<provider>`), give it an API token for the zone, and enable the two commented `dns` / `ech` lines at the top of the Caddyfile. Caddy then publishes the ECH key in the domain's HTTPS record and rotates it

## Internal TLS between the services

The frontend, backend and MongoDB authenticate each other with certificates from a private CA (ASVS 12.3.5). The `certs` service makes them on every `up` (`docker/certs/generate.sh`): a new CA the first time, each certificate again within 30 days of expiry. Nothing to do on a normal deploy.

- [ ] The backend's log says `listening on :4000 (HTTPS, client certificates required)`; in production a plain-HTTP start logs `config.internal_tls_off`
- [ ] `db-users` logs `created` or `updated CN=torr_app,OU=backend,O=TorFinder`: the backend's database login is its certificate. The old password account (`MONGO_APP_PASSWORD`) is removed and the variable is no longer read
- [ ] To start over with a new CA (e.g. after a key was exposed): `docker compose down`, `docker volume rm <project>_certs_ca`, `docker compose up -d`. Every certificate is reissued

## Hardening services

`docker-compose.hardening.yml` adds the virus scanner, the egress allowlist, the secrets vault and the separate log store (ASVS 5.4.3, 13.2.5, 13.3.1, 16.4.2, 16.4.3). How each works and how to check it: [hardening.md](./hardening.md).

- [ ] Start with all three files: `docker compose -f docker-compose.yml -f docker-compose.edge.yml -f docker-compose.hardening.yml up -d --build`
- [ ] `vault-init` logs `gave backend its secrets` and `gave frontend its secrets`; then remove the secrets from `.env`
- [ ] The backend's log has no `config.virus_scan_off`, and the EICAR probe (`docs/security/evidence/virus-probe.js`) is refused with 422
- [ ] From the backend, a portal answers and `https://example.com` is refused; a new outside service is added to `docker/hardening/squid.conf` first
- [ ] Run the log store on another host and point the `fluentd-address` at it
- [ ] Switch the vault to auto-unseal with the cloud provider's key service, and revoke the root token
- [ ] `COMPANY_PASSKEYS_REQUIRED` and `STAFF_PASSKEYS_REQUIRED` are on (their production default)

## Confirm it actually works, not just that it booted

- [ ] `curl -sf <backend>/health` returns `{"ok":true}`
- [ ] Sign in as the real admin account through a real browser against the deployed frontend — not curl, since the bug this is catching (see above) is specifically about the browser's stored cookie surviving a page load
- [ ] Reload that page. Still signed in confirms `SESSION_SECRET` actually matches between the two services; bounced back to login means it doesn't
- [ ] Open devtools, inspect the session cookie, confirm it is named `__Host-torr_session` and `Secure` is set — confirms `NODE_ENV=production` actually took effect on the frontend, not just that you set it in a config file somewhere
- [ ] Fire the report-a-problem endpoint 6 times in under a minute from one IP and confirm the 6th comes back `429` — confirms the real `AUTH_THROTTLE_LIMIT` (not CI's `300`) made it into this environment
- [ ] Check `SEED_DEMO_DATA` didn't quietly seed `admin@bma.go.th` into this database — query the `users` collection for that email, expect nothing (or expect it, if this deployment genuinely wants the demo accounts, but then that should be a deliberate choice, not a default nobody looked at)
