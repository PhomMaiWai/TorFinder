/**
 * Every kind of account. `org` is a bidding company; `owner` is the agency
 * side of an announcement; `auditor` reviews flagged ones; `viewer` is a member
 * of the public who signed in with Google to follow announcements. Held in one list so
 * the user record, the session token and anything that validates a role all
 * agree on what a role can be.
 */
export const ROLES = ["admin", "org", "owner", "auditor", "viewer"] as const;
export type Role = (typeof ROLES)[number];
