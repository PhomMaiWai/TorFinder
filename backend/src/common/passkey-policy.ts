import { ForbiddenException } from "@nestjs/common";

import { env } from "../config/env";
import { Role, isStaffRole } from "./roles";
import { SessionPayload } from "./token";

/**
 * Who must sign in with a passkey as a second factor (ASVS 6.3.3): staff, and
 * companies, each on by default in production. Public viewers sign in with
 * Google, whose own sign-in protects the account (docs/security/passkeys.md).
 */
export function passkeyRequiredFor(role: Role): boolean {
  if (isStaffRole(role)) return env.passkeys.required;
  if (role === "org") return env.passkeys.companiesRequired;
  return false;
}

/** A session that hasn't used a passkey although its account must: it may only add one. */
export function needsPasskeySetup(session: SessionPayload): boolean {
  return passkeyRequiredFor(session.role) && !session.amr?.includes("passkey");
}

/** What such a session may still reach: signing in and out, its sessions, and adding a passkey. */
export const PASSKEY_SETUP_PATHS = /^\/api\/auth\//;

/** The refusal for everything else; its code tells the frontend to send the user to /account. */
export function passkeySetupRequired(session: SessionPayload): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    code: "passkey-setup-required",
    message: isStaffRole(session.role)
      ? "บัญชีเจ้าหน้าที่ต้องเพิ่มพาสคีย์ก่อนใช้งาน กรุณาไปที่หน้าบัญชีของฉัน"
      : "บัญชีบริษัทต้องเพิ่มพาสคีย์ก่อนใช้งาน กรุณาไปที่หน้าบัญชีของฉัน",
  });
}
