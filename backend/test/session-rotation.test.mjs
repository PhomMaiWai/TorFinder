// Unit coverage for ASVS 13.3.4: SESSION_SECRET can be rotated without
// signing anyone out. The previous key is accepted for checking (never for
// signing) until its end date, then stops working by itself; a key older than
// the rotation schedule is reported. Loaded from dist — run `npm run build`
// first. The keys are set before the modules load, as the server reads them.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const CURRENT = "current-secret-for-rotation-test-0123456789";
const PREVIOUS = "previous-secret-for-rotation-test-0123456789";
const DAY = 86_400_000;

process.env.SESSION_SECRET = CURRENT;
process.env.SESSION_SECRET_PREVIOUS = PREVIOUS;
process.env.SESSION_SECRET_PREVIOUS_UNTIL = new Date(Date.now() + 3 * DAY).toISOString();
process.env.SESSION_SECRET_CREATED = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);

let token, keys, formTiming, securityLog;
before(async () => {
  token = await import("../dist/common/token.js");
  keys = await import("../dist/common/session-keys.js");
  formTiming = await import("../dist/common/form-timing.guard.js");
  securityLog = await import("../dist/common/security-log.js");
});

function signedWith(secret, payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

const session = () => {
  const now = Math.floor(Date.now() / 1000);
  return { sub: "0123456789abcdef01234567", email: "a@ci.test", name: "A", role: "org", iat: now, act: now, exp: now + 3600 };
};

describe("session secret rotation (ASVS 13.3.4)", () => {
  it("signs with the current key only", () => {
    const issued = token.createSessionToken({ sub: "x", email: "a@ci.test", name: "A", role: "org" });
    const [data, signature] = issued.split(".");
    assert.equal(signature, createHmac("sha256", CURRENT).update(data).digest("base64url"));
  });

  it("accepts a session signed with the previous key until its end date", () => {
    assert.ok(token.verifySessionToken(signedWith(PREVIOUS, session())));
    assert.ok(token.verifySessionToken(signedWith(CURRENT, session())));
    assert.equal(token.verifySessionToken(signedWith("some-other-secret-entirely-0123456789", session())), null);
  });

  it("stops accepting the previous key after its end date", () => {
    assert.deepEqual(keys.verifyingSecrets(Date.now()), [CURRENT, PREVIOUS]);
    assert.deepEqual(keys.verifyingSecrets(Date.now() + 4 * DAY), [CURRENT]);
  });

  it("accepts a form token from just before the rotation", () => {
    const data = Buffer.from(JSON.stringify({ p: "signup", t: Date.now() - 5000 })).toString("base64url");
    const old = `${data}.${createHmac("sha256", PREVIOUS).update(`form-timing:${data}`).digest("base64url")}`;
    assert.equal(typeof formTiming.formStartedAt(old, "signup"), "number");
  });

  it("reports a current key older than the schedule, and a previous key past its date", () => {
    const logged = [];
    const original = console.log;
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => (String(chunk).includes("config.secret_rotation_due") ? (logged.push(String(chunk)), true) : write(chunk, ...rest));
    try {
      keys.checkSecretAges(Date.now() + 4 * DAY);
    } finally {
      process.stdout.write = write;
      console.log = original;
    }
    assert.ok(securityLog, "security log loaded");
    const text = logged.join("");
    assert.match(text, /session_secret_older_than_schedule/);
    assert.match(text, /previous_session_secret_expired_remove_it/);
  });
});
