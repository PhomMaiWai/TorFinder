# Staff passkeys

Staff accounts (admin, owner, auditor) confirm every sign-in with a **passkey**, and confirm again before sensitive admin actions. This is the Level 3 form of ASVS 5.0 **6.3.3** (a phishing-resistant, hardware-based factor that needs a user action) and **7.5.3** (re-authentication before highly sensitive operations). Company and public accounts are unchanged.

A passkey is a key pair made by a phone, laptop (Touch ID, Windows Hello) or security key. The private key never leaves the device. The browser only lets it sign for this site's own domain, so a look-alike phishing page gets nothing it can replay, and a stolen password alone no longer opens a staff account.

## How it works

**Sign-in.** A staff member enters their password (or uses Google). If the account has a passkey, the backend answers `passkey-required` with a challenge instead of a session. The browser asks the device to sign it, and only then is the session cookie set. The session records how it was made (`amr: ["pwd", "passkey"]`) and when the passkey was checked (`pkt`).

**First passkey.** The first time a staff member signs in, they add a passkey from **Account settings** (`/account`). While passkeys are required, a staff session without one can only reach `/account` and the user's own routes; the console redirects there, and the backend refuses console routes with `passkey-setup-required`.

**Step-up.** These actions need a passkey check from the last 10 minutes (`STEP_UP_MINUTES`):

| Action | Route |
| --- | --- |
| Approve or reject a company | `PATCH /accounts/:id` |
| Rename an account or change its role | `PATCH /accounts/:id/details` |
| Suspend or reactivate an account | `PATCH /accounts/:id/suspend`, `/reactivate` |
| Delete an announcement | `DELETE /tor/:id` |
| Clear someone's passkeys | `POST /accounts/:id/passkeys/reset` |
| Add a second passkey, or remove one | `POST /auth/passkeys/options`, `DELETE /auth/passkeys/:id` |

If the check is too old, the action is refused with `step-up-required`. The page then asks for the passkey and tries once more; the admin just touches their key. The re-signed session keeps its original `iat` and `exp`, so a check can't extend the 7-day absolute lifetime.

**Lost device.** Another admin opens **Manage Users**, chooses **Reset passkeys** on the account and confirms with their own passkey. Every passkey on the account is cleared and every session ends, and the owner is emailed. At their next sign-in they add a new passkey with their password, the same proof as their first one. Nobody can reset their own passkeys.

**Emails** go to the owner whenever a passkey is added, removed or reset (ASVS 6.3.7), so a passkey someone else added doesn't go unnoticed.

## Settings

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `STAFF_PASSKEYS_REQUIRED` | backend **and** frontend (must match) | `true` in production, `false` otherwise; `docker-compose.yml` passes `false` unless `.env` sets it | Required: staff can't use the console until they add a passkey, and step-up applies to every admin. Optional: passkeys are opt-in, but anyone who added one must always use it and gets step-up |
| `FRONTEND_ORIGIN` | backend | `http://localhost:3000` | The site's public address. Passkeys only work on this origin; on a server it must be the `https://` address users type |
| `WEBAUTHN_RP_ID` | backend | `FRONTEND_ORIGIN`'s host | Set to a parent domain only to share passkeys across subdomains |
| `STEP_UP_MINUTES` | backend | `10` | How long a passkey check counts for the actions above |

## Rolling it out

1. Set `FRONTEND_ORIGIN` to the public `https://` address and deploy. Passkeys need a secure context: HTTPS, or `localhost` on a developer's machine.
2. Set `STAFF_PASSKEYS_REQUIRED=true` in `.env` (compose defaults it to `false`). Each staff member is sent to `/account` at their next sign-in and adds a passkey. Tell them beforehand; adding a second device (phone plus laptop) is a good idea.
3. Check `/admin/audit` and the security log for `auth.passkey.register` events, one per staff member.

To try it without forcing anyone, deploy with `STAFF_PASSKEYS_REQUIRED=false` on both services first. Staff who add a passkey are then protected; the rest are not.

## Break-glass: the last admin lost their passkey

Only an admin can reset passkeys, so if the only admin loses theirs, someone with access to the database clears them by hand:

```
docker compose exec db mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin torr \
  --eval 'db.users.updateOne({ email: "admin@example.go.th" }, { $unset: { passkeys: "" }, $set: { sessionMinIssuedAt: new Date() } })'
```

Record who did it and why. The admin then signs in with their password and adds a new passkey. Setting `STAFF_PASSKEYS_REQUIRED=false` does **not** help: an account that has a passkey must always use it.

## Known limits

- **First enrolment trusts the password.** Someone who learns a staff password before the owner adds a passkey could add theirs first. The owner is emailed when it happens, and an admin can reset it. Rolling out soon after accounts are created keeps this window short.
- **Assigning an announcement's owner** (`PUT /tor/:id/owner`) is not behind step-up yet. It runs inside the TOR edit form's full-page save, which can't pause for the passkey prompt; it needs that form moved to a client-side submit first.
- **Company and public accounts** still have no second factor of their own (L2 6.3.3 stays Partial). Google accounts carry Google's.
- **User verification is preferred, not required** (`requireUserVerification: false`). Every passkey check needs the user present (a touch or tap), but a security key without a PIN or biometric is accepted. That is enough for a second factor: the password is the first, and the passkey proves possession of the device. It is why the 6.3.3 claim rests on password plus passkey, not on the passkey alone as a single multi-factor step.
- **Attestation is `none`.** Any standards-compliant authenticator is accepted; the app doesn't restrict to particular makes of security key.

## Where it lives

| Part | File |
| --- | --- |
| Challenges, sign-in, enrolment, step-up, reset | `backend/src/auth/passkeys.service.ts` |
| Step-up guard | `backend/src/common/step-up.guard.ts` |
| Staff without a passkey refused from the console | `backend/src/common/role.guard.ts` |
| Session claims `amr`, `pkt`; re-signing | `backend/src/common/token.ts` |
| Browser side | `frontend/src/lib/passkeys-client.ts`, `components/account/passkey-section.tsx`, `components/auth/sign-in-form.tsx` |
| Tests (a software authenticator drives the real WebAuthn checks) | `backend/test/passkeys.e2e.test.mjs`, `backend/test/helpers/software-authenticator.mjs` |

Challenges are 32 random bytes, stored only as a SHA-256 hash, tied to one account and one purpose (sign-in, adding a passkey, step-up), valid for 5 minutes and deleted as they are used. A sign-in challenge can't be answered for a step-up and vice versa. The authenticator's signature counter is checked, so a cloned key that reuses an old count is refused.
