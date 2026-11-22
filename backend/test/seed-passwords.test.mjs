// Demo account passwords must meet the same policy a user signing up meets:
// 12+ characters (ASVS 6.2.1), not common (6.2.4), not built on a context
// word or the account's own email and company name (6.2.11).
import assert from "node:assert/strict";
import { test } from "node:test";

import { passwordProblem } from "../dist/common/password.js";
import { SEED_USERS } from "../dist/database/seed-data.js";

const MIN_LENGTH = 12;

for (const user of SEED_USERS) {
  test(`demo password for ${user.email} meets the password policy`, () => {
    assert.ok(user.password.length >= MIN_LENGTH, `${user.password.length} characters, needs ${MIN_LENGTH}`);
    assert.equal(passwordProblem(user.password, { email: user.email, companyName: user.company?.companyName }), null);
    assert.ok(!user.previousPasswords?.includes(user.password), "the current password is not a previous one");
  });
}
