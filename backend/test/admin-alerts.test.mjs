// Unit coverage for the admin sync alerts — imported from the compiled build
// (run after `npm run build`, as CI does), the same way bid-insight.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { SyncScheduler } from "../dist/common/sync-scheduler.js";
import { AdminAlertsService } from "../dist/notifications/admin-alerts.service.js";

const ADMIN_A = new ObjectId();
const ADMIN_B = new ObjectId();

/** Just the two queries the service makes, answered from memory. */
function fakeDb({ admins = [ADMIN_A, ADMIN_B], unreadFor = [] } = {}) {
  const queries = [];
  return {
    queries,
    users: {
      find(filter) {
        queries.push(filter);
        return { toArray: async () => admins.map((_id) => ({ _id })) };
      },
    },
    notifications: {
      find() {
        return { toArray: async () => unreadFor.map((userId) => ({ userId })) };
      },
    },
  };
}

function fakeNotifications() {
  const sent = [];
  return { sent, create: async (userId, type, title, message) => sent.push({ userId, type, title, message }) };
}

describe("AdminAlertsService", () => {
  it("tells every active admin when a run fails", async () => {
    const db = fakeDb();
    const notifications = fakeNotifications();
    await new AdminAlertsService(db, notifications).syncProblem("e-GP", { kind: "failed", error: "timeout" });

    assert.deepEqual(db.queries[0], { role: "admin", suspended: { $ne: true } });
    assert.equal(notifications.sent.length, 2);
    assert.equal(notifications.sent[0].type, "system");
    assert.match(notifications.sent[0].title, /e-GP ไม่สำเร็จ/);
    assert.match(notifications.sent[0].message, /timeout/);
  });

  it("names the failed feeds on a partial run", async () => {
    const notifications = fakeNotifications();
    const feeds = ["D0/ซอฟต์แวร์", "D0/ระบบ", "P0/แอปพลิเคชัน", "W0/เว็บไซต์", "D1/ข้อมูล", "D2/คอมพิวเตอร์"];
    await new AdminAlertsService(fakeDb({ admins: [ADMIN_A] }), notifications).syncProblem("e-GP", {
      kind: "partial",
      failedFeeds: feeds,
    });

    const [alert] = notifications.sent;
    assert.match(alert.title, /ได้ไม่ครบ/);
    assert.match(alert.message, /\(6\)/);
    assert.match(alert.message, /D1\/ข้อมูล …/);
    assert.doesNotMatch(alert.message, /D2/);
  });

  it("skips an admin who still has the same alert unread", async () => {
    const notifications = fakeNotifications();
    await new AdminAlertsService(fakeDb({ unreadFor: [ADMIN_A] }), notifications).syncProblem("MEA", {
      kind: "failed",
      error: "503",
    });

    assert.deepEqual(
      notifications.sent.map(({ userId }) => userId),
      [ADMIN_B],
    );
  });

  it("never throws, even when the database does", async () => {
    const db = { users: { find: () => ({ toArray: async () => Promise.reject(new Error("down")) }) } };
    await new AdminAlertsService(db, fakeNotifications()).syncProblem("MEA", { kind: "failed", error: "x" });
  });
});

describe("SyncScheduler alerts", () => {
  class TestScheduler extends SyncScheduler {
    // A near-zero backoff so the retry tests don't sit through real delays.
    constructor(alerts, run, retryBaseDelayMs = 1) {
      super("Test", { pollMinutes: 0, pollOnStartup: false }, alerts, run, 0, retryBaseDelayMs);
    }
  }

  function recordingAlerts() {
    const calls = [];
    return { calls, syncProblem: async (source, problem) => calls.push({ source, problem }) };
  }

  it("alerts once a run that keeps throwing has exhausted its retries", async () => {
    const alerts = recordingAlerts();
    let attempts = 0;
    await new TestScheduler(alerts, async () => {
      attempts++;
      throw new Error("portal down");
    }).poll();

    assert.equal(attempts, 3);
    assert.deepEqual(alerts.calls, [{ source: "Test", problem: { kind: "failed", error: "portal down" } }]);
  });

  it("stops retrying and stays quiet as soon as a retry succeeds", async () => {
    const alerts = recordingAlerts();
    let attempts = 0;
    await new TestScheduler(alerts, async () => {
      attempts++;
      if (attempts < 2) throw new Error("portal down");
      return { summary: "1 new", failedFeeds: [] };
    }).poll();

    assert.equal(attempts, 2);
    assert.equal(alerts.calls.length, 0);
  });

  it("alerts on a partial run", async () => {
    const alerts = recordingAlerts();
    await new TestScheduler(alerts, async () => ({ summary: "1 new", failedFeeds: ["D0/ระบบ"] })).poll();
    assert.deepEqual(alerts.calls, [{ source: "Test", problem: { kind: "partial", failedFeeds: ["D0/ระบบ"] } }]);
  });

  it("stays quiet on a clean run", async () => {
    const alerts = recordingAlerts();
    await new TestScheduler(alerts, async () => ({ summary: "1 new", failedFeeds: [] })).poll();
    await new TestScheduler(alerts, async () => ({ summary: "done" })).poll();
    assert.equal(alerts.calls.length, 0);
  });
});
