// Unit coverage for ASVS 6.3.5: a successful sign-in from a browser the
// account hasn't used before emails its owner, with when, which browser and
// the IP. The account's first browser is recorded quietly; a known one only
// has its last-seen time updated; a sign-in with no device id counts as new.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { AuthService } from "../dist/auth/auth.service.js";
import { MAX_KNOWN_DEVICES, NEW_DEVICE_SESSION_SECONDS, deviceHash, deviceLabel } from "../dist/auth/known-devices.js";
import { createSessionToken } from "../dist/common/token.js";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const deviceId = (n) => String(n).padStart(43, "A");

/** An AuthService whose database only records updates and whose mailer only records. */
function serviceWith(admins = []) {
  const updates = [];
  const sent = [];
  const db = {
    users: {
      updateOne: async (filter, update) => updates.push({ filter, update }),
      find: () => ({ toArray: async () => admins }),
    },
  };
  const links = { notify: async (email, notice, details) => sent.push({ email, notice, details }) };
  return { service: new AuthService(db, links, {}, {}), updates, sent };
}

const user = (knownDevices) => ({ _id: new ObjectId(), email: "owner@example.com", knownDevices });
const known = (n) => ({ hash: deviceHash(deviceId(n)), label: "x", firstSeenAt: new Date(0), lastSeenAt: new Date(0) });

describe("AuthService.noteDevice", () => {
  it("records an account's first browser without emailing", async () => {
    const { service, updates, sent } = serviceWith();
    await service.noteDevice(user(undefined), { id: deviceId(1), userAgent: CHROME_MAC }, "203.0.113.7");
    assert.equal(sent.length, 0);
    const pushed = updates[0].update.$push.knownDevices;
    assert.equal(pushed.$each[0].hash, deviceHash(deviceId(1)));
    assert.notEqual(pushed.$each[0].hash, deviceId(1), "only a hash of the cookie is stored");
    assert.equal(pushed.$slice, -MAX_KNOWN_DEVICES);
  });

  it("only refreshes last-seen for a browser it knows", async () => {
    const { service, updates, sent } = serviceWith();
    await service.noteDevice(user([known(1)]), { id: deviceId(1) }, "203.0.113.7");
    assert.equal(sent.length, 0);
    assert.ok(updates[0].update.$set["knownDevices.$.lastSeenAt"]);
  });

  it("emails the owner about a new browser, with when, which and from where", async () => {
    const { service, updates, sent } = serviceWith();
    await service.noteDevice(user([known(1)]), { id: deviceId(2), userAgent: CHROME_MAC }, "203.0.113.7");
    assert.equal(updates.length, 1, "the new browser is remembered");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].notice, "new-device");
    assert.equal(sent[0].email, "owner@example.com");
    const details = sent[0].details.join("\n");
    assert.match(details, /Chrome บน macOS/);
    assert.match(details, /203\.0\.113\.7/);
    assert.match(details, /เวลา/);
  });

  it("treats a sign-in with no (or a malformed) device id as new, and stores nothing for it", async () => {
    for (const id of [undefined, "short", "x".repeat(43) + "!"]) {
      const { service, updates, sent } = serviceWith();
      await service.noteDevice(user([known(1)]), { id }, "203.0.113.7");
      assert.equal(sent.length, 1, String(id));
      assert.equal(updates.length, 0, String(id));
    }
  });
});

describe("adaptive controls on a new device (ASVS 8.2.4, 8.4.2)", () => {
  it("reports a new device to the caller, and not a known or first one", async () => {
    const { service } = serviceWith();
    assert.equal(await service.noteDevice(user([known(1)]), { id: deviceId(2) }, "203.0.113.7"), true);
    assert.equal(await service.noteDevice(user([known(1)]), { id: deviceId(1) }, "203.0.113.7"), false);
    assert.equal(await service.noteDevice(user(undefined), { id: deviceId(1) }, "203.0.113.7"), false);
  });

  it("emails every other admin when a staff account signs in from a new device", async () => {
    const { service, sent } = serviceWith([{ email: "boss@example.com" }, { email: "other@example.com" }]);
    const staff = { ...user([known(1)]), role: "owner", name: "Owner One" };
    await service.noteDevice(staff, { id: deviceId(2), userAgent: CHROME_MAC }, "203.0.113.7");
    await new Promise((resolve) => setImmediate(resolve));
    const toAdmins = sent.filter((mail) => mail.notice === "staff-new-device");
    assert.deepEqual(toAdmins.map((mail) => mail.email).sort(), ["boss@example.com", "other@example.com"]);
    assert.match(toAdmins[0].details.join("\n"), /Owner One/);
  });

  it("doesn't email admins about a company's new device", async () => {
    const { service, sent } = serviceWith([{ email: "boss@example.com" }]);
    await service.noteDevice({ ...user([known(1)]), role: "org" }, { id: deviceId(2) }, "203.0.113.7");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sent.filter((mail) => mail.notice === "staff-new-device").length, 0);
  });

  it("gives a new-device session a 12-hour lifetime, never longer than 7 days", () => {
    const decode = (t) => JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    const short = decode(createSessionToken({ sub: "x", email: "a", name: "a", role: "org" }, NEW_DEVICE_SESSION_SECONDS));
    assert.equal(short.exp - short.iat, 12 * 60 * 60);
    const normal = decode(createSessionToken({ sub: "x", email: "a", name: "a", role: "org" }));
    assert.equal(normal.exp - normal.iat, 7 * 24 * 60 * 60);
    const capped = decode(createSessionToken({ sub: "x", email: "a", name: "a", role: "org" }, 30 * 24 * 60 * 60));
    assert.equal(capped.exp - capped.iat, 7 * 24 * 60 * 60);
  });
});

describe("deviceLabel", () => {
  it("describes common browsers coarsely", () => {
    assert.equal(deviceLabel(CHROME_MAC), "Chrome บน macOS");
    assert.equal(
      deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),
      "Safari บน iOS",
    );
    assert.equal(
      deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"),
      "Edge บน Windows",
    );
    assert.equal(deviceLabel(undefined), "เบราว์เซอร์ที่ไม่ทราบชื่อ");
  });
});
