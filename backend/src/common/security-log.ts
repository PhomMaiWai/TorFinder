import { Logger } from "@nestjs/common";

import { env } from "../config/env";

/**
 * Security events, one JSON object per line on the "Security" logger (ASVS
 * 16.2 / 16.3): sign-ins, lockouts, password changes, refused access, rate
 * limits. One shape everywhere, so a log search or SIEM can filter on
 * `event` and `outcome`.
 *
 * What never goes in: passwords, tokens, reset links, session cookies
 * (ASVS 16.2.5). Every value goes through JSON.stringify, so a newline or a
 * fake field typed into an email box can't forge a log line (ASVS 16.4.1).
 */
export type SecurityEvent =
  | "auth.login"
  | "auth.login.locked"
  | "auth.login.lockout"
  | "auth.login.new_device"
  | "auth.google"
  | "auth.logout"
  | "auth.signup"
  | "auth.password.change"
  | "auth.password.reset.request"
  | "auth.password.reset.admin"
  | "auth.password.reset"
  | "auth.email.verify"
  | "access.denied"
  | "access.granted"
  | "input.rejected"
  | "rate.limited"
  | "line.webhook.bad_signature"
  | "auth.passkey.login"
  | "auth.passkey.register"
  | "auth.passkey.remove"
  | "auth.passkey.reset"
  | "auth.step_up"
  | "auth.session.revoke"
  | "admin.sessions.revoke"
  | "config.secret_rotation_due"
  | "config.internal_tls_off"
  | "config.virus_scan_off"
  | "file.malware"
  | "file.unscanned"
  | "ai.quota.exceeded"
  | "admin.approval.request"
  | "admin.approval.approve"
  | "admin.approval.reject";

export type SecurityEventFields = {
  outcome: "success" | "failure";
  /** Account id when known. */
  userId?: string;
  /** The address the request was about; may not belong to any account. */
  email?: string;
  /** The client address as the backend sees it (see `trust proxy` in main.ts). */
  ip?: string;
  /** A short machine-readable cause, e.g. `bad_credentials`, `wrong_role`. */
  reason?: string;
  role?: string;
  method?: string;
  path?: string;
};

const logger = new Logger("Security");

/** Long enough for any real value, short enough that one field can't flood the log. */
const MAX_FIELD = 254;

function clean(fields: SecurityEventFields): SecurityEventFields {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = String(value).slice(0, MAX_FIELD);
  }
  return out as SecurityEventFields;
}

export function logSecurityEvent(event: SecurityEvent, fields: SecurityEventFields): void {
  const record = { ts: new Date().toISOString(), event, ...clean(fields) };
  // Production's JSON logger nests the object as-is; dev prints it as one readable line.
  const message = env.isProduction ? record : JSON.stringify(record);
  if (fields.outcome === "failure") logger.warn(message);
  else logger.log(message);
}
