import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { Role } from "./roles";

/** How the holder proved who they are: a password, Google, a passkey (RFC 8176 style). */
export type AuthMethod = "pwd" | "google" | "passkey";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** When this token was issued, in epoch seconds — SessionRevocationService's unit of revocation. */
  iat: number;
  /**
   * Last activity, in epoch seconds. Starts at `iat`; the frontend re-signs the
   * token with a fresh `act` while the user keeps using the site.
   */
  act?: number;
  exp: number;
  /** How this session was authenticated. Absent on tokens issued before passkeys: treated as password only. */
  amr?: AuthMethod[];
  /** When a passkey was last checked in this session, epoch seconds — what step-up reads (ASVS 7.5.3). */
  pkt?: number;
  /** This session's id in the `sessions` collection (ASVS 7.5.2). Absent on tokens issued before it existed. */
  sid?: string;
};

/** Absolute lifetime in seconds; also how long a session record is kept. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Absolute lifetime (ASVS 7.3.2): re-authenticate after 7 days whatever the activity. */
const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;

function sign(data: string) {
  return createHmac("sha256", env.sessionSecret).update(data).digest("base64url");
}

function encode(body: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp" | "act">): string {
  const iat = Math.floor(Date.now() / 1000);
  return encode({ ...payload, iat, act: iat, exp: iat + SESSION_MAX_AGE });
}

/**
 * The same session after a passkey check: the new `amr` and `pkt`, activity
 * now, and `iat` and `exp` unchanged — so revocation still applies and a
 * passkey check can't stretch the 7-day absolute lifetime.
 */
export function reissueSessionToken(session: SessionPayload, changes: Pick<SessionPayload, "amr" | "pkt">): string {
  return encode({ ...session, ...changes, act: Math.floor(Date.now() / 1000) });
}

/** Whether the session's passkey check is recent enough for a sensitive action. */
export function hasRecentPasskey(session: SessionPayload, maxAgeMinutes: number): boolean {
  return typeof session.pkt === "number" && Math.floor(Date.now() / 1000) - session.pkt <= maxAgeMinutes * 60;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  const [data, signature] = token?.split(".") ?? [];
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    // Only a session's own shape counts as a session (ASVS 9.2.2): nothing
    // else is signed with this key today, and this keeps it that way.
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    const now = Math.floor(Date.now() / 1000);
    if (!(payload.exp > now)) return null;
    // ASVS 7.3.1: an unused session ends after the idle window, even within
    // its 7-day absolute lifetime (7.3.2). Every token we issue carries `iat`.
    const lastActive = payload.act ?? payload.iat;
    if (lastActive !== undefined && now - lastActive > env.sessionIdleMinutes * 60) return null;
    return payload;
  } catch {
    return null;
  }
}
