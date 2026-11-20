import { env } from "../config/env";
import { logSecurityEvent } from "./security-log";

/**
 * The keys a session (or form) signature may be checked against: the current
 * SESSION_SECRET, and during a rotation the previous one until its end date
 * (ASVS 13.3.4). Signing always uses the current key only.
 */
export function verifyingSecrets(now = Date.now()): string[] {
  const previous = env.sessionSecretPrevious;
  return previous && previous.until.getTime() > now ? [env.sessionSecret, previous.value] : [env.sessionSecret];
}

const DAY_MS = 86_400_000;

/**
 * Reports, at startup and once a day, a session secret that has outlived the
 * rotation schedule, and a previous one still configured after its end date.
 * Never blocks: an expired key is rotated by the operator, not by an outage.
 */
export function checkSecretAges(now = Date.now()): void {
  const created = env.sessionSecretCreated;
  if (created && now - created.getTime() > env.sessionSecretMaxAgeDays * DAY_MS) {
    logSecurityEvent("config.secret_rotation_due", { outcome: "failure", reason: "session_secret_older_than_schedule" });
  }
  const previous = env.sessionSecretPrevious;
  if (previous && previous.until.getTime() <= now) {
    logSecurityEvent("config.secret_rotation_due", { outcome: "failure", reason: "previous_session_secret_expired_remove_it" });
  }
}
