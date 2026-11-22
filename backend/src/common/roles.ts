/**
 * Every kind of account. `org` is a bidding company; `owner` is the agency
 * side of an announcement; `viewer` is a member of the public who signed in
 * with Google to follow announcements. Held in one list so the user record,
 * the session token and anything that validates a role all agree on what a
 * role can be.
 */
export const ROLES = ["admin", "org", "owner", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** The agency's own people: their accounts reach every company's data or the procurement record, so they sign in with a passkey too. */
export const STAFF_ROLES = ["admin", "owner"] as const satisfies readonly Role[];
export const isStaffRole = (role: Role | undefined): boolean =>
  role !== undefined && (STAFF_ROLES as readonly Role[]).includes(role);
