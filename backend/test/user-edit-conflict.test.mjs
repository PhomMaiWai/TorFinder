// Unit coverage for the optimistic lock in AccountsService.updateUser: an
// admin's rename is written only if the account's role is still the one the
// edit read. If the role moved in between (another admin's edit, or a role
// change being approved), the rename is refused with 409 and writes nothing,
// and an admin-role request filed by the same edit is withdrawn.
//
// An end-to-end race can't hit this window reliably on every machine, so the
// in-between change is simulated here: the database finds no account with the
// role that was read. Loaded from dist like the other logic-only suites — run
// `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { AccountsService } from "../dist/accounts/accounts.service.js";
import { CHANGED_MEANWHILE } from "../dist/accounts/role-changes.service.js";

const ACTOR = { sub: new ObjectId().toString(), email: "admin@ci.test", role: "admin" };

/** An AccountsService over a fake database; `renameWrites` says whether the conditional rename finds the account. */
function serviceWith({ renameWrites, needsApproval = false }) {
  const current = { _id: new ObjectId(), email: "viewer@ci.test", name: "Old name", role: "viewer" };
  const renames = [];
  const audits = [];
  const withdrawn = [];
  const pending = { id: new ObjectId().toString(), toRole: "admin" };
  const db = {
    users: {
      findOne: async () => current,
      findOneAndUpdate: async (filter, update) => {
        renames.push({ filter, update });
        return renameWrites ? { ...current, ...update.$set } : null;
      },
    },
    adminApprovals: { deleteOne: async (filter) => withdrawn.push(filter) },
    transaction: (work) => work(undefined),
  };
  const audit = { record: async (...entry) => audits.push(entry) };
  const roles = { otherAdmins: async () => 1 };
  const approvals = {
    needsApproval: async () => needsApproval,
    request: async () => pending,
  };
  const service = new AccountsService(db, {}, audit, {}, {}, {}, roles, approvals);
  return { service, current, renames, audits, withdrawn, pending };
}

describe("AccountsService.updateUser, account changed meanwhile", () => {
  it("writes the rename only while the role is still the one it read", async () => {
    const { service, current, renames, audits } = serviceWith({ renameWrites: true });
    const result = await service.updateUser(current._id.toString(), { name: "New name" }, ACTOR);
    assert.equal(result.name, "New name");
    assert.deepEqual(renames[0].filter, { _id: current._id, role: "viewer" });
    assert.equal(audits.length, 1);
  });

  it("refuses the rename with 409 when the role moved in between, and records nothing", async () => {
    const { service, current, audits } = serviceWith({ renameWrites: false });
    await assert.rejects(service.updateUser(current._id.toString(), { name: "New name" }, ACTOR), (error) => {
      assert.equal(error.getStatus(), 409);
      assert.equal(error.message, CHANGED_MEANWHILE);
      return true;
    });
    assert.equal(audits.length, 0);
  });

  it("withdraws the admin-role request the same edit filed", async () => {
    const { service, current, withdrawn, pending } = serviceWith({ renameWrites: false, needsApproval: true });
    await assert.rejects(
      service.updateUser(current._id.toString(), { name: "New name", role: "admin" }, ACTOR),
      (error) => error.getStatus() === 409,
    );
    assert.deepEqual(withdrawn, [{ _id: new ObjectId(pending.id) }]);
  });
});
